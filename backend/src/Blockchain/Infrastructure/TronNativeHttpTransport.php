<?php

declare(strict_types=1);

namespace App\Blockchain\Infrastructure;

use App\Blockchain\Application\TronProviderFailed;

final class TronNativeHttpTransport implements TronHttpTransport
{
    public function post(string $url, string $payload): string
    {
        $http_response_header = [];
        $context = stream_context_create(['http' => [
            'method' => 'POST', 'timeout' => 10, 'ignore_errors' => true,
            'follow_location' => 0,
            'header' => "Accept: application/json\r\nContent-Type: application/json\r\n",
            'content' => $payload,
        ]]);
        $body = @file_get_contents($url, false, $context, 0, 1048577);
        $status = preg_match('/^HTTP\/\S+\s+(\d{3})/', $http_response_header[0] ?? '', $matches) ? (int) $matches[1] : 0;
        if (429 === $status) {
            throw new TronProviderFailed('provider_rate_limited');
        }
        if (false === $body || $status < 200 || $status >= 300) {
            throw new TronProviderFailed('provider_unavailable');
        }
        if (\strlen($body) > 1048576) {
            throw new TronProviderFailed();
        }

        return $body;
    }
}
