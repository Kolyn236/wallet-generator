<?php

declare(strict_types=1);

namespace App\Presentation\Http;

use Symfony\Component\HttpFoundation\Request;

final class ApiAbuseLogger
{
    public function rateLimited(
        Request $request,
        string $route,
        string $operation,
        int $retryAfterSeconds,
        float $durationMs,
    ): void {
        $context = [
            'channel' => 'api_abuse',
            'level' => 'warning',
            'timestamp' => gmdate('c'),
            'operation' => $operation,
            'route' => $route,
            'status' => 429,
            'outcome' => 'limiter_rejected',
            'limiter_rejection' => true,
            'retry_after_seconds' => $retryAfterSeconds,
            'duration_ms' => $durationMs,
            'client' => substr(hash('sha256', $request->getClientIp() ?? 'unknown'), 0, 16),
        ];

        if (1 === preg_match('#^/api/chains/([^/]+)/([^/]+)/#', $request->getPathInfo(), $matches)) {
            $context['chain'] = $matches[1];
            $context['network'] = $matches[2];
        }

        $address = $request->attributes->get('address');
        if (\is_string($address) && '' !== $address) {
            $context['address'] = self::maskedAddress($address);
        }

        $encoded = json_encode($context, \JSON_UNESCAPED_SLASHES | \JSON_UNESCAPED_UNICODE);
        error_log(false === $encoded ? '[api_abuse] log_encoding_failed' : $encoded);
    }

    private static function maskedAddress(string $address): string
    {
        if (\strlen($address) <= 12) {
            return $address;
        }

        return substr($address, 0, 6).'…'.substr($address, -4);
    }
}
