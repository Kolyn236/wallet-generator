<?php

declare(strict_types=1);

namespace App\Tests\Blockchain;

use App\Blockchain\Application\AddressBalanceCapability;
use App\Blockchain\Application\ChainAdapter;
use App\Blockchain\Application\ChainAdapterNotFound;
use App\Blockchain\Application\ChainAdapterRegistry;
use App\Blockchain\Application\EvmNativeBalanceCapability;
use App\Blockchain\Application\GetUsdtTrc20Balance;
use App\Blockchain\Application\Trc20BalanceCapability;
use App\Blockchain\Application\TronProviderFailed;
use App\Blockchain\Application\UnsupportedChainCapability;
use App\Blockchain\Application\UtxoLookupCapability;
use App\Blockchain\Domain\TronAddress;
use App\Blockchain\Infrastructure\ProviderRequestLogger;
use App\Blockchain\Infrastructure\TronFullNodeClient;
use App\Blockchain\Infrastructure\TronHttpTransport;
use App\Blockchain\Infrastructure\TronHttpTransportResponse;
use App\Blockchain\Infrastructure\TronMainnetAdapter;
use App\Blockchain\Presentation\Http\UsdtTrc20BalanceController;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class TronBackendTest extends TestCase
{
    public const string HOLDER = 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb';
    private const string HOLDER_HEX = '410000000000000000000000000000000000000000';
    private const string PARAMETER = '0000000000000000000000000000000000000000000000000000000000000000';

    public function testTronAddressExposesCanonicalBase58AndHexForms(): void
    {
        $address = TronAddress::fromString(GetUsdtTrc20Balance::CONTRACT_ADDRESS);

        self::assertSame(GetUsdtTrc20Balance::CONTRACT_ADDRESS, $address->base58);
        self::assertSame(GetUsdtTrc20Balance::CONTRACT_HEX, $address->hex);
    }

    /** @return iterable<string, array{string}> */
    public static function invalidAddresses(): iterable
    {
        yield 'empty' => [''];
        yield 'invalid alphabet' => ['TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj60'];
        yield 'wrong length' => ['TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6'];
        yield 'checksum mismatch' => ['TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj61'];
        yield 'bitcoin payload' => ['1BoatSLRHtKNngkdXEeobR76b53LETtpyT'];
    }

    #[DataProvider('invalidAddresses')]
    public function testTronAddressRejectsInvalidInput(string $address): void
    {
        $this->expectException(\InvalidArgumentException::class);

        TronAddress::fromString($address);
    }

    public function testRegistryResolvesOnlyExactTronMainnetCapability(): void
    {
        $adapter = self::adapter(new QueueTronTransport([]));
        $registry = new ChainAdapterRegistry([$adapter]);

        self::assertSame($adapter, $registry->get('tron', 'mainnet'));
        self::assertSame($adapter, $registry->requireCapability('tron', 'mainnet', Trc20BalanceCapability::class));

        foreach ([AddressBalanceCapability::class, UtxoLookupCapability::class, EvmNativeBalanceCapability::class] as $capability) {
            try {
                $registry->requireCapability('tron', 'mainnet', $capability);
                self::fail('TRON must reject unsupported capability '.$capability);
            } catch (UnsupportedChainCapability) {
            }
        }
    }

    public function testTronWrongNetworkFailsClosed(): void
    {
        $registry = new ChainAdapterRegistry([self::adapter(new QueueTronTransport([]))]);

        $this->expectException(ChainAdapterNotFound::class);
        $this->expectExceptionMessage('tron:shasta');

        $registry->get('tron', 'shasta');
    }

    public function testBalanceRequestUsesExactContractHolderAndBalanceOfCalldata(): void
    {
        $transport = new QueueTronTransport([
            self::response(['result' => ['result' => true], 'constant_result' => [str_pad('75bcd15', 64, '0', \STR_PAD_LEFT)]]),
        ]);
        $balance = self::client($transport)->trc20Balance(GetUsdtTrc20Balance::CONTRACT_ADDRESS, self::HOLDER);

        self::assertSame('123456789', $balance);
        self::assertCount(1, $transport->requests);
        self::assertSame('https://tron.example.invalid/wallet/triggerconstantcontract', $transport->requests[0]['url']);
        self::assertSame([
            'owner_address' => self::HOLDER_HEX,
            'contract_address' => GetUsdtTrc20Balance::CONTRACT_HEX,
            'function_selector' => 'balanceOf(address)',
            'parameter' => self::PARAMETER,
            'visible' => false,
        ], json_decode($transport->requests[0]['payload'], true, 32, \JSON_THROW_ON_ERROR));
    }

    public function testBalanceDecodesMaximumUint256WithoutFloat(): void
    {
        $transport = new QueueTronTransport([
            self::response(['result' => ['result' => true], 'constant_result' => [str_repeat('f', 64)]]),
        ]);

        self::assertSame(
            '115792089237316195423570985008687907853269984665640564039457584007913129639935',
            self::client($transport)->trc20Balance(GetUsdtTrc20Balance::CONTRACT_ADDRESS, self::HOLDER),
        );
    }

    /** @return iterable<string, array{string}> */
    public static function malformedResponses(): iterable
    {
        yield 'invalid json' => ['{'];
        yield 'missing result' => ['{}'];
        yield 'failed result' => ['{"result":{"result":false},"constant_result":["'.str_repeat('0', 64).'"]}'];
        yield 'missing constant result' => ['{"result":{"result":true}}'];
        yield 'non canonical uint256' => ['{"result":{"result":true},"constant_result":["01"]}'];
        yield 'multiple results' => ['{"result":{"result":true},"constant_result":["'.str_repeat('0', 64).'","'.str_repeat('0', 64).'"]}'];
    }

    #[DataProvider('malformedResponses')]
    public function testMalformedProviderResponsesFailClosed(string $body): void
    {
        $transport = new QueueTronTransport([new TronHttpTransportResponse(200, $body)]);

        $this->expectException(TronProviderFailed::class);

        self::client($transport)->trc20Balance(GetUsdtTrc20Balance::CONTRACT_ADDRESS, self::HOLDER);
    }

    public function testUseCaseAndControllerReturnCanonicalBalanceWithoutNetwork(): void
    {
        $adapter = new class implements ChainAdapter, Trc20BalanceCapability {
            public function chain(): string
            {
                return 'tron';
            }

            public function network(): string
            {
                return 'mainnet';
            }

            public function trc20Balance(string $contractAddress, string $holderAddress): string
            {
                TestCase::assertSame(GetUsdtTrc20Balance::CONTRACT_ADDRESS, $contractAddress);
                TestCase::assertSame(TronBackendTest::HOLDER, $holderAddress);

                return '123456789';
            }
        };
        $useCase = new GetUsdtTrc20Balance(new ChainAdapterRegistry([$adapter]));
        $response = (new UsdtTrc20BalanceController($useCase))(self::HOLDER);
        $payload = json_decode((string) $response->getContent(), true, 32, \JSON_THROW_ON_ERROR);

        self::assertSame(200, $response->getStatusCode());
        self::assertSame([
            'chain' => 'tron',
            'network' => 'mainnet',
            'asset' => 'usdt',
            'standard' => 'trc20',
            'contractAddress' => GetUsdtTrc20Balance::CONTRACT_ADDRESS,
            'address' => self::HOLDER,
            'balance' => '123.456789',
            'balanceSmallestUnit' => '123456789',
            'decimals' => 6,
            'unit' => 'USDT',
        ], $payload);
    }

    private static function adapter(QueueTronTransport $transport): TronMainnetAdapter
    {
        return new TronMainnetAdapter(self::client($transport));
    }

    private static function client(QueueTronTransport $transport): TronFullNodeClient
    {
        return new TronFullNodeClient('https://tron.example.invalid', $transport, new ProviderRequestLogger());
    }

    /** @param array<string, mixed> $payload */
    private static function response(array $payload): TronHttpTransportResponse
    {
        return new TronHttpTransportResponse(200, json_encode($payload, \JSON_THROW_ON_ERROR));
    }
}

final class QueueTronTransport implements TronHttpTransport
{
    /** @var list<array{url: string, payload: string}> */
    public array $requests = [];

    /** @param list<TronHttpTransportResponse> $responses */
    public function __construct(private array $responses)
    {
    }

    public function post(string $url, string $payload): TronHttpTransportResponse
    {
        $this->requests[] = ['url' => $url, 'payload' => $payload];
        $response = array_shift($this->responses);

        if (!$response instanceof TronHttpTransportResponse) {
            throw new \LogicException('No fake TRON response queued.');
        }

        return $response;
    }
}
