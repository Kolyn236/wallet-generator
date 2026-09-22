<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

use App\Blockchain\Domain\TronAddress;

final readonly class TronTransferService
{
    public const NETWORK_ID = 'tron-mainnet';
    public const ROUTE_ID = 'usdt-tron-mainnet-trc20';
    public const CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
    public const CONTRACT_HEX = '41a614f803b6fd780986a42c78ec9c7f77e6ded13c';
    public const DECIMALS = 6;

    public function __construct(private TronReadProvider $provider)
    {
    }

    /** @return array<string,mixed> */
    public function balance(string $address): array
    {
        $parsed = TronAddress::fromString($address);
        $balance = $this->provider->tokenBalance(self::CONTRACT_HEX, $parsed->hex);
        self::decimal($balance);
        return [
            'networkId' => self::NETWORK_ID, 'assetRouteId' => self::ROUTE_ID,
            'address' => $parsed->base58, 'balanceBaseUnits' => $balance,
            'decimals' => self::DECIMALS, 'contractAddress' => self::CONTRACT,
            'observedAt' => (new \DateTimeImmutable())->format(DATE_ATOM),
        ];
    }

    /** @param array<string,mixed> $input @return array<string,mixed> */
    public function prepare(array $input): array
    {
        self::fields($input, ['assetRouteId', 'from', 'to', 'amountBaseUnits']);
        if ($input['assetRouteId'] !== self::ROUTE_ID) throw new \InvalidArgumentException('invalid route');
        $from = TronAddress::fromString($input['from']);
        $to = TronAddress::fromString($input['to']);
        $amount = self::decimal($input['amountBaseUnits']);
        if ($amount === '0' || self::greaterThanMaxUint256($amount)) throw new \InvalidArgumentException('invalid amount');
        $data = 'a9059cbb'.str_repeat('0', 24).$to->payloadHex().str_pad(self::decimalToHex($amount), 64, '0', STR_PAD_LEFT);
        $now = (int) floor(microtime(true) * 1000);
        $expiration = $now + 600000;
        $account = $this->provider->account($from->hex);
        $resources = $this->provider->accountResources($from->hex);
        $feeLimit = 1000000000;
        $provider = $this->provider->prepareTransfer($from->hex, self::CONTRACT_HEX, $data, $expiration, $now, $feeLimit);
        $tx = is_array($provider['transaction'] ?? null) ? $provider['transaction'] : $provider;
        $raw = $tx['raw_data_hex'] ?? ($tx['rawDataHex'] ?? null);
        if (!is_string($raw) || !preg_match('/^[0-9a-fA-F]+$/', $raw) || strlen($raw) > 131072) {
            throw new TronProviderException('Provider returned invalid transaction.', false, 'PROVIDER_INVALID_RESPONSE');
        }
        $raw = strtolower($raw);
        $energy = $provider['energy_used'] ?? $provider['energyEstimate'] ?? null;
        $active = is_array($this->provider->account($to->hex)) && $this->provider->account($to->hex) !== [];
        return [
            'networkId' => self::NETWORK_ID, 'assetRouteId' => self::ROUTE_ID,
            'intent' => ['from'=>$from->base58, 'to'=>$to->base58, 'amountBaseUnits'=>$amount, 'contractAddress'=>self::CONTRACT, 'decimals'=>self::DECIMALS],
            'rawDataHex' => $raw, 'rawDataBytesHash' => hash('sha256', hex2bin($raw)),
            'refBlockBytesHex' => self::stringField($tx, 'ref_block_bytes', ''),
            'refBlockHashHex' => self::stringField($tx, 'ref_block_hash', ''),
            'timestampMs' => (string)($tx['raw_data']['timestamp'] ?? $now),
            'expirationMs' => (string)($tx['raw_data']['expiration'] ?? $expiration),
            'feeLimitSun' => (string)($tx['raw_data']['fee_limit'] ?? $feeLimit),
            'bandwidthBytes' => (string)($provider['bandwidth'] ?? 0),
            'energyEstimate' => $energy === null ? null : self::decimal((string)$energy),
            'senderTrxSun' => self::decimal((string)($account['balance'] ?? 0)),
            'recipientActive' => $active, 'accountActivationRequired' => !$active,
            'expiresAt' => (new \DateTimeImmutable('@'.(int) floor($expiration / 1000)))->format(DATE_ATOM),
        ];
    }

    /** @param array<string,mixed> $input @return array<string,mixed> */
    public function broadcast(array $input): array
    {
        self::fields($input, ['assetRouteId', 'txId', 'rawTransactionHex']);
        if ($input['assetRouteId'] !== self::ROUTE_ID || !preg_match('/^[0-9a-fA-F]+$/', $input['rawTransactionHex']) || !preg_match('/^[0-9a-f]{64}$/', $input['txId'])) throw new \InvalidArgumentException('invalid broadcast');
        $result = $this->provider->broadcast(strtolower($input['rawTransactionHex']));
        $providerId = $result['txid'] ?? $result['txID'] ?? null;
        if ($providerId !== null && strtolower((string)$providerId) !== strtolower($input['txId'])) throw new TronProviderException('Provider transaction identity mismatch.', false, 'PROVIDER_INVALID_RESPONSE');
        $accepted = ($result['result'] ?? false) === true || ($result['code'] ?? '') === 'SUCCESS';
        return ['networkId'=>self::NETWORK_ID, 'assetRouteId'=>self::ROUTE_ID, 'txId'=>strtolower($input['txId']), 'state'=>$accepted ? 'accepted-for-broadcast' : 'rejected', ...($result['code'] ?? null) !== null ? ['providerCode'=>(string)$result['code']] : []];
    }

    /** @return array<string,mixed> */
    public function status(string $txId): array
    {
        if (!preg_match('/^[0-9a-fA-F]{64}$/', $txId)) throw new \InvalidArgumentException('invalid txid');
        $tx = $this->provider->transactionById(strtolower($txId));
        $info = $this->provider->transactionInfoById(strtolower($txId));
        $confirmed = isset($info['blockNumber']) || isset($info['block_num']);
        $receipt = $info['receipt']['result'] ?? null;
        $state = $receipt === 'SUCCESS' ? 'executed-success' : ($receipt !== null ? 'executed-failure' : ($confirmed ? 'included-solidified' : 'submitted'));
        return ['networkId'=>self::NETWORK_ID, 'txId'=>strtolower($txId), 'state'=>$state, ...($info['blockNumber'] ?? $info['block_num'] ?? null) !== null ? ['blockNumber'=>(string)($info['blockNumber'] ?? $info['block_num'])] : []];
    }

    /** @param array<string,mixed> $value */
    private static function fields(array $value, array $allowed): void
    { if (array_diff(array_keys($value), $allowed) !== [] || array_diff($allowed, array_keys($value)) !== []) throw new \InvalidArgumentException('invalid request'); foreach ($value as $item) if (!is_string($item)) throw new \InvalidArgumentException('invalid request'); }
    private static function decimal(string $value): string
    { if (!preg_match('/^(0|[1-9][0-9]*)$/', $value)) throw new \InvalidArgumentException('invalid integer'); return $value; }
    private static function greaterThanMaxUint256(string $value): bool
    { $max='115792089237316195423570985008687907853269984665640564039457584007913129639935'; return strlen($value)>strlen($max) || (strlen($value)===strlen($max) && strcmp($value,$max)>0); }
    private static function decimalToHex(string $value): string
    { $out=''; while ($value !== '0') { $carry=0; $next=''; foreach (str_split($value) as $digit) { $n=$carry*10+(int)$digit; $q=intdiv($n,16); $carry=$n%16; if ($next!==''||$q>0) $next.=(string)$q; } $out=dechex($carry).$out; $value=$next===''?'0':$next; } return $out===''?'0':$out; }
    /** @param array<string,mixed> $array */ private static function stringField(array $array, string $key, string $default): string { return is_string($array[$key] ?? null) ? strtolower($array[$key]) : $default; }
}
