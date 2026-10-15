<?php

declare(strict_types=1);

namespace App\Blockchain\Infrastructure;

use App\Blockchain\Application\TronProviderFailed;

final class NativeTronHttpTransport implements TronHttpTransport
{
    public function post(string $url, string $payload): TronHttpTransportResponse
    {
        if ('' === trim($url) || !\in_array(parse_url($url, \PHP_URL_SCHEME), ['http', 'https'], true)) {
            throw new TronProviderFailed('provider_not_configured');
        }

        $http_response_header = [];
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'timeout' => 10,
                'ignore_errors' => true,
                'header' => "Accept: application/json\r\nContent-Type: application/json\r\nUser-Agent: chain-courier/0.1\r\n",
                'content' => $payload,
            ],
        ]);
        $body = @file_get_contents($url, false, $context);
        $status = self::statusCode($http_response_header);

        if (false === $body) {
            throw new TronProviderFailed('provider_transport_failed', $status);
        }

        return new TronHttpTransportResponse($status, $body);
    }

    /** @param list<string> $headers */
    private static function statusCode(array $headers): ?int
    {
        $statusLine = $headers[0] ?? null;
        if (null === $statusLine || 1 !== preg_match('/^HTTP\/\S+\s+(\d{3})/', $statusLine, $matches)) {
            return null;
        }

        return (int) $matches[1];
    }
}
