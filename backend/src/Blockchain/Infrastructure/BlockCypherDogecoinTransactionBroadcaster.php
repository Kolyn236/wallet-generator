<?php

declare(strict_types=1);

namespace App\Blockchain\Infrastructure;

use App\Blockchain\Application\BroadcastFailed;
use App\Blockchain\Application\DogecoinTransactionBroadcaster;
use App\Blockchain\Domain\DogecoinRawTransaction;

final readonly class BlockCypherDogecoinTransactionBroadcaster implements DogecoinTransactionBroadcaster
{
    private const string ENDPOINT = 'https://api.blockcypher.com/v1/doge/main/txs/push';

    public function __construct(private ProviderRequestLogger $logger)
    {
    }

    public function broadcast(DogecoinRawTransaction $transaction): string
    {
        $broadcastId = bin2hex(random_bytes(4));
        $startedAt = hrtime(true);
        $http_response_header = [];

        $this->logger->info('dogecoin_broadcast_started', [
            'provider' => 'blockcypher',
            'broadcast_id' => $broadcastId,
            'txid' => $transaction->txid,
            'size_bytes' => $transaction->sizeBytes,
        ]);

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
            $this->logger->error('dogecoin_broadcast_transport_failed', [
                'provider' => 'blockcypher',
                'broadcast_id' => $broadcastId,
                'txid' => $transaction->txid,
                'http_status' => $status,
                'duration_ms' => $durationMs,
            ]);

            throw new BroadcastFailed('provider_transport_failed', $status);
        }

        try {
            $decoded = json_decode($payload, true, 512, \JSON_THROW_ON_ERROR);
        } catch (\JsonException $exception) {
            $this->logger->error('dogecoin_broadcast_invalid_json', [
                'provider' => 'blockcypher',
                'broadcast_id' => $broadcastId,
                'txid' => $transaction->txid,
                'http_status' => $status,
                'duration_ms' => $durationMs,
            ]);

            throw new BroadcastFailed('provider_invalid_json', $status, $exception);
        }

        if (null !== $status && $status >= 400) {
            $reason = 429 === $status ? 'provider_rate_limited' : 'provider_rejected_transaction';

            $this->logger->warning('dogecoin_broadcast_rejected', [
                'provider' => 'blockcypher',
                'broadcast_id' => $broadcastId,
                'txid' => $transaction->txid,
                'http_status' => $status,
                'duration_ms' => $durationMs,
                'provider_error' => self::providerError($decoded),
            ]);

            throw new BroadcastFailed($reason, $status);
        }

        if (!\is_array($decoded)) {
            throw new BroadcastFailed('provider_unexpected_response', $status);
        }

        $providerTx = $decoded['tx'] ?? null;
        $providerTxid = \is_array($providerTx) ? ($providerTx['hash'] ?? null) : null;
        $providerTxid ??= $decoded['hash'] ?? null;

        if (!\is_string($providerTxid) || 1 !== preg_match('/^[0-9a-fA-F]{64}$/', $providerTxid)) {
            throw new BroadcastFailed('provider_invalid_txid', $status);
        }

        $providerTxid = strtolower($providerTxid);
        $expectedTxid = strtolower($transaction->txid);

        if ($providerTxid !== $expectedTxid) {
            $this->logger->error('dogecoin_broadcast_txid_mismatch', [
                'provider' => 'blockcypher',
                'broadcast_id' => $broadcastId,
                'txid' => $expectedTxid,
                'provider_txid' => $providerTxid,
                'http_status' => $status,
                'duration_ms' => $durationMs,
            ]);

            throw new BroadcastFailed('provider_txid_mismatch', $status);
        }

        $this->logger->info('dogecoin_broadcast_succeeded', [
            'provider' => 'blockcypher',
            'broadcast_id' => $broadcastId,
            'txid' => $providerTxid,
            'http_status' => $status,
            'duration_ms' => $durationMs,
        ]);

        return $providerTxid;
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

    private static function providerError(mixed $decoded): ?string
    {
        if (!\is_array($decoded)) {
            return null;
        }

        $error = $decoded['error'] ?? null;

        return \is_string($error) ? $error : null;
    }
}
