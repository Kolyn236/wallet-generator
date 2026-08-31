<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

use App\Blockchain\Domain\AddressBalance;
use App\Blockchain\Domain\BitcoinAddress;

final readonly class GetBitcoinAddressBalance
{
    public function __construct(private ChainAdapterRegistry $adapters)
    {
    }

    public function __invoke(string $address): AddressBalance
    {
        $address = BitcoinAddress::fromString($address);
        $capability = $this->adapters->requireCapability('bitcoin', 'mainnet', AddressBalanceCapability::class);

        return $capability->getConfirmedBalance($address->value);
    }
}
