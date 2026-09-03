<?php

declare(strict_types=1);

namespace App\Tests\Blockchain;

use App\Blockchain\Application\BroadcastFailed;
use App\Blockchain\Application\DogecoinBalanceProvider;
use App\Blockchain\Application\DogecoinFeePolicy;
use App\Blockchain\Application\DogecoinTransactionBroadcaster;
use App\Blockchain\Application\DogecoinUtxoProvider;
use App\Blockchain\Domain\AddressBalance;
use App\Blockchain\Domain\DogecoinAddress;
use App\Blockchain\Domain\DogecoinRawTransaction;
use App\Blockchain\Infrastructure\CacheSuccessfulBroadcastStore;
use App\Blockchain\Infrastructure\DogecoinMainnetAdapter;
use App\Blockchain\Infrastructure\EthereumJsonRpcClient;
use App\Blockchain\Infrastructure\EthereumJsonRpcTransport;
use App\Blockchain\Infrastructure\EthereumJsonRpcTransportResponse;
use App\Blockchain\Infrastructure\EthereumMainnetAdapter;
use App\Blockchain\Infrastructure\ProviderRequestLogger;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Cache\Adapter\ArrayAdapter;

final class BroadcastDeduplicationTest extends TestCase
{
    public function testExactRepeatedDogecoinBroadcastHitsProviderOnce(): void
    {
        $broadcaster = new CountingDogecoinBroadcaster();
        $store = new CacheSuccessfulBroadcastStore(new ArrayAdapter(), new ProviderRequestLogger(), 120);
        $adapter = self::dogecoinAdapter($broadcaster, $store);

        $first = $adapter->broadcastRawTransaction('00');
        $second = $adapter->broadcastRawTransaction('00');

        self::assertSame($first, $second);
        self::assertSame(1, $broadcaster->calls);
    }

    public function testDifferentTxidsAreNotDeduplicated(): void
    {
        $broadcaster = new CountingDogecoinBroadcaster();
        $store = new CacheSuccessfulBroadcastStore(new ArrayAdapter(), new ProviderRequestLogger(), 120);
        $adapter = self::dogecoinAdapter($broadcaster, $store);

        $adapter->broadcastRawTransaction('00');
        $adapter->broadcastRawTransaction('01');

        self::assertSame(2, $broadcaster->calls);
    }

    public function testFailedAttemptIsNotRememberedAsSuccessful(): void
    {
        $broadcaster = new class implements DogecoinTransactionBroadcaster {
            public int $calls = 0;

            public function broadcast(DogecoinRawTransaction $transaction): string
            {
                ++$this->calls;
                if (1 === $this->calls) {
                    throw new BroadcastFailed('provider_transport_failed');
                }

                return $transaction->txid;
            }
        };
        $store = new CacheSuccessfulBroadcastStore(new ArrayAdapter(), new ProviderRequestLogger(), 120);
        $adapter = self::dogecoinAdapter($broadcaster, $store);

        try {
            $adapter->broadcastRawTransaction('00');
            self::fail('Expected first provider attempt to fail.');
        } catch (BroadcastFailed $exception) {
            self::assertSame('provider_transport_failed', $exception->reason);
        }

        self::assertSame(DogecoinRawTransaction::fromHex('00')->txid, $adapter->broadcastRawTransaction('00'));
        self::assertSame(2, $broadcaster->calls);
    }

    public function testCanonicalSuccessMarkerIsChainScoped(): void
    {
        $store = new CacheSuccessfulBroadcastStore(new ArrayAdapter(), new ProviderRequestLogger(), 120);
        $txid = str_repeat('ab', 32);
        $store->rememberSuccessful('dogecoin', 'mainnet', $txid, $txid);

        self::assertSame($txid, $store->findSuccessfulTxid('dogecoin', 'mainnet', $txid));
        self::assertNull($store->findSuccessfulTxid('bitcoin', 'mainnet', $txid));
    }

    public function testExactRepeatedEthereumRawTransactionReturnsConfirmedHashWithoutRpcReplay(): void
    {
        $txHash = '0x'.str_repeat('ab', 32);
        $transport = new CountingEthereumTransport($txHash);
        $rpc = new EthereumJsonRpcClient(
            'https://rpc.example.invalid',
            $transport,
            new ProviderRequestLogger(),
        );
        $store = new CacheSuccessfulBroadcastStore(new ArrayAdapter(), new ProviderRequestLogger(), 120);
        $adapter = new EthereumMainnetAdapter($rpc, null, null, $store);

        self::assertSame($txHash, $adapter->broadcastRawTransaction('0x01'));
        self::assertSame($txHash, $adapter->broadcastRawTransaction('0x01'));
        self::assertSame(2, $transport->calls);
    }

    private static function dogecoinAdapter(
        DogecoinTransactionBroadcaster $broadcaster,
        CacheSuccessfulBroadcastStore $store,
    ): DogecoinMainnetAdapter {
        $balance = new class implements DogecoinBalanceProvider {
            public function getConfirmedBalance(DogecoinAddress $address): AddressBalance
            {
                return new AddressBalance($address->value, 0);
            }
        };
        $utxos = new class implements DogecoinUtxoProvider {
            public function getConfirmedUtxos(DogecoinAddress $address): array
            {
                return [];
            }
        };

        return new DogecoinMainnetAdapter(
            $balance,
            $utxos,
            new DogecoinFeePolicy('0.01'),
            $broadcaster,
            null,
            null,
            $store,
        );
    }
}

final class CountingDogecoinBroadcaster implements DogecoinTransactionBroadcaster
{
    public int $calls = 0;

    public function broadcast(DogecoinRawTransaction $transaction): string
    {
        ++$this->calls;

        return $transaction->txid;
    }
}

final class CountingEthereumTransport implements EthereumJsonRpcTransport
{
    public int $calls = 0;

    public function __construct(private readonly string $txHash)
    {
    }

    public function post(string $url, string $payload): EthereumJsonRpcTransportResponse
    {
        ++$this->calls;
        $decoded = json_decode($payload, true, 512, \JSON_THROW_ON_ERROR);
        $result = match ($decoded['method'] ?? null) {
            'eth_chainId' => '0x1',
            'eth_sendRawTransaction' => $this->txHash,
            default => throw new \LogicException('Unexpected JSON-RPC method.'),
        };

        return new EthereumJsonRpcTransportResponse(200, json_encode([
            'jsonrpc' => '2.0',
            'id' => 1,
            'result' => $result,
        ], \JSON_THROW_ON_ERROR));
    }
}
