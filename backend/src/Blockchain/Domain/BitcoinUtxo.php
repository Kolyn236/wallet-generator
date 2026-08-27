<?php

declare(strict_types=1);

namespace App\Blockchain\Domain;

final readonly class BitcoinUtxo
{
    public function __construct(
        public string $txid,
        public int $vout,
        public int $valueSmallestUnit,
        public string $scriptPubKey,
        public int $confirmations,
    ) {
        if (1 !== preg_match('/^[0-9a-f]{64}$/', $txid)) {
            throw new \InvalidArgumentException('Invalid Bitcoin UTXO transaction id.');
        }
        if ($vout < 0) {
            throw new \InvalidArgumentException('Bitcoin UTXO output index cannot be negative.');
        }
        if ($valueSmallestUnit <= 0) {
            throw new \InvalidArgumentException('Bitcoin UTXO value must be positive.');
        }
        if ('' === $scriptPubKey || 0 !== \strlen($scriptPubKey) % 2 || 1 !== preg_match('/^[0-9a-f]+$/', $scriptPubKey)) {
            throw new \InvalidArgumentException('Invalid Bitcoin UTXO script.');
        }
        if ($confirmations < 1) {
            throw new \InvalidArgumentException('Only confirmed Bitcoin UTXOs are supported.');
        }
    }
}
