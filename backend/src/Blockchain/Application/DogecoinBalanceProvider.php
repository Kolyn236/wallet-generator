<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

use App\Blockchain\Domain\AddressBalance;
use App\Blockchain\Domain\DogecoinAddress;

interface DogecoinBalanceProvider
{
    public function getConfirmedBalance(DogecoinAddress $address): AddressBalance;
}
