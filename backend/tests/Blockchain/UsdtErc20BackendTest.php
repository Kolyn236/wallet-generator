<?php

declare(strict_types=1);

namespace App\Tests\Blockchain;

use App\Blockchain\Application\ChainAdapter;
use App\Blockchain\Application\ChainAdapterRegistry;
use App\Blockchain\Application\Erc20BalanceCapability;
use App\Blockchain\Application\GetUsdtErc20Balance;
use App\Blockchain\Infrastructure\EthereumJsonRpcClient;
use App\Blockchain\Infrastructure\EthereumJsonRpcTransport;
use App\Blockchain\Infrastructure\EthereumJsonRpcTransportResponse;
use App\Blockchain\Infrastructure\EthereumMainnetAdapter;
use App\Blockchain\Infrastructure\ProviderRequestLogger;
use PHPUnit\Framework\TestCase;

final class UsdtErc20BackendTest extends TestCase
{
    private const string HOLDER = '0x1111111111111111111111111111111111111111';
    private const string BALANCE_OF_DATA = '0x70a082310000000000000000000000001111111111111111111111111111111111111111';

    public function testEthereumAdapterExposesErc20BalanceCapability(): void
    {
        $transport = new UsdtQueueEthereumTransport([]);
        $adapter = new EthereumMainnetAdapter(self::client($transport));
        $registry = new ChainAdapterRegistry([$adapter]);

        self::assertSame(
            $adapter,
            $registry->requireCapability('ethereum', 'mainnet', Erc20BalanceCapability::class),
        );
    }

    public function testErc20BalanceUsesEthCallAndParsesAbiUint256(): void
    {
        $transport = new UsdtQueueEthereumTransport([
            self::rpcResult('0x1'),
            self::rpcResult('0x00000000000000000000000000000000000000000000000000000000075bcd15'),
        ]);

        self::assertSame(
            '123456789',
            self::client($transport)->erc20Balance(GetUsdtErc20Balance::CONTRACT_ADDRESS, self::HOLDER),
        );

        $request = json_decode($transport->payloads[1], true, 32, \JSON_THROW_ON_ERROR);
        self::assertSame('eth_call', $request['method']);
        self::assertSame([[
            'to' => GetUsdtErc20Balance::CONTRACT_ADDRESS,
            'data' => self::BALANCE_OF_DATA,
        ], 'latest'], $request['params']);
    }

    public function testUsdtBalanceFormatsSixDecimalsWithoutFloat(): void
    {
        $adapter = new class implements ChainAdapter, Erc20BalanceCapability {
            public function chain(): string
            {
                return 'ethereum';
            }

            public function network(): string
            {
                return 'mainnet';
            }

            public function erc20Balance(string $contractAddress, string $holderAddress): string
            {
                if (GetUsdtErc20Balance::CONTRACT_ADDRESS !== $contractAddress) {
                    throw new \LogicException('Unexpected token contract.');
                }

                return '123456789';
            }
        };
        $balance = (new GetUsdtErc20Balance(new ChainAdapterRegistry([$adapter])))(self::HOLDER);

        self::assertSame('123.456789', $balance->decimal());
        self::assertSame('123456789', $balance->balanceSmallestUnit);
        self::assertSame(6, $balance->decimals);
        self::assertSame('USDT', $balance->symbol);
    }

    private static function client(UsdtQueueEthereumTransport $transport): EthereumJsonRpcClient
    {
        return new EthereumJsonRpcClient(
            'https://rpc.example.invalid',
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
}

final class UsdtQueueEthereumTransport implements EthereumJsonRpcTransport
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
