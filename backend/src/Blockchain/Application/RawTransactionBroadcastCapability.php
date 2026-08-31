<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

interface RawTransactionBroadcastCapability
{
    public function broadcastRawTransaction(string $rawTransaction): string;
}
