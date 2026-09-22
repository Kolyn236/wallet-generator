<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

/** Fail-closed validation for the single TRC-20 TriggerSmartContract we support. */
final class TronTransactionValidator
{
    /** @param array<string,mixed> $transaction */
    public function validatePrepared(array $transaction, string $expectedRawDataHex, string $ownerHex, string $contractHex, string $dataHex, int $nowMs, int $expirationMs, int $feeLimit): void
    {
        $raw = $transaction['raw_data'] ?? null;
        $rawHex = $transaction['raw_data_hex'] ?? null;
        if (!is_array($raw) || !is_string($rawHex) || strlen($rawHex) > 131072 || !preg_match('/^[0-9a-f]{2,65535}$/i', $rawHex)) {
            throw new TronProviderException('Provider returned a non-canonical transaction.', false, 'PROVIDER_INVALID_RESPONSE');
        }
        if (count($raw['contract'] ?? []) !== 1 || ($raw['contract'][0]['type'] ?? null) !== 'TriggerSmartContract') {
            throw new TronProviderException('Provider returned an unsupported contract.', false, 'PROVIDER_INVALID_RESPONSE');
        }
        $value = $raw['contract'][0]['parameter']['value'] ?? null;
        if (!is_array($value) || ($value['owner_address'] ?? null) !== $ownerHex || ($value['contract_address'] ?? null) !== $contractHex || ($value['data'] ?? null) !== $dataHex || (string)($value['call_value'] ?? '0') !== '0') {
            throw new TronProviderException('Provider transaction intent mismatch.', false, 'PROVIDER_INVALID_RESPONSE');
        }
        foreach (['ref_block_bytes', 'ref_block_hash'] as $field) if (!is_string($raw[$field] ?? null) || !preg_match('/^[0-9a-f]{2,16}$/i', $raw[$field])) throw new TronProviderException('Provider returned invalid TAPOS data.', false, 'PROVIDER_INVALID_RESPONSE');
        $timestamp = $raw['timestamp'] ?? null; $expiration = $raw['expiration'] ?? null; $fee = $raw['fee_limit'] ?? null;
        if ((!is_int($timestamp) && !ctype_digit((string)$timestamp)) || (!is_int($expiration) && !ctype_digit((string)$expiration)) || (!is_int($fee) && !ctype_digit((string)$fee)) || (int)$expiration <= (int)$timestamp || (int)$expiration - (int)$timestamp > 600000 || (int)$fee < 1 || (int)$fee > $feeLimit) throw new TronProviderException('Provider returned invalid transaction bounds.', false, 'PROVIDER_INVALID_RESPONSE');
    }
}
