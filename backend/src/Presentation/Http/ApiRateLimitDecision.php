<?php

declare(strict_types=1);

namespace App\Presentation\Http;

final readonly class ApiRateLimitDecision
{
    public function __construct(
        public bool $accepted,
        public int $retryAfterSeconds,
    ) {
    }
}
