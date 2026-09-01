<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

use App\Blockchain\Domain\EthereumAddress;
use App\Blockchain\Domain\EvmQuantity;

final readonly class Erc20TokenBalance
{
    public string $address;
    public string $balanceSmallestUnit;

    public function __construct(
        string $address,
        string $balanceSmallestUnit,
        public int $decimals,
        public string $symbol,
    ) {
        if ($decimals < 0 || $decimals > 255) {
            throw new \InvalidArgumentException('Invalid ERC-20 decimals.');
        }
        if ('' === $symbol) {
            throw new \InvalidArgumentException('Invalid ERC-20 symbol.');
        }

        $this->address = EthereumAddress::fromString($address)->value;
        $this->balanceSmallestUnit = EvmQuantity::fromDecimal($balanceSmallestUnit)->decimal;
    }

    public function decimal(): string
    {
        if (0 === $this->decimals) {
            return $this->balanceSmallestUnit;
        }

        $padded = str_pad($this->balanceSmallestUnit, $this->decimals + 1, '0', \STR_PAD_LEFT);
        $integer = substr($padded, 0, -$this->decimals);
        $fraction = rtrim(substr($padded, -$this->decimals), '0');

        return '' === $fraction ? $integer : $integer.'.'.$fraction;
    }
}
