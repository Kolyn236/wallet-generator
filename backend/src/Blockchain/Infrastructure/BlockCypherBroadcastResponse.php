<?php

declare(strict_types=1);

namespace App\Blockchain\Infrastructure;

final class BlockCypherBroadcastResponse
{
    public static function txid(mixed $decoded): ?string
    {
        if (!\is_array($decoded)) {
            return null;
        }

        $transaction = $decoded['tx'] ?? null;
        $txid = \is_array($transaction) ? ($transaction['hash'] ?? null) : null;
        $txid ??= $decoded['hash'] ?? null;

        if (!\is_string($txid) || 1 !== preg_match('/^[0-9a-fA-F]{64}$/', $txid)) {
            return null;
        }

        return strtolower($txid);
    }
}
