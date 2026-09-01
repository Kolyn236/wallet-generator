<?php

declare(strict_types=1);

namespace App\Blockchain\Infrastructure;

use App\Blockchain\Application\BalanceLookupFailed;
use App\Blockchain\Application\BroadcastFailed;
use App\Blockchain\Application\UtxoLookupFailed;
use App\Blockchain\Domain\LegacyUtxo;

final readonly class BlockCypherUtxoMainnetClient
{
    public function __construct(private ProviderRequestLogger $logger)
    {
    }

    public function balance(string $slug, string $chain, string $address): int
    {
        $decoded = $this->get(sprintf('https://api.blockcypher.com/v1/%s/main/addrs/%s/balance', $slug, rawurlencode($address)), $chain, 'balance', $address, BalanceLookupFailed::class);
        if (($decoded['address'] ?? null) !== $address || !is_int($decoded['balance'] ?? null) || $decoded['balance'] < 0) {
            throw new BalanceLookupFailed('provider_unexpected_response');
        }
        return $decoded['balance'];
    }

    /** @return list<LegacyUtxo> */
    public function utxos(string $slug, string $chain, string $address): array
    {
        $decoded = $this->get(sprintf('https://api.blockcypher.com/v1/%s/main/addrs/%s?unspentOnly=true&includeScript=true&confirmations=1&limit=2000', $slug, rawurlencode($address)), $chain, 'utxo_lookup', $address, UtxoLookupFailed::class);
        if (($decoded['address'] ?? null) !== $address || true === ($decoded['hasMore'] ?? false) || !is_array($decoded['txrefs'] ?? [])) {
            throw new UtxoLookupFailed('provider_unexpected_response');
        }
        $result = [];
        foreach ($decoded['txrefs'] as $row) {
            if (!is_array($row) || !is_string($row['tx_hash'] ?? null) || !is_int($row['tx_output_n'] ?? null) || !is_int($row['value'] ?? null) || !is_string($row['script'] ?? null) || !is_int($row['confirmations'] ?? null)) {
                throw new UtxoLookupFailed('provider_invalid_utxos');
            }
            $result[] = new LegacyUtxo(strtolower($row['tx_hash']), $row['tx_output_n'], $row['value'], strtolower($row['script']), $row['confirmations']);
        }
        return $result;
    }

    public function broadcast(string $slug, string $chain, string $rawHex): string
    {
        $rawHex = strtolower(trim($rawHex));
        if ('' === $rawHex || 0 !== strlen($rawHex) % 2 || 1 !== preg_match('/^[0-9a-f]+$/', $rawHex) || strlen($rawHex) > 200000) {
            throw new \InvalidArgumentException('Invalid raw UTXO transaction.');
        }
        $raw = hex2bin($rawHex);
        if (false === $raw) throw new \InvalidArgumentException('Invalid raw UTXO transaction.');
        $expectedTxid = bin2hex(strrev(hash('sha256', hash('sha256', $raw, true), true)));
        $url = sprintf('https://api.blockcypher.com/v1/%s/main/txs/push', $slug);
        $http_response_header = [];
        $payload = @file_get_contents($url, false, stream_context_create(['http' => ['method' => 'POST', 'timeout' => 15, 'ignore_errors' => true, 'header' => "Accept: application/json\r\nContent-Type: application/json\r\nUser-Agent: wallet-platform/0.1\r\n", 'content' => json_encode(['tx' => $rawHex], JSON_THROW_ON_ERROR)]]));
        $status = self::statusCode($http_response_header);
        if (false === $payload) throw new BroadcastFailed('provider_transport_failed', $status);
        try { $decoded = json_decode($payload, true, 512, JSON_THROW_ON_ERROR); } catch (\JsonException $e) { throw new BroadcastFailed('provider_invalid_json', $status, $e); }
        if (null !== $status && $status >= 400) throw new BroadcastFailed(429 === $status ? 'provider_rate_limited' : 'provider_rejected_transaction', $status);
        $providerTxid = is_array($decoded) ? BlockCypherBroadcastResponse::txid($decoded) : null;
        if (null === $providerTxid) throw new BroadcastFailed('provider_invalid_txid', $status);
        if ($providerTxid !== $expectedTxid) throw new BroadcastFailed('provider_txid_mismatch', $status);
        return $providerTxid;
    }

    /** @param class-string<BalanceLookupFailed|UtxoLookupFailed> $exception */
    private function get(string $url, string $chain, string $operation, string $address, string $exception): array
    {
        $http_response_header = [];
        $payload = @file_get_contents($url, false, stream_context_create(['http' => ['method' => 'GET', 'timeout' => 10, 'ignore_errors' => true, 'header' => "Accept: application/json\r\nUser-Agent: wallet-platform/0.1\r\n"]]));
        $status = self::statusCode($http_response_header);
        if (false === $payload) throw new $exception('provider_transport_failed', $status);
        try { $decoded = json_decode($payload, true, 512, JSON_THROW_ON_ERROR); } catch (\JsonException $e) { throw new $exception('provider_invalid_json', $status, $e); }
        if (404 === $status && is_array($decoded) && is_string($decoded['error'] ?? null)) {
            return $operation === 'balance' ? ['address' => $address, 'balance' => 0] : ['address' => $address, 'txrefs' => []];
        }
        if (null !== $status && $status >= 400) throw new $exception(429 === $status ? 'provider_rate_limited' : 'provider_http_error', $status);
        if (!is_array($decoded)) throw new $exception('provider_unexpected_response', $status);
        return $decoded;
    }

    /** @param list<string> $headers */
    private static function statusCode(array $headers): ?int
    {
        $line = $headers[0] ?? null;
        return is_string($line) && 1 === preg_match('/^HTTP\/\S+\s+(\d{3})/', $line, $m) ? (int) $m[1] : null;
    }
}
