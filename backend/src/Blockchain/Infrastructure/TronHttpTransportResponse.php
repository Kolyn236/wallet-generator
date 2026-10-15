<?php

declare(strict_types=1);

namespace App\Blockchain\Infrastructure;

final readonly class TronHttpTransportResponse
{
    public function __construct(
        public ?int $status,
        public string $body,
    ) {
    }
}
