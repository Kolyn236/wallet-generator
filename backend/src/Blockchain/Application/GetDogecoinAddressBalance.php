<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

use App\Blockchain\Domain\AddressBalance;
use App\Blockchain\Domain\DogecoinAddress;

final readonly class GetDogecoinAddressBalance
{
    public function __construct(private ChainAdapterRegistry $adapters)
    {
    }

    public function __invoke(string $address): AddressBalance
    {
        $address = DogecoinAddress::fromString($address);
        $capability = $this->adapters->requireCapability('dogecoin', 'mainnet', AddressBalanceCapability::class);

        return $capability->getConfirmedBalance($address->value);
    }
}
