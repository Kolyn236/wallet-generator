<?php

declare(strict_types=1);

namespace App\Presentation\Http;

interface ApiClock
{
    public function now(): int;
}
