<?php

declare(strict_types=1);

namespace App\Blockchain\Domain;

final readonly class EvmQuantity
{
    private function __construct(public string $decimal)
    {
    }

    public static function fromDecimal(string $value): self
    {
        if (1 !== preg_match('/^(?:0|[1-9][0-9]*)$/', $value)) {
            throw new \InvalidArgumentException('EVM quantity must be a canonical non-negative decimal integer string.');
        }

        return new self($value);
    }

    public static function fromHex(string $value): self
    {
        if (1 !== preg_match('/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/', $value)) {
            throw new \InvalidArgumentException('EVM quantity must be a canonical hexadecimal quantity.');
        }

        return new self(gmp_strval(gmp_init(substr($value, 2), 16), 10));
    }

    public function toHex(): string
    {
        return '0x'.gmp_strval(gmp_init($this->decimal, 10), 16);
    }

    public function doubledPlus(self $other): self
    {
        $value = gmp_add(gmp_mul(gmp_init($this->decimal, 10), 2), gmp_init($other->decimal, 10));

        return new self(gmp_strval($value, 10));
    }
}
