<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

use App\Blockchain\Domain\AddressBalance;
use App\Blockchain\Domain\BitcoinAddress;

interface BitcoinBalanceProvider
{
    public function getConfirmedBalance(BitcoinAddress $address): AddressBalance;
}
