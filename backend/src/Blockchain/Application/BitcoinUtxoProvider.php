<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

use App\Blockchain\Domain\BitcoinAddress;
use App\Blockchain\Domain\BitcoinUtxo;

interface BitcoinUtxoProvider
{
    /**
     * @return list<BitcoinUtxo>
     */
    public function getConfirmedUtxos(BitcoinAddress $address): array;
}
