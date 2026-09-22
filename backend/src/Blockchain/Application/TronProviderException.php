<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

final class TronProviderException extends \RuntimeException
{
    public function __construct(string $message, public readonly bool $retryable = false, public readonly string $codeName = 'PROVIDER_INVALID_RESPONSE')
    { parent::__construct($message); }
}
