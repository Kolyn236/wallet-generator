<?php

declare(strict_types=1);

namespace App\Blockchain\Infrastructure;

use App\Blockchain\Application\TronClock;

final class TronSystemClock implements TronClock
{
    public function nowMs(): int
    {
        return (int) (new \DateTimeImmutable())->format('Uv');
    }
}
