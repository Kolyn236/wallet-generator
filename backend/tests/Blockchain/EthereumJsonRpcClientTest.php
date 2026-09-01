<?php

declare(strict_types=1);

namespace App\Tests\Blockchain;

use App\Blockchain\Application\EthereumRpcFailed;
use App\Blockchain\Application\EvmTransactionIntent;
use App\Blockchain\Infrastructure\EthereumJsonRpcClient;
use App\Blockchain\Infrastructure\EthereumJsonRpcTransport;
use App\Blockchain\Infrastructure\EthereumJsonRpcTransportResponse;
use App\Blockchain\Infrastructure\ProviderRequestLogger;
use PHPUnit\Framework\TestCase;

final class EthereumJsonRpcClientTest extends TestCase
{
    private const string ADDRESS = '0x1111111111111111111111111111111111111111';
    private const string OTHER_ADDRESS = '0x2222222222222222222222222222222222222222';

    public function testBalancePreservesValuesBeyondSignedInt64(): void
    {
        $transport = new QueueEthereumTransport([
            self::rpcResult('0x1'),
            self::rpcResult('0x3635c9adc5dea00000'),
        ]);

        $client = self::client($transport);

        self::assertSame('1000000000000000000000', $client->balanceWei(self::ADDRESS));
    }

    public function testMaximumUint256QuantityIsParsedWithoutTruncation(): void
    {
        $transport = new QueueEthereumTransport([
            self::rpcResult('0x1'),
            self::rpcResult('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'),
        ]);

        self::assertSame(
            '115792089237316195423570985008687907853269984665640564039457584007913129639935',
            self::client($transport)->balanceWei(self::ADDRESS),
        );
    }

    public function testPendingNonceUsesPendingBlockTag(): void
    {
        $transport = new QueueEthereumTransport([
            self::rpcResult('0x1'),
            self::rpcResult('0x2a'),
        ]);

        self::assertSame('42', self::client($transport)->pendingNonce(self::ADDRESS));

        $request = json_decode($transport->payloads[1], true, 32, \JSON_THROW_ON_ERROR);
        self::assertSame('eth_getTransactionCount', $request['method']);
        self::assertSame([self::ADDRESS, 'pending'], $request['params']);
    }

    public function testGasEstimateUsesExactPublicIntent(): void
    {
        $transport = new QueueEthereumTransport([
            self::rpcResult('0x1'),
            self::rpcResult('0x5208'),
        ]);
        $intent = new EvmTransactionIntent(
            self::ADDRESS,
            self::OTHER_ADDRESS,
            '1000000000000000',
            '0x',
        );

        self::assertSame('21000', self::client($transport)->estimateGas($intent));

        $request = json_decode($transport->payloads[1], true, 32, \JSON_THROW_ON_ERROR);
        self::assertSame('eth_estimateGas', $request['method']);
        self::assertSame([[
            'from' => self::ADDRESS,
            'to' => self::OTHER_ADDRESS,
            'value' => '0x38d7ea4c68000',
            'data' => '0x',
        ]], $request['params']);
    }

    public function testFeeQuoteUsesFeeHistoryAndArbitraryPrecisionPolicy(): void
    {
        $transport = new QueueEthereumTransport([
            self::rpcResult('0x1'),
            self::rpcResult([
                'oldestBlock' => '0x10',
                'baseFeePerGas' => ['0x3b9aca00', '0x4a817c800'],
                'gasUsedRatio' => [0.5],
                'reward' => [['0x3b9aca00']],
            ]),
        ]);

        $quote = self::client($transport)->feeQuote();

        self::assertSame('20000000000', $quote->baseFeePerGasWei);
        self::assertSame('1000000000', $quote->maxPriorityFeePerGasWei);
        self::assertSame('41000000000', $quote->maxFeePerGasWei);

        $request = json_decode($transport->payloads[1], true, 32, \JSON_THROW_ON_ERROR);
        self::assertSame('eth_feeHistory', $request['method']);
        self::assertSame(['0x5', 'latest', [50]], $request['params']);
    }

    public function testWrongChainFailsClosed(): void
    {
        $transport = new QueueEthereumTransport([self::rpcResult('0xaa36a7')]);

        try {
            self::client($transport)->balanceWei(self::ADDRESS);
            self::fail('Wrong EVM chain must fail closed.');
        } catch (EthereumRpcFailed $exception) {
            self::assertSame('provider_wrong_chain', $exception->reason);
        }
    }

    public function testMalformedHexQuantityIsRejectedInsteadOfBecomingZero(): void
    {
        $transport = new QueueEthereumTransport([
            self::rpcResult('0x1'),
            self::rpcResult('0x00'),
        ]);

        try {
            self::client($transport)->balanceWei(self::ADDRESS);
            self::fail('Malformed hex quantity must be rejected.');
        } catch (EthereumRpcFailed $exception) {
            self::assertSame('provider_unexpected_response', $exception->reason);
        }
    }

    public function testMalformedJsonIsRejected(): void
    {
        $transport = new QueueEthereumTransport([
            new EthereumJsonRpcTransportResponse(200, '{invalid'),
        ]);

        try {
            self::client($transport)->balanceWei(self::ADDRESS);
            self::fail('Malformed JSON must be rejected.');
        } catch (EthereumRpcFailed $exception) {
            self::assertSame('provider_invalid_json', $exception->reason);
        }
    }

    public function testRateLimitIsExplicit(): void
    {
        $transport = new QueueEthereumTransport([
            new EthereumJsonRpcTransportResponse(429, '{}'),
        ]);

        try {
            self::client($transport)->balanceWei(self::ADDRESS);
            self::fail('Rate limiting must be explicit.');
        } catch (EthereumRpcFailed $exception) {
            self::assertSame('provider_rate_limited', $exception->reason);
            self::assertSame(429, $exception->httpStatus);
        }
    }

    public function testGasRpcErrorBecomesGasEstimationFailure(): void
    {
        $transport = new QueueEthereumTransport([
            self::rpcResult('0x1'),
            self::rpcError(-32000),
        ]);
        $intent = new EvmTransactionIntent(self::ADDRESS, self::OTHER_ADDRESS, '1', '0x');

        try {
            self::client($transport)->estimateGas($intent);
            self::fail('Gas estimation RPC error must fail before signing.');
        } catch (EthereumRpcFailed $exception) {
            self::assertSame('gas_estimation_failed', $exception->reason);
        }
    }

    public function testBroadcastValidatesReturnedTransactionHash(): void
    {
        $transport = new QueueEthereumTransport([
            self::rpcResult('0x1'),
            self::rpcResult('0x1234'),
        ]);

        try {
            self::client($transport)->broadcast('0x02abcd');
            self::fail('Malformed provider transaction hash must be rejected.');
        } catch (EthereumRpcFailed $exception) {
            self::assertSame('provider_invalid_tx_hash', $exception->reason);
        }
    }

    public function testBroadcastFailureLogDoesNotContainRawTransaction(): void
    {
        $logFile = tempnam(sys_get_temp_dir(), 'ethereum-log-');
        self::assertIsString($logFile);
        $oldLog = ini_get('error_log');
        ini_set('error_log', $logFile);

        try {
            $transport = new QueueEthereumTransport([
                self::rpcResult('0x1'),
                self::rpcError(-32000),
            ]);
            $rawTransaction = '0x02'.str_repeat('ab', 64);

            try {
                self::client($transport)->broadcast($rawTransaction);
                self::fail('Provider broadcast error must be explicit.');
            } catch (EthereumRpcFailed $exception) {
                self::assertSame('broadcast_failed', $exception->reason);
            }

            $log = file_get_contents($logFile);
            self::assertIsString($log);
            self::assertStringNotContainsString($rawTransaction, $log);
            self::assertStringContainsString('broadcast', $log);
        } finally {
            ini_set('error_log', false === $oldLog ? '' : $oldLog);
            @unlink($logFile);
        }
    }

    private static function client(QueueEthereumTransport $transport): EthereumJsonRpcClient
    {
        return new EthereumJsonRpcClient(
            'https://secret-api-key@example.invalid',
            $transport,
            new ProviderRequestLogger(),
        );
    }

    private static function rpcResult(mixed $result): EthereumJsonRpcTransportResponse
    {
        return new EthereumJsonRpcTransportResponse(200, json_encode([
            'jsonrpc' => '2.0',
            'id' => 1,
            'result' => $result,
        ], \JSON_THROW_ON_ERROR));
    }

    private static function rpcError(int $code): EthereumJsonRpcTransportResponse
    {
        return new EthereumJsonRpcTransportResponse(200, json_encode([
            'jsonrpc' => '2.0',
            'id' => 1,
            'error' => [
                'code' => $code,
                'message' => 'fixture error',
            ],
        ], \JSON_THROW_ON_ERROR));
    }
}

final class QueueEthereumTransport implements EthereumJsonRpcTransport
{
    /** @var list<string> */
    public array $payloads = [];

    /** @param list<EthereumJsonRpcTransportResponse> $responses */
    public function __construct(private array $responses)
    {
    }

    public function post(string $url, string $payload): EthereumJsonRpcTransportResponse
    {
        $this->payloads[] = $payload;
        $response = array_shift($this->responses);

        if (!$response instanceof EthereumJsonRpcTransportResponse) {
            throw new \LogicException('No fake Ethereum RPC response queued.');
        }

        return $response;
    }
}
