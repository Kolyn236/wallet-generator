<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

use App\Blockchain\Domain\BitcoinRawTransaction;

interface BitcoinTransactionBroadcaster
{
    public function broadcast(BitcoinRawTransaction $transaction): string;
}
