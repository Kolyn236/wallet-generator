<?php

declare(strict_types=1);

namespace App\Blockchain\Infrastructure;

use App\Blockchain\Application\BitcoinTransactionBroadcaster;
use App\Blockchain\Application\BroadcastFailed;
use App\Blockchain\Domain\BitcoinRawTransaction;

final readonly class BlockCypherBitcoinTransactionBroadcaster implements BitcoinTransactionBroadcaster
{
    private const string ENDPOINT = 'https://api.blockcypher.com/v1/btc/main/txs/push';
    private const int MAX_LOGGED_RESPONSE_BYTES = 4096;

    public function __construct(private ProviderRequestLogger $logger)
    {
    }

    public function broadcast(BitcoinRawTransaction $transaction): string
    {
        $startedAt = hrtime(true);
        $http_response_header = [];
        $body = json_encode(['tx' => $transaction->hex], \JSON_THROW_ON_ERROR);
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'timeout' => 15,
                'ignore_errors' => true,
                'header' => "Accept: application/json\r\nContent-Type: application/json\r\nUser-Agent: wallet-platform/0.1\r\n",
                'content' => $body,
            ],
        ]);

        $payload = @file_get_contents(self::ENDPOINT, false, $context);
        $status = self::statusCode($http_response_header);
        $durationMs = self::durationMs($startedAt);

        if (false === $payload) {
            $this->logger->error([
                'provider' => 'blockcypher',
                'chain' => 'bitcoin',
                'operation' => 'broadcast',
                'reason' => 'provider_transport_failed',
                'txid' => $transaction->txid,
                'http_status' => $status,
                'duration_ms' => $durationMs,
            ]);
            throw new BroadcastFailed('provider_transport_failed', $status);
        }

        try {
            $decoded = json_decode($payload, true, 512, \JSON_THROW_ON_ERROR);
        } catch (\JsonException $exception) {
            throw new BroadcastFailed('provider_invalid_json', $status, $exception);
        }

        if (null !== $status && $status >= 400) {
            $reason = 429 === $status ? 'provider_rate_limited' : 'provider_rejected_transaction';
            $this->logger->warning([
                'provider' => 'blockcypher',
                'chain' => 'bitcoin',
                'operation' => 'broadcast',
                'reason' => $reason,
                'txid' => $transaction->txid,
                'http_status' => $status,
                'duration_ms' => $durationMs,
                'provider_error' => self::providerError($decoded),
                'response_body' => self::loggableResponse($payload),
            ]);
            throw new BroadcastFailed($reason, $status);
        }

        if (!\is_array($decoded)) {
            throw new BroadcastFailed('provider_unexpected_response', $status);
        }

        $providerTxid = BlockCypherBroadcastResponse::txid($decoded);
        if (null === $providerTxid) {
            throw new BroadcastFailed('provider_invalid_txid', $status);
        }

        $expectedTxid = strtolower($transaction->txid);
        if ($providerTxid !== $expectedTxid) {
            $this->logger->error([
                'provider' => 'blockcypher',
                'chain' => 'bitcoin',
                'operation' => 'broadcast',
                'reason' => 'provider_txid_mismatch',
                'txid' => $expectedTxid,
                'provider_txid' => $providerTxid,
                'http_status' => $status,
                'duration_ms' => $durationMs,
            ]);
            throw new BroadcastFailed('provider_txid_mismatch', $status);
        }

        return $providerTxid;
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

    private static function durationMs(int $startedAt): float
    {
        return round((hrtime(true) - $startedAt) / 1_000_000, 2);
    }

    private static function loggableResponse(string $payload): string
    {
        $payload = trim($payload);
        if (\strlen($payload) <= self::MAX_LOGGED_RESPONSE_BYTES) {
            return $payload;
        }

        return substr($payload, 0, self::MAX_LOGGED_RESPONSE_BYTES).'…';
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
