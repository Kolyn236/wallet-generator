<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

use App\Blockchain\Domain\EthereumAddress;
use App\Blockchain\Domain\EvmQuantity;

final readonly class EthereumAddressBalance
{
    public string $address;
    public string $balanceWei;

    public function __construct(string $address, string $balanceWei)
    {
        $this->address = EthereumAddress::fromString($address)->value;
        $this->balanceWei = EvmQuantity::fromDecimal($balanceWei)->decimal;
    }

    public function decimal(): string
    {
        $padded = str_pad($this->balanceWei, 19, '0', \STR_PAD_LEFT);
        $integer = substr($padded, 0, -18);
        $fraction = rtrim(substr($padded, -18), '0');

        return '' === $fraction ? $integer : $integer.'.'.$fraction;
    }
}
