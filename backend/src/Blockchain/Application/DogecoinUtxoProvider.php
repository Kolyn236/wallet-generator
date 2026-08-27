<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

use App\Blockchain\Domain\DogecoinAddress;
use App\Blockchain\Domain\DogecoinUtxo;

interface DogecoinUtxoProvider
{
    /**
     * @return list<DogecoinUtxo>
     */
    public function getConfirmedUtxos(DogecoinAddress $address): array;
}
