<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

use App\Blockchain\Domain\AddressBalance;

final readonly class GetDogecoinAddressBalance
{
    public function __construct(private DogecoinBalanceProvider $provider)
    {
    }

    public function __invoke(string $address): AddressBalance
    {
        if (1 !== preg_match('/^D[1-9A-HJ-NP-Za-km-z]{25,34}$/', $address)) {
            throw new \InvalidArgumentException('Invalid Dogecoin address format.');
        }

        return $this->provider->getConfirmedBalance($address);
    }
}
