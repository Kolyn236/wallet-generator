<?php

declare(strict_types=1);

namespace App\Blockchain\Domain;

final readonly class AddressBalance
{
    public function __construct(
        public string $address,
        public int $smallestUnit,
    ) {
    }

    public function decimal(): string
    {
        $whole = intdiv($this->smallestUnit, 100_000_000);
        $fraction = $this->smallestUnit % 100_000_000;

        return \sprintf('%d.%08d', $whole, $fraction);
    }
}
