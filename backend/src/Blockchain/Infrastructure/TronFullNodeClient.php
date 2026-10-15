<?php

declare(strict_types=1);

namespace App\Blockchain\Infrastructure;

use App\Blockchain\Application\TronProviderFailed;
use App\Blockchain\Domain\EvmQuantity;
use App\Blockchain\Domain\TronAddress;

final readonly class TronFullNodeClient
{
    private const string BALANCE_OF_SELECTOR = 'balanceOf(address)';

    public function __construct(
        private string $fullNodeUrl,
        private TronHttpTransport $transport,
        private ProviderRequestLogger $logger,
    ) {
    }

    public function trc20Balance(string $contractAddress, string $holderAddress): string
    {
        $contract = TronAddress::fromString($contractAddress);
        $holder = TronAddress::fromString($holderAddress);
        $parameter = str_pad(substr($holder->hex, 2), 64, '0', \STR_PAD_LEFT);
        $payload = json_encode([
            'owner_address' => $holder->hex,
            'contract_address' => $contract->hex,
            'function_selector' => self::BALANCE_OF_SELECTOR,
            'parameter' => $parameter,
            'visible' => false,
        ], \JSON_THROW_ON_ERROR | \JSON_UNESCAPED_SLASHES);
        $url = rtrim($this->fullNodeUrl, '/').'/wallet/triggerconstantcontract';
        $startedAt = hrtime(true);

        try {
            $response = $this->transport->post($url, $payload);
        } catch (TronProviderFailed $exception) {
            $this->logFailure($exception->reason, $exception->httpStatus, $startedAt);
            throw $exception;
        }

        if (429 === $response->status) {
            $this->fail('provider_rate_limited', $response->status, $startedAt);
        }
        if (null !== $response->status && $response->status >= 400) {
            $this->fail('provider_transport_failed', $response->status, $startedAt);
        }

        try {
            $decoded = json_decode($response->body, true, 32, \JSON_THROW_ON_ERROR);
        } catch (\JsonException $exception) {
            $this->logFailure('provider_invalid_json', $response->status, $startedAt);
            throw new TronProviderFailed('provider_invalid_json', $response->status, $exception);
        }

        $constantResult = \is_array($decoded) ? ($decoded['constant_result'] ?? null) : null;
        if (!\is_array($decoded)
            || !\is_array($decoded['result'] ?? null)
            || true !== ($decoded['result']['result'] ?? null)
            || !\is_array($constantResult)
            || 1 !== \count($constantResult)
            || !\is_string($constantResult[0] ?? null)
            || 1 !== preg_match('/^[0-9a-fA-F]{64}$/', $constantResult[0])
        ) {
            $this->fail('provider_unexpected_response', $response->status, $startedAt);
        }

        $hex = ltrim($constantResult[0], '0');

        try {
            return EvmQuantity::fromHex('0x'.('' === $hex ? '0' : $hex))->decimal;
        } catch (\InvalidArgumentException $exception) {
            $this->logFailure('provider_unexpected_response', $response->status, $startedAt);
            throw new TronProviderFailed('provider_unexpected_response', $response->status, $exception);
        }
    }

    private function fail(string $reason, ?int $status, int $startedAt): never
    {
        $this->logFailure($reason, $status, $startedAt);
        throw new TronProviderFailed($reason, $status);
    }

    private function logFailure(string $reason, ?int $status, int $startedAt): void
    {
        $this->logger->warning([
            'provider' => 'tron-full-node',
            'chain' => 'tron',
            'operation' => 'trc20_balance',
            'reason' => $reason,
            'http_status' => $status,
            'duration_ms' => round((hrtime(true) - $startedAt) / 1_000_000, 2),
        ]);
    }
}
