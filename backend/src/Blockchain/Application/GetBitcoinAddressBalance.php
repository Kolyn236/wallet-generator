<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

use App\Blockchain\Domain\AddressBalance;
use App\Blockchain\Domain\BitcoinAddress;

final readonly class GetBitcoinAddressBalance
{
    public function __construct(private BitcoinBalanceProvider $provider)
    {
    }

    public function __invoke(string $address): AddressBalance
    {
        return $this->provider->getConfirmedBalance(BitcoinAddress::fromString($address));
    }
}
