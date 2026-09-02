<?php

declare(strict_types=1);

namespace App\Blockchain\Infrastructure;

use App\Blockchain\Application\BalanceLookupFailed;
use App\Blockchain\Application\DogecoinBalanceProvider;
use App\Blockchain\Domain\AddressBalance;
use App\Blockchain\Domain\DogecoinAddress;

final readonly class BlockCypherDogecoinBalanceProvider implements DogecoinBalanceProvider
{
    private const string ENDPOINT = 'https://api.blockcypher.com/v1/doge/main/addrs/%s/balance';

    public function __construct(private ProviderRequestLogger $logger)
    {
    }

    public function getConfirmedBalance(DogecoinAddress $address): AddressBalance
    {
        $startedAt = hrtime(true);
        $maskedAddress = ProviderRequestLogger::maskedAddress($address->value);
        $url = \sprintf(self::ENDPOINT, rawurlencode($address->value));
        $http_response_header = [];

        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'timeout' => 10,
                'ignore_errors' => true,
                'header' => "Accept: application/json\r\nUser-Agent: chain-courier/0.1\r\n",
            ],
        ]);

        $payload = @file_get_contents($url, false, $context);
        $status = self::statusCode($http_response_header);
        $durationMs = self::durationMs($startedAt);

        if (false === $payload) {
            $this->logger->error([
                'provider' => 'blockcypher',
                'operation' => 'balance',
                'reason' => 'provider_transport_failed',
                'address' => $maskedAddress,
                'http_status' => $status,
                'duration_ms' => $durationMs,
            ]);

            throw new BalanceLookupFailed('provider_transport_failed', $status);
        }

        try {
            $decoded = json_decode($payload, true, 512, \JSON_THROW_ON_ERROR);
        } catch (\JsonException $exception) {
            $this->logger->error([
                'provider' => 'blockcypher',
                'operation' => 'balance',
                'reason' => 'provider_invalid_json',
                'address' => $maskedAddress,
                'http_status' => $status,
                'duration_ms' => $durationMs,
            ]);

            throw new BalanceLookupFailed('provider_invalid_json', $status, $exception);
        }

        if (404 === $status && self::isUnseenAddressResponse($decoded)) {
            return new AddressBalance($address->value, 0);
        }

        if (null !== $status && $status >= 400) {
            $reason = 429 === $status ? 'provider_rate_limited' : 'provider_http_error';
            $providerError = self::providerError($decoded);

            $this->logger->warning([
                'provider' => 'blockcypher',
                'operation' => 'balance',
                'reason' => $reason,
                'address' => $maskedAddress,
                'http_status' => $status,
                'duration_ms' => $durationMs,
                'provider_error' => $providerError,
            ]);

            throw new BalanceLookupFailed($reason, $status);
        }

        if (!\is_array($decoded) || ($decoded['address'] ?? null) !== $address->value) {
            $this->logger->error([
                'provider' => 'blockcypher',
                'operation' => 'balance',
                'reason' => 'provider_unexpected_response',
                'address' => $maskedAddress,
                'http_status' => $status,
                'duration_ms' => $durationMs,
            ]);

            throw new BalanceLookupFailed('provider_unexpected_response', $status);
        }

        $balance = $decoded['balance'] ?? null;
        if (!\is_int($balance) || $balance < 0) {
            $this->logger->error([
                'provider' => 'blockcypher',
                'operation' => 'balance',
                'reason' => 'provider_invalid_balance',
                'address' => $maskedAddress,
                'http_status' => $status,
                'duration_ms' => $durationMs,
            ]);

            throw new BalanceLookupFailed('provider_invalid_balance', $status);
        }

        return new AddressBalance($address->value, $balance);
    }

    /**
     * @param list<string> $headers
     */
    private static function statusCode(array $headers): ?int
    {
        $statusLine = $headers[0] ?? null;
        if (null === $statusLine || 1 !== preg_match('/^HTTP\/\S+\s+(\d{3})/', $statusLine, $matches)) {
            return null;
        }

        return (int) $matches[1];
    }

    private static function durationMs(int $startedAt): float
    {
        return round((hrtime(true) - $startedAt) / 1_000_000, 2);
    }

    private static function isUnseenAddressResponse(mixed $decoded): bool
    {
        $error = self::providerError($decoded);
        if (null === $error) {
            return false;
        }

        $normalized = strtolower($error);

        return str_contains($normalized, 'address')
            && (str_contains($normalized, 'not found') || str_contains($normalized, 'unsupported'));
    }

    private static function providerError(mixed $decoded): ?string
    {
        if (!\is_array($decoded)) {
            return null;
        }

        $error = $decoded['error'] ?? null;

        return \is_string($error) ? $error : null;
    }
}
