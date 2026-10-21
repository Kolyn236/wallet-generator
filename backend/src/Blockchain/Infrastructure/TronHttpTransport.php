<?php

declare(strict_types=1);

namespace App\Blockchain\Infrastructure;

interface TronHttpTransport
{
    public function post(string $url, string $payload): string;
}
