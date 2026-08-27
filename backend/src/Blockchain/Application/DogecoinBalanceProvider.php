<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

use App\Blockchain\Domain\AddressBalance;

interface DogecoinBalanceProvider
{
    public function getConfirmedBalance(string $address): AddressBalance;
}
