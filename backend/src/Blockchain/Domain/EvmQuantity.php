<?php

declare(strict_types=1);

namespace App\Blockchain\Domain;

final readonly class EvmQuantity
{
    private const string HEX_DIGITS = '0123456789abcdef';

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

        $decimal = '0';
        foreach (str_split(substr($value, 2)) as $digit) {
            $decimal = self::multiplyBySmall($decimal, 16);
            $decimal = self::addSmall($decimal, hexdec($digit));
        }

        return new self($decimal);
    }

    public function toHex(): string
    {
        if ('0' === $this->decimal) {
            return '0x0';
        }

        $decimal = $this->decimal;
        $hex = '';

        while ('0' !== $decimal) {
            [$decimal, $remainder] = self::divideBySmall($decimal, 16);
            $hex = self::HEX_DIGITS[$remainder].$hex;
        }

        return '0x'.$hex;
    }

    public function doubledPlus(self $other): self
    {
        return new self(self::add(self::multiplyBySmall($this->decimal, 2), $other->decimal));
    }

    private static function multiplyBySmall(string $value, int $multiplier): string
    {
        $carry = 0;
        $result = '';

        for ($index = strlen($value) - 1; $index >= 0; --$index) {
            $product = ((int) $value[$index] * $multiplier) + $carry;
            $result = (string) ($product % 10).$result;
            $carry = intdiv($product, 10);
        }

        while ($carry > 0) {
            $result = (string) ($carry % 10).$result;
            $carry = intdiv($carry, 10);
        }

        return ltrim($result, '0') ?: '0';
    }

    private static function addSmall(string $value, int $addend): string
    {
        if (0 === $addend) {
            return $value;
        }

        return self::add($value, (string) $addend);
    }

    private static function add(string $left, string $right): string
    {
        $leftIndex = strlen($left) - 1;
        $rightIndex = strlen($right) - 1;
        $carry = 0;
        $result = '';

        while ($leftIndex >= 0 || $rightIndex >= 0 || $carry > 0) {
            $sum = $carry;
            if ($leftIndex >= 0) {
                $sum += (int) $left[$leftIndex--];
            }
            if ($rightIndex >= 0) {
                $sum += (int) $right[$rightIndex--];
            }

            $result = (string) ($sum % 10).$result;
            $carry = intdiv($sum, 10);
        }

        return ltrim($result, '0') ?: '0';
    }

    /** @return array{0: string, 1: int} */
    private static function divideBySmall(string $value, int $divisor): array
    {
        $remainder = 0;
        $quotient = '';

        for ($index = 0, $length = strlen($value); $index < $length; ++$index) {
            $current = ($remainder * 10) + (int) $value[$index];
            $digit = intdiv($current, $divisor);

            if ('' !== $quotient || 0 !== $digit) {
                $quotient .= (string) $digit;
            }

            $remainder = $current % $divisor;
        }

        return ['' === $quotient ? '0' : $quotient, $remainder];
    }
}
