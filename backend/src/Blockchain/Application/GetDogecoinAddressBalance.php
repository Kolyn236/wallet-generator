<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

use App\Blockchain\Domain\AddressBalance;
use App\Blockchain\Domain\DogecoinAddress;

final readonly class GetDogecoinAddressBalance
{
    public function __construct(private DogecoinBalanceProvider $provider)
    {
    }

    public function __invoke(string $address): AddressBalance
    {
        return $this->provider->getConfirmedBalance(DogecoinAddress::fromString($address));
    }
}
