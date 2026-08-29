<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

use App\Blockchain\Domain\DogecoinAddress;
use App\Blockchain\Domain\DogecoinUtxo;

final readonly class GetDogecoinAddressUtxos
{
    public function __construct(private ChainAdapterRegistry $adapters)
    {
    }

    /**
     * @return list<DogecoinUtxo>
     */
    public function __invoke(string $address): array
    {
        $address = DogecoinAddress::fromString($address);
        $capability = $this->adapters->requireCapability('dogecoin', 'mainnet', UtxoLookupCapability::class);
        $dogecoinUtxos = [];

        foreach ($capability->getConfirmedUtxos($address->value) as $utxo) {
            if (!$utxo instanceof DogecoinUtxo) {
                throw new \LogicException('Dogecoin adapter returned a non-Dogecoin UTXO.');
            }

            $dogecoinUtxos[] = $utxo;
        }

        return $dogecoinUtxos;
    }
}
