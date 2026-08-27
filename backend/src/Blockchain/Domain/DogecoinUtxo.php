<?php

declare(strict_types=1);

namespace App\Blockchain\Domain;

final readonly class DogecoinUtxo
{
    public function __construct(
        public string $txid,
        public int $vout,
        public int $valueSmallestUnit,
        public string $scriptPubKey,
        public int $confirmations,
    ) {
        if (1 !== preg_match('/^[0-9a-f]{64}$/', $txid)) {
            throw new \InvalidArgumentException('Invalid Dogecoin UTXO transaction id.');
        }
        if ($vout < 0) {
            throw new \InvalidArgumentException('Dogecoin UTXO output index cannot be negative.');
        }
        if ($valueSmallestUnit <= 0) {
            throw new \InvalidArgumentException('Dogecoin UTXO value must be positive.');
        }
        if ('' === $scriptPubKey || 0 !== \strlen($scriptPubKey) % 2 || 1 !== preg_match('/^[0-9a-f]+$/', $scriptPubKey)) {
            throw new \InvalidArgumentException('Invalid Dogecoin UTXO script.');
        }
        if ($confirmations < 1) {
            throw new \InvalidArgumentException('Only confirmed Dogecoin UTXOs are supported.');
        }
    }
}
