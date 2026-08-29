<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

use App\Blockchain\Domain\BitcoinAddress;
use App\Blockchain\Domain\BitcoinUtxo;

final readonly class GetBitcoinAddressUtxos
{
    public function __construct(private ChainAdapterRegistry $adapters)
    {
    }

    /**
     * @return list<BitcoinUtxo>
     */
    public function __invoke(string $address): array
    {
        $address = BitcoinAddress::fromString($address);
        $capability = $this->adapters->requireCapability('bitcoin', 'mainnet', UtxoLookupCapability::class);
        $bitcoinUtxos = [];

        foreach ($capability->getConfirmedUtxos($address->value) as $utxo) {
            if (!$utxo instanceof BitcoinUtxo) {
                throw new \LogicException('Bitcoin adapter returned a non-Bitcoin UTXO.');
            }

            $bitcoinUtxos[] = $utxo;
        }

        return $bitcoinUtxos;
    }
}
