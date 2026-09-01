<?php

declare(strict_types=1);

namespace App\Blockchain\Domain;

final readonly class LegacyUtxo
{
    public function __construct(
        public string $txid,
        public int $vout,
        public int $valueSmallestUnit,
        public string $scriptPubKey,
        public int $confirmations,
    ) {
        if (1 !== preg_match('/^[0-9a-f]{64}$/', $txid)) {
            throw new \InvalidArgumentException('Invalid UTXO transaction id.');
        }
        if ($vout < 0 || $valueSmallestUnit <= 0 || $confirmations < 1) {
            throw new \InvalidArgumentException('Invalid confirmed UTXO metadata.');
        }
        if ('' === $scriptPubKey || 0 !== \strlen($scriptPubKey) % 2 || 1 !== preg_match('/^[0-9a-f]+$/', $scriptPubKey)) {
            throw new \InvalidArgumentException('Invalid UTXO script.');
        }
    }
}
