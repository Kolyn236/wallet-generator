<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

use App\Blockchain\Domain\BitcoinAddress;
use App\Blockchain\Domain\BitcoinUtxo;

final readonly class GetBitcoinAddressUtxos
{
    public function __construct(private BitcoinUtxoProvider $provider)
    {
    }

    /**
     * @return list<BitcoinUtxo>
     */
    public function __invoke(string $address): array
    {
        return $this->provider->getConfirmedUtxos(BitcoinAddress::fromString($address));
    }
}
