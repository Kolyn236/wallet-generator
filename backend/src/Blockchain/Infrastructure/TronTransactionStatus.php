<?php

declare(strict_types=1);

namespace App\Blockchain\Infrastructure;

use App\Blockchain\Application\TronProviderFailed;

final readonly class TronTransactionStatus
{
    private const FAILURE_RESULTS = ['REVERT', 'OUT_OF_ENERGY', 'OUT_OF_TIME', 'ILLEGAL_OPERATION', 'BAD_JUMP_DESTINATION', 'OUT_OF_MEMORY', 'PRECOMPILED_CONTRACT', 'STACK_TOO_SMALL', 'STACK_TOO_LARGE', 'STACK_OVERFLOW', 'JVM_STACK_OVER_FLOW', 'UNKNOWN', 'TRANSFER_FAILED', 'INVALID_CODE'];

    public function __construct(private TronRpcClient $rpc)
    {
    }

    /** @return array<string,mixed> */
    public function read(string $txId): array
    {
        if (1 !== preg_match('/^[0-9a-f]{64}$/', $txId)) {
            throw new \InvalidArgumentException('Invalid transaction identity.');
        }
        $this->rpc->assertMainnet();
        $tx = $this->rpc->read('/wallet/gettransactionbyid', ['value' => $txId]);
        $info = $this->rpc->read('/wallet/gettransactioninfobyid', ['value' => $txId]);
        $solidTx = $this->rpc->read('/walletsolidity/gettransactionbyid', ['value' => $txId]);
        $solidInfo = $this->rpc->read('/walletsolidity/gettransactioninfobyid', ['value' => $txId]);
        foreach ([$tx, $solidTx] as $transaction) {
            $this->validateTransaction($transaction, $txId);
        }
        $this->validateInfo($info, $txId);
        $this->validateInfo($solidInfo, $txId);
        $executionResults = [];
        foreach ([$tx, $solidTx] as $transaction) {
            if (\array_key_exists('ret', $transaction)) {
                if (!\is_array($transaction['ret']) || 1 !== \count($transaction['ret']) || !\is_array($transaction['ret'][0] ?? null)) {
                    throw new TronProviderFailed();
                }
                $value = $transaction['ret'][0]['contractRet'] ?? null;
                if ('SUCCESS' !== $value && !\in_array($value, self::FAILURE_RESULTS, true)) {
                    throw new TronProviderFailed();
                }
                $executionResults[] = $value;
            }
        }
        foreach ([$info, $solidInfo] as $observation) {
            if (isset($observation['receipt']['result'])) {
                $executionResults[] = $observation['receipt']['result'];
            }
        }
        if (\count(array_unique($executionResults)) > 1) {
            throw new TronProviderFailed();
        }
        if ([] !== $info && [] !== $solidInfo && ($info['blockNumber'] !== $solidInfo['blockNumber'] || ($info['receipt']['result'] ?? null) !== ($solidInfo['receipt']['result'] ?? null))) {
            throw new TronProviderFailed();
        }
        $solidified = [] !== $solidTx || [] !== $solidInfo;
        $state = $solidified ? 'included-solidified' : ([] !== $info ? 'included' : ([] !== $tx ? 'observed' : 'unknown'));
        $receipt = $solidInfo['receipt']['result'] ?? null;
        if (null !== $receipt) {
            $state = 'SUCCESS' === $receipt ? 'executed-success' : 'executed-failure';
        }
        $result = ['chain' => 'tron', 'network' => 'mainnet', 'networkId' => 'tron-mainnet', 'txId' => $txId, 'state' => $state, 'solidified' => $solidified];
        $observedInfo = [] !== $solidInfo ? $solidInfo : $info;
        if ([] !== $observedInfo) {
            $result['blockNumber'] = (string) TronProviderData::integer($observedInfo['blockNumber']);
            if (isset($observedInfo['fee'])) {
                $result['feeSun'] = (string) TronProviderData::integer($observedInfo['fee']);
            }
            if (isset($observedInfo['receipt']['energy_usage_total'])) {
                $result['energyUsed'] = (string) TronProviderData::integer($observedInfo['receipt']['energy_usage_total']);
            }
        }
        if ('executed-failure' === $state) {
            $result['failureCode'] = $receipt;
        }

        return $result;
    }

    /** @param array<string,mixed> $tx */
    private function validateTransaction(array $tx, string $txId): void
    {
        if ([] === $tx) {
            return;
        }
        $raw = $tx['raw_data_hex'] ?? null;
        if (($tx['txID'] ?? null) !== $txId || !\is_string($raw) || \strlen($raw) > 131072 || !preg_match('/^(?:[0-9a-fA-F]{2})+$/', $raw)) {
            throw new TronProviderFailed();
        }
        $bytes = hex2bin($raw);
        if (false === $bytes || !hash_equals($txId, hash('sha256', $bytes))) {
            throw new TronProviderFailed();
        }
    }

    /** @param array<string,mixed> $info */
    private function validateInfo(array $info, string $txId): void
    {
        if ([] === $info) {
            return;
        }
        if (($info['id'] ?? null) !== $txId) {
            throw new TronProviderFailed();
        }
        TronProviderData::integer($info['blockNumber'] ?? null);
        if (\array_key_exists('receipt', $info)) {
            if (!\is_array($info['receipt'])) {
                throw new TronProviderFailed();
            }
            $receipt = $info['receipt']['result'] ?? null;
            if (null !== $receipt && 'SUCCESS' !== $receipt && !\in_array($receipt, self::FAILURE_RESULTS, true)) {
                throw new TronProviderFailed();
            }
        }
        if (isset($info['result']) && 'FAILED' !== $info['result']) {
            throw new TronProviderFailed();
        }
        if (($info['result'] ?? null) === 'FAILED' && ($info['receipt']['result'] ?? null) === 'SUCCESS') {
            throw new TronProviderFailed();
        }
    }
}
