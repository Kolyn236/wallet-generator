<?php

declare(strict_types=1);

namespace App\Blockchain\Infrastructure;

interface EthereumJsonRpcTransport
{
    public function post(string $url, string $payload): EthereumJsonRpcTransportResponse;
}
