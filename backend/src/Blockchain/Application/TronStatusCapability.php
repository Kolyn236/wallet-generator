<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

interface TronStatusCapability
{
    /** @return array<string,mixed> */
    public function transactionStatus(string $txId): array;
}
