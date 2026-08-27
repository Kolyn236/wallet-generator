<?php

declare(strict_types=1);

namespace App\Blockchain\Infrastructure;

use App\Blockchain\Application\DogecoinUtxoProvider;
use App\Blockchain\Application\UtxoLookupFailed;
use App\Blockchain\Domain\DogecoinAddress;
use App\Blockchain\Domain\DogecoinUtxo;

final readonly class BlockCypherDogecoinUtxoProvider implements DogecoinUtxoProvider
{
    private const string ENDPOINT = 'https://api.blockcypher.com/v1/doge/main/addrs/%s?unspentOnly=true&includeScript=true&confirmations=1&limit=2000';

    public function __construct(private ProviderRequestLogger $logger)
    {
    }

    public function getConfirmedUtxos(DogecoinAddress $address): array
    {
        $lookupId = bin2hex(random_bytes(4));
        $startedAt = hrtime(true);
        $maskedAddress = ProviderRequestLogger::maskedAddress($address->value);
        $url = \sprintf(self::ENDPOINT, rawurlencode($address->value));
        $http_response_header = [];

        $this->logger->info('dogecoin_utxo_request_started', [
            'provider' => 'blockcypher',
            'lookup_id' => $lookupId,
            'address' => $maskedAddress,
        ]);

        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'timeout' => 10,
                'ignore_errors' => true,
                'header' => "Accept: application/json\r\nUser-Agent: wallet-platform/0.1\r\n",
            ],
        ]);

        $payload = @file_get_contents($url, false, $context);
        $status = self::statusCode($http_response_header);
        $durationMs = self::durationMs($startedAt);

        if (false === $payload) {
            $this->logger->error('dogecoin_utxo_transport_failed', [
                'provider' => 'blockcypher',
                'lookup_id' => $lookupId,
                'address' => $maskedAddress,
                'http_status' => $status,
                'duration_ms' => $durationMs,
            ]);

            throw new UtxoLookupFailed('provider_transport_failed', $status);
        }

        try {
            $decoded = json_decode($payload, true, 512, \JSON_THROW_ON_ERROR);
        } catch (\JsonException $exception) {
            $this->logger->error('dogecoin_utxo_invalid_json', [
                'provider' => 'blockcypher',
                'lookup_id' => $lookupId,
                'address' => $maskedAddress,
                'http_status' => $status,
                'duration_ms' => $durationMs,
            ]);

            throw new UtxoLookupFailed('provider_invalid_json', $status, $exception);
        }

        if (404 === $status && self::isUnseenAddressResponse($decoded)) {
            $this->logger->info('dogecoin_utxo_address_unseen', [
                'provider' => 'blockcypher',
                'lookup_id' => $lookupId,
                'address' => $maskedAddress,
                'http_status' => $status,
                'duration_ms' => $durationMs,
                'utxo_count' => 0,
            ]);

            return [];
        }

        if (null !== $status && $status >= 400) {
            $reason = 429 === $status ? 'provider_rate_limited' : 'provider_http_error';

            $this->logger->warning('dogecoin_utxo_provider_http_error', [
                'provider' => 'blockcypher',
                'lookup_id' => $lookupId,
                'address' => $maskedAddress,
                'http_status' => $status,
                'duration_ms' => $durationMs,
                'provider_error' => self::providerError($decoded),
            ]);

            throw new UtxoLookupFailed($reason, $status);
        }

        if (!\is_array($decoded) || ($decoded['address'] ?? null) !== $address->value) {
            throw new UtxoLookupFailed('provider_unexpected_response', $status);
        }

        if (($decoded['hasMore'] ?? false) === true) {
            $this->logger->warning('dogecoin_utxo_result_truncated', [
                'provider' => 'blockcypher',
                'lookup_id' => $lookupId,
                'address' => $maskedAddress,
                'http_status' => $status,
                'duration_ms' => $durationMs,
            ]);

            throw new UtxoLookupFailed('provider_utxo_limit_exceeded', $status);
        }

        $txrefs = $decoded['txrefs'] ?? [];
        if (!\is_array($txrefs)) {
            throw new UtxoLookupFailed('provider_invalid_utxos', $status);
        }

        $utxos = [];
        foreach ($txrefs as $txref) {
            if (!\is_array($txref)) {
                throw new UtxoLookupFailed('provider_invalid_utxos', $status);
            }

            $txid = $txref['tx_hash'] ?? null;
            $vout = $txref['tx_output_n'] ?? null;
            $value = $txref['value'] ?? null;
            $script = $txref['script'] ?? null;
            $confirmations = $txref['confirmations'] ?? null;

            if (!\is_string($txid)
                || !\is_int($vout)
                || !\is_int($value)
                || !\is_string($script)
                || !\is_int($confirmations)
            ) {
                throw new UtxoLookupFailed('provider_invalid_utxos', $status);
            }

            try {
                $utxos[] = new DogecoinUtxo(
                    strtolower($txid),
                    $vout,
                    $value,
                    strtolower($script),
                    $confirmations,
                );
            } catch (\InvalidArgumentException $exception) {
                throw new UtxoLookupFailed('provider_invalid_utxos', $status, $exception);
            }
        }

        $this->logger->info('dogecoin_utxo_request_succeeded', [
            'provider' => 'blockcypher',
            'lookup_id' => $lookupId,
            'address' => $maskedAddress,
            'http_status' => $status,
            'duration_ms' => $durationMs,
            'utxo_count' => \count($utxos),
        ]);

        return $utxos;
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
