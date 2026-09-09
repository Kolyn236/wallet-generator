<?php

declare(strict_types=1);

namespace App\Presentation\Http;

final readonly class SystemApiClock implements ApiClock
{
    public function now(): int
    {
        return time();
    }
}
