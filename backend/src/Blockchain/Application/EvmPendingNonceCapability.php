<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

interface EvmPendingNonceCapability
{
    public function pendingNonce(string $address): string;
}
