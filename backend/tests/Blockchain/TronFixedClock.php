<?php

declare(strict_types=1);

namespace App\Tests\Blockchain;

use App\Blockchain\Application\TronClock;

final class TronFixedClock implements TronClock
{
    public function nowMs(): int
    {
        return 1700000000000;
    }
}
