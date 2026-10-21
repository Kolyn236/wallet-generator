<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

final class TronProviderFailed extends \RuntimeException
{
    public function __construct(public readonly string $reason = 'provider_invalid_response')
    {
        parent::__construct($reason);
    }
}
