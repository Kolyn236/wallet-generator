<?php

declare(strict_types=1);

namespace App\Tests\Blockchain;

use App\Blockchain\Application\BalanceLookupFailed;
use App\Blockchain\Application\DogecoinBalanceProvider;
use App\Blockchain\Application\DogecoinFeePolicy;
use App\Blockchain\Application\DogecoinTransactionBroadcaster;
use App\Blockchain\Application\DogecoinUtxoProvider;
use App\Blockchain\Application\UtxoLookupFailed;
use App\Blockchain\Domain\AddressBalance;
use App\Blockchain\Domain\DogecoinAddress;
use App\Blockchain\Domain\DogecoinRawTransaction;
use App\Blockchain\Infrastructure\DogecoinMainnetAdapter;
use App\Blockchain\Infrastructure\ProviderCooldown;
use App\Blockchain\Infrastructure\ProviderReadCache;
use App\Blockchain\Infrastructure\ProviderRequestLogger;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Cache\Adapter\ArrayAdapter;

final class ProviderProtectionTest extends TestCase
{
    private const string DOGE_ADDRESS = 'D9popZh3N9mNNwTVwrG9jLLuS5Ym8tEYvd';

    public function testBalanceCacheHitAvoidsSecondProviderCall(): void
    {
        $balance = new CountingDogecoinBalanceProvider();
        $adapter = self::dogecoinAdapter(
            $balance,
            new ProviderReadCache(new ArrayAdapter(), ['balance' => 10, 'utxo' => 10]),
        );

        self::assertSame(123_000_000, $adapter->getConfirmedBalance(self::DOGE_ADDRESS)->smallestUnit);
        self::assertSame(123_000_000, $adapter->getConfirmedBalance(self::DOGE_ADDRESS)->smallestUnit);
        self::assertSame(1, $balance->calls);
    }

    public function testCacheKeysAreChainNetworkOperationAndTokenScoped(): void
    {
        $calls = 0;
        $cache = new ProviderReadCache(new ArrayAdapter(), [
            'balance' => 10,
            'native_balance' => 8,
            'erc20_balance' => 8,
        ]);
        $load = static function () use (&$calls): int {
            return ++$calls;
        };

        self::assertSame(1, $cache->remember('dogecoin', 'mainnet', 'balance', ['address' => 'same'], $load));
        self::assertSame(1, $cache->remember('dogecoin', 'mainnet', 'balance', ['address' => 'same'], $load));
        self::assertSame(2, $cache->remember('bitcoin', 'mainnet', 'balance', ['address' => 'same'], $load));
        self::assertSame(3, $cache->remember('ethereum', 'mainnet', 'native_balance', ['address' => '0xabc'], $load));
        self::assertSame(4, $cache->remember('ethereum', 'mainnet', 'erc20_balance', [
            'address' => '0xabc',
            'token' => '0xdac17f958d2ee523a2206206994597c13d831ec7',
        ], $load));
        self::assertSame(4, $calls);
    }

    public function testProvider429StartsScopedCooldownAndSuppressesNextCall(): void
    {
        $balance = new RateLimitedDogecoinBalanceProvider();
        $pool = new ArrayAdapter();
        $adapter = self::dogecoinAdapter(
            $balance,
            null,
            new ProviderCooldown($pool, new ProviderRequestLogger(), 10),
        );

        try {
            $adapter->getConfirmedBalance(self::DOGE_ADDRESS);
            self::fail('Expected provider rate-limit failure.');
        } catch (BalanceLookupFailed $exception) {
            self::assertSame('provider_rate_limited', $exception->reason);
        }

        try {
            $adapter->getConfirmedBalance(self::DOGE_ADDRESS);
            self::fail('Expected local provider cooldown.');
        } catch (BalanceLookupFailed $exception) {
            self::assertSame('provider_rate_limited', $exception->reason);
        }

        self::assertSame(1, $balance->calls);
    }

    private static function dogecoinAdapter(
        DogecoinBalanceProvider $balanceProvider,
        ?ProviderReadCache $readCache = null,
        ?ProviderCooldown $cooldown = null,
    ): DogecoinMainnetAdapter {
        $utxos = new class implements DogecoinUtxoProvider {
            public function getConfirmedUtxos(DogecoinAddress $address): array
            {
                throw new UtxoLookupFailed('not_expected');
            }
        };
        $broadcaster = new class implements DogecoinTransactionBroadcaster {
            public function broadcast(DogecoinRawTransaction $transaction): string
            {
                return $transaction->txid;
            }
        };

        return new DogecoinMainnetAdapter(
            $balanceProvider,
            $utxos,
            new DogecoinFeePolicy('0.01'),
            $broadcaster,
            $readCache,
            $cooldown,
        );
    }
}

final class CountingDogecoinBalanceProvider implements DogecoinBalanceProvider
{
    public int $calls = 0;

    public function getConfirmedBalance(DogecoinAddress $address): AddressBalance
    {
        ++$this->calls;

        return new AddressBalance($address->value, 123_000_000);
    }
}

final class RateLimitedDogecoinBalanceProvider implements DogecoinBalanceProvider
{
    public int $calls = 0;

    public function getConfirmedBalance(DogecoinAddress $address): AddressBalance
    {
        ++$this->calls;
        throw new BalanceLookupFailed('provider_rate_limited', 429);
    }
}
