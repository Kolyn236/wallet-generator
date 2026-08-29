<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

final readonly class UtxoFeeRate
{
    public function __construct(
        public string $kind,
        public string $recommendedRate,
        public string $unit,
    ) {
        if ('' === $kind || '' === $recommendedRate || '' === $unit) {
            throw new \InvalidArgumentException('UTXO fee-rate metadata cannot contain empty values.');
        }
    }
}
