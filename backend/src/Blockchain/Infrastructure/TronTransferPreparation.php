<?php

declare(strict_types=1);

namespace App\Blockchain\Infrastructure;

use App\Blockchain\Application\TronClock;
use App\Blockchain\Application\TronProviderFailed;
use App\Blockchain\Application\TronTransferIntent;

final readonly class TronTransferPreparation
{
    public function __construct(private TronRpcClient $rpc, private TronClock $clock)
    {
    }

    /** @param array<string,mixed> $input
     * @return array<string,mixed>
     */
    public function prepare(array $input): array
    {
        $intent = new TronTransferIntent($input);
        $this->rpc->assertMainnet();
        $block = $this->rpc->read('/walletsolidity/getnowblock');
        $id = $block['blockID'] ?? null;
        $number = TronProviderData::integer($block['block_header']['raw_data']['number'] ?? null);
        $timestamp = TronProviderData::integer($block['block_header']['raw_data']['timestamp'] ?? null, \PHP_INT_MAX - 600000);
        // Match the browser's two-minute reference age and 15-second future-skew policy.
        if (!\is_string($id) || !preg_match('/^[0-9a-f]{64}$/', $id) || substr($id, 0, 16) !== str_pad(dechex($number), 16, '0', \STR_PAD_LEFT) || $timestamp < $this->clock->nowMs() - 120000 || $timestamp > $this->clock->nowMs() + 15000) {
            throw new TronProviderFailed();
        }
        $sender = $this->rpc->read('/wallet/getaccount', ['address' => $intent->from->hex, 'visible' => false]);
        if (!TronProviderData::account($sender, $intent->from)) {
            throw new TronProviderFailed('sender_inactive');
        }
        $trx = TronProviderData::integer($sender['balance'] ?? 0);
        $resources = $this->rpc->read('/wallet/getaccountresource', ['address' => $intent->from->hex, 'visible' => false]);
        if ([] === $resources) {
            throw new TronProviderFailed();
        }
        $resourceFields = ['EnergyLimit', 'EnergyUsed', 'NetLimit', 'NetUsed', 'freeNetLimit', 'freeNetUsed', 'TotalNetLimit', 'TotalNetWeight', 'TotalEnergyLimit', 'TotalEnergyWeight'];
        if ([] === array_intersect(array_keys($resources), $resourceFields)) {
            throw new TronProviderFailed();
        }
        foreach ($resourceFields as $key) {
            if (\array_key_exists($key, $resources)) {
                TronProviderData::integer($resources[$key]);
            }
        }
        $parameters = $this->rpc->read('/wallet/getchainparameters');
        $fees = [];
        if (!\is_array($parameters['chainParameter'] ?? null)) {
            throw new TronProviderFailed();
        }
        foreach ($parameters['chainParameter'] as $parameter) {
            if (!\is_array($parameter) || !\is_string($parameter['key'] ?? null)) {
                throw new TronProviderFailed();
            }
            $key = $parameter['key'];
            if (\in_array($key, ['getEnergyFee', 'getTransactionFee', 'getMaxFeeLimit'], true)) {
                if (isset($fees[$key])) {
                    throw new TronProviderFailed();
                }
                $fees[$key] = TronProviderData::integer($parameter['value'] ?? null, 15000000000);
            }
        }
        foreach (['getEnergyFee', 'getTransactionFee', 'getMaxFeeLimit'] as $key) {
            if (($fees[$key] ?? 0) === 0) {
                throw new TronProviderFailed();
            }
        }
        $energyCall = $this->rpc->read('/wallet/triggerconstantcontract', [
            'owner_address' => $intent->from->hex, 'contract_address' => TronUsdtBalance::CONTRACT_HEX,
            'function_selector' => 'transfer(address,uint256)', 'parameter' => $intent->parameterHex(),
            'visible' => false,
        ]);
        if (($energyCall['result']['result'] ?? null) !== true || ($energyCall['constant_result'] ?? null) !== [str_repeat('0', 63).'1']) {
            throw new TronProviderFailed('transfer_estimation_failed');
        }
        $energy = TronProviderData::integer($energyCall['energy_used'] ?? null, 1000000000);
        if (0 === $energy || $energy > intdiv(15000000000, $fees['getEnergyFee'])) {
            throw new TronProviderFailed('fee_limit_exceeded');
        }
        // Conservative policy: 20% energy margin; do not promise staked resources remain available.
        $feeLimit = intdiv($energy * $fees['getEnergyFee'] * 120 + 99, 100);
        // 100 TRX is the browser wallet's explicit fee-limit ceiling, not a protocol constant.
        if ($feeLimit > min($fees['getMaxFeeLimit'], 100000000)) {
            throw new TronProviderFailed('fee_limit_exceeded');
        }
        $balance = (new TronUsdtBalance($this->rpc))->read($intent->from->base58);
        if (\strlen($intent->amount) > \strlen($balance) || (\strlen($intent->amount) === \strlen($balance) && strcmp($intent->amount, $balance) > 0)) {
            throw new TronProviderFailed('insufficient_token_balance');
        }
        // Single-signature browser transaction is bounded below 1000 bytes.
        if ($trx < $feeLimit + 1000 * $fees['getTransactionFee']) {
            throw new TronProviderFailed('insufficient_trx_balance');
        }
        $recipient = $this->rpc->read('/wallet/getaccount', ['address' => $intent->to->hex, 'visible' => false]);

        return [
            'chain' => 'tron', 'network' => 'mainnet', 'networkId' => 'tron-mainnet',
            'assetRouteId' => TronTransferIntent::ROUTE,
            'from' => $intent->from->base58, 'to' => $intent->to->base58, 'amountBaseUnits' => $intent->amount,
            'contractAddress' => TronUsdtBalance::CONTRACT, 'decimals' => 6,
            'refBlockBytesHex' => substr(str_pad(dechex($number), 16, '0', \STR_PAD_LEFT), -4),
            'refBlockHashHex' => substr($id, 16, 16), 'refBlockNumber' => (string) $number, 'refBlockId' => $id,
            'timestampMs' => (string) $timestamp, 'expirationMs' => (string) ($timestamp + 600000),
            'feeLimitSun' => (string) $feeLimit, 'energyEstimate' => (string) $energy,
            'energyPriceSun' => (string) $fees['getEnergyFee'], 'bandwidthPriceSun' => (string) $fees['getTransactionFee'],
            'senderTrxSun' => (string) $trx, 'senderTokenBalanceBaseUnits' => $balance,
            'recipientActive' => TronProviderData::account($recipient, $intent->to),
        ];
    }
}
