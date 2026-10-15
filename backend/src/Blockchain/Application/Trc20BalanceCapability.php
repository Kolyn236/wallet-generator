<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

interface Trc20BalanceCapability
{
    public function trc20Balance(string $contractAddress, string $holderAddress): string;
}
