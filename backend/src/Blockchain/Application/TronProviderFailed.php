<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

final class TronProviderFailed extends \RuntimeException
{
    public function __construct(
        public readonly string $reason,
        public readonly ?int $httpStatus = null,
        ?\Throwable $previous = null,
    ) {
        parent::__construct($reason, 0, $previous);
    }
}
