<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

use App\Blockchain\Domain\DogecoinAddress;
use App\Blockchain\Domain\DogecoinUtxo;

final readonly class GetDogecoinAddressUtxos
{
    public function __construct(private DogecoinUtxoProvider $provider)
    {
    }

    /**
     * @return list<DogecoinUtxo>
     */
    public function __invoke(string $address): array
    {
        return $this->provider->getConfirmedUtxos(DogecoinAddress::fromString($address));
    }
}
