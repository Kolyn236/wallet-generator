<?php

declare(strict_types=1);

namespace App\Blockchain\Domain;

final readonly class EthereumAddress
{
    private function __construct(public string $value)
    {
    }

    public static function fromString(string $value): self
    {
        if (1 !== preg_match('/^0x[0-9a-fA-F]{40}$/', $value)) {
            throw new \InvalidArgumentException('Invalid Ethereum address.');
        }

        return new self($value);
    }
}
