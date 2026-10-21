<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

interface TronTokenBalanceCapability
{
    public function tokenBalanceBaseUnits(string $address): string;
}
