<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

interface Erc20BalanceCapability
{
    public function erc20Balance(string $contractAddress, string $holderAddress): string;
}
