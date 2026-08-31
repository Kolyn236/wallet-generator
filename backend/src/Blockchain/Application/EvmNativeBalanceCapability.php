<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

interface EvmNativeBalanceCapability
{
    public function nativeBalanceWei(string $address): string;
}
