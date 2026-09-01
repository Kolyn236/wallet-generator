<?php

declare(strict_types=1);

namespace App\Blockchain\Infrastructure;

use App\Blockchain\Application\Eip1559FeeQuote;
use App\Blockchain\Application\EthereumRpcFailed;
use App\Blockchain\Application\EvmTransactionIntent;
use App\Blockchain\Domain\EthereumAddress;
use App\Blockchain\Domain\EvmQuantity;

final readonly class EthereumJsonRpcClient
{
    private const int REQUEST_ID = 1;
    private const string ERC20_BALANCE_OF_SELECTOR = '70a08231';

    public function __construct(
        private string $rpcUrl,
        private EthereumJsonRpcTransport $transport,
        private ProviderRequestLogger $logger,
    ) {
    }

    public function balanceWei(string $address): string
    {
        $this->assertMainnet();

        return $this->quantityResult('eth_getBalance', [$address, 'latest'], 'balance');
    }

    public function erc20Balance(string $contractAddress, string $holderAddress): string
    {
        $this->assertMainnet();

        $contract = EthereumAddress::fromString($contractAddress)->value;
        $holder = EthereumAddress::fromString($holderAddress)->value;
        $data = '0x'.self::ERC20_BALANCE_OF_SELECTOR.str_pad(strtolower(substr($holder, 2)), 64, '0', \STR_PAD_LEFT);
        $result = $this->call('eth_call', [[
            'to' => $contract,
            'data' => $data,
        ], 'latest'], 'erc20_balance');

        if (!\is_string($result) || 1 !== preg_match('/^0x[0-9a-fA-F]{64}$/', $result)) {
            throw new EthereumRpcFailed('provider_unexpected_response');
        }

        $hex = ltrim(substr($result, 2), '0');
        $quantity = '0x'.('' === $hex ? '0' : $hex);

        try {
            return EvmQuantity::fromHex($quantity)->decimal;
        } catch (\InvalidArgumentException $exception) {
            throw new EthereumRpcFailed('provider_unexpected_response', null, $exception);
        }
    }

    public function pendingNonce(string $address): string
    {
        $this->assertMainnet();

        return $this->quantityResult('eth_getTransactionCount', [$address, 'pending'], 'pending_nonce');
    }

    public function estimateGas(EvmTransactionIntent $intent): string
    {
        $this->assertMainnet();

        try {
            return $this->quantityResult('eth_estimateGas', [[
                'from' => $intent->from,
                'to' => $intent->to,
                'value' => EvmQuantity::fromDecimal($intent->valueWei)->toHex(),
                'data' => $intent->data,
            ]], 'gas_estimate');
        } catch (EthereumRpcFailed $exception) {
            if ('provider_rpc_error' === $exception->reason) {
                throw new EthereumRpcFailed('gas_estimation_failed', $exception->httpStatus, $exception);
            }

            throw $exception;
        }
    }

    public function feeQuote(): Eip1559FeeQuote
    {
        $this->assertMainnet();

        try {
            $result = $this->call('eth_feeHistory', ['0x5', 'latest', [50]], 'fee_history');
            if (!\is_array($result)) {
                throw new EthereumRpcFailed('fee_quote_failed');
            }

            $baseFees = $result['baseFeePerGas'] ?? null;
            $rewards = $result['reward'] ?? null;
            if (!\is_array($baseFees) || [] === $baseFees || !\is_array($rewards) || [] === $rewards) {
                throw new EthereumRpcFailed('fee_quote_failed');
            }

            $nextBaseFeeHex = end($baseFees);
            $latestReward = end($rewards);
            if (!\is_string($nextBaseFeeHex) || !\is_array($latestReward) || !isset($latestReward[0]) || !\is_string($latestReward[0])) {
                throw new EthereumRpcFailed('fee_quote_failed');
            }

            $baseFee = EvmQuantity::fromHex($nextBaseFeeHex);
            $priorityFee = EvmQuantity::fromHex($latestReward[0]);
            $maxFee = $baseFee->doubledPlus($priorityFee);

            return new Eip1559FeeQuote(
                $baseFee->decimal,
                $priorityFee->decimal,
                $maxFee->decimal,
            );
        } catch (\InvalidArgumentException $exception) {
            throw new EthereumRpcFailed('fee_quote_failed', null, $exception);
        } catch (EthereumRpcFailed $exception) {
            if (\in_array($exception->reason, ['provider_not_configured', 'provider_transport_failed', 'provider_rate_limited', 'provider_wrong_chain'], true)) {
                throw $exception;
            }
            if ('fee_quote_failed' === $exception->reason) {
                throw $exception;
            }

            throw new EthereumRpcFailed('fee_quote_failed', $exception->httpStatus, $exception);
        }
    }

    public function broadcast(string $rawTransaction): string
    {
        $this->assertMainnet();

        try {
            $result = $this->call('eth_sendRawTransaction', [$rawTransaction], 'broadcast');
        } catch (EthereumRpcFailed $exception) {
            if ('provider_rpc_error' === $exception->reason) {
                throw new EthereumRpcFailed('broadcast_failed', $exception->httpStatus, $exception);
            }

            throw $exception;
        }

        if (!\is_string($result) || 1 !== preg_match('/^0x[0-9a-fA-F]{64}$/', $result)) {
            throw new EthereumRpcFailed('provider_invalid_tx_hash');
        }

        return $result;
    }

    private function assertMainnet(): void
    {
        $result = $this->call('eth_chainId', [], 'chain_id');
        if (!\is_string($result)) {
            throw new EthereumRpcFailed('provider_unexpected_response');
        }

        try {
            $chainId = EvmQuantity::fromHex($result)->decimal;
        } catch (\InvalidArgumentException $exception) {
            throw new EthereumRpcFailed('provider_unexpected_response', null, $exception);
        }

        if ('1' !== $chainId) {
            throw new EthereumRpcFailed('provider_wrong_chain');
        }
    }

    /** @param list<mixed> $params */
    private function quantityResult(string $method, array $params, string $operation): string
    {
        $result = $this->call($method, $params, $operation);
        if (!\is_string($result)) {
            throw new EthereumRpcFailed('provider_unexpected_response');
        }

        try {
            return EvmQuantity::fromHex($result)->decimal;
        } catch (\InvalidArgumentException $exception) {
            throw new EthereumRpcFailed('provider_unexpected_response', null, $exception);
        }
    }

    /** @param list<mixed> $params */
    private function call(string $method, array $params, string $operation): mixed
    {
        $startedAt = hrtime(true);
        $payload = json_encode([
            'jsonrpc' => '2.0',
            'id' => self::REQUEST_ID,
            'method' => $method,
            'params' => $params,
        ], \JSON_THROW_ON_ERROR | \JSON_UNESCAPED_SLASHES);

        try {
            $response = $this->transport->post($this->rpcUrl, $payload);
        } catch (EthereumRpcFailed $exception) {
            $this->logFailure($operation, $exception->reason, $exception->httpStatus, $startedAt);
            throw $exception;
        }

        if (429 === $response->status) {
            $this->fail('provider_rate_limited', $response->status, $operation, $startedAt);
        }
        if (null !== $response->status && $response->status >= 400) {
            $this->fail('provider_transport_failed', $response->status, $operation, $startedAt);
        }

        try {
            $decoded = json_decode($response->body, true, 512, \JSON_THROW_ON_ERROR);
        } catch (\JsonException $exception) {
            $this->logFailure($operation, 'provider_invalid_json', $response->status, $startedAt);
            throw new EthereumRpcFailed('provider_invalid_json', $response->status, $exception);
        }

        if (!\is_array($decoded)
            || '2.0' !== ($decoded['jsonrpc'] ?? null)
            || self::REQUEST_ID !== ($decoded['id'] ?? null)
        ) {
            $this->fail('provider_unexpected_response', $response->status, $operation, $startedAt);
        }

        if (isset($decoded['error'])) {
            if (!\is_array($decoded['error']) || !isset($decoded['error']['code']) || !\is_int($decoded['error']['code'])) {
                $this->fail('provider_unexpected_response', $response->status, $operation, $startedAt);
            }

            $this->fail('provider_rpc_error', $response->status, $operation, $startedAt);
        }

        if (!\array_key_exists('result', $decoded)) {
            $this->fail('provider_unexpected_response', $response->status, $operation, $startedAt);
        }

        return $decoded['result'];
    }

    private function fail(string $reason, ?int $status, string $operation, int $startedAt): never
    {
        $this->logFailure($operation, $reason, $status, $startedAt);
        throw new EthereumRpcFailed($reason, $status);
    }

    private function logFailure(string $operation, string $reason, ?int $status, int $startedAt): void
    {
        $this->logger->warning([
            'provider' => 'ethereum-json-rpc',
            'chain' => 'ethereum',
            'operation' => $operation,
            'reason' => $reason,
            'http_status' => $status,
            'duration_ms' => round((hrtime(true) - $startedAt) / 1_000_000, 2),
        ]);
    }
}
