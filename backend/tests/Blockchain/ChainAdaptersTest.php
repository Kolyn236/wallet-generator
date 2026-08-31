<?php

declare(strict_types=1);

namespace App\Tests\Blockchain;

use App\Blockchain\Application\AddressBalanceCapability;
use App\Blockchain\Application\BitcoinBalanceProvider;
use App\Blockchain\Application\BitcoinFeePolicy;
use App\Blockchain\Application\BitcoinTransactionBroadcaster;
use App\Blockchain\Application\BitcoinUtxoProvider;
use App\Blockchain\Application\BroadcastBitcoinTransaction;
use App\Blockchain\Application\BroadcastDogecoinTransaction;
use App\Blockchain\Application\ChainAdapterNotFound;
use App\Blockchain\Application\ChainAdapterRegistry;
use App\Blockchain\Application\DogecoinBalanceProvider;
use App\Blockchain\Application\DogecoinFeePolicy;
use App\Blockchain\Application\DogecoinTransactionBroadcaster;
use App\Blockchain\Application\DogecoinUtxoProvider;
use App\Blockchain\Application\GetBitcoinAddressBalance;
use App\Blockchain\Application\GetBitcoinAddressUtxos;
use App\Blockchain\Application\GetDogecoinAddressBalance;
use App\Blockchain\Application\GetDogecoinAddressUtxos;
use App\Blockchain\Application\RawTransactionBroadcastCapability;
use App\Blockchain\Application\UtxoFeeRateCapability;
use App\Blockchain\Application\UtxoLookupCapability;
use App\Blockchain\Domain\AddressBalance;
use App\Blockchain\Domain\BitcoinAddress;
use App\Blockchain\Domain\BitcoinRawTransaction;
use App\Blockchain\Domain\BitcoinUtxo;
use App\Blockchain\Domain\DogecoinAddress;
use App\Blockchain\Domain\DogecoinRawTransaction;
use App\Blockchain\Domain\DogecoinUtxo;
use App\Blockchain\Infrastructure\BitcoinMainnetAdapter;
use App\Blockchain\Infrastructure\DogecoinMainnetAdapter;
use PHPUnit\Framework\TestCase;

final class ChainAdaptersTest extends TestCase
{
    private const string DOGE_ADDRESS = 'D9popZh3N9mNNwTVwrG9jLLuS5Ym8tEYvd';
    private const string BTC_ADDRESS = '1BoatSLRHtKNngkdXEeobR76b53LETtpyT';

    public function testRegistersDogecoinAndBitcoinAdaptersWithExpectedCapabilities(): void
    {
        $dogecoin = self::dogecoinAdapter();
        $bitcoin = self::bitcoinAdapter();
        $registry = new ChainAdapterRegistry([$dogecoin, $bitcoin]);

        self::assertSame($dogecoin, $registry->get('dogecoin', 'mainnet'));
        self::assertSame($bitcoin, $registry->get('bitcoin', 'mainnet'));

        foreach ([$dogecoin, $bitcoin] as $adapter) {
            self::assertInstanceOf(AddressBalanceCapability::class, $adapter);
            self::assertInstanceOf(UtxoLookupCapability::class, $adapter);
            self::assertInstanceOf(UtxoFeeRateCapability::class, $adapter);
            self::assertInstanceOf(RawTransactionBroadcastCapability::class, $adapter);
        }
    }

    public function testDogecoinUseCaseDoesNotFallbackToBitcoinAdapter(): void
    {
        $registry = new ChainAdapterRegistry([self::bitcoinAdapter()]);

        $this->expectException(ChainAdapterNotFound::class);
        $this->expectExceptionMessage('dogecoin:mainnet');

        (new GetDogecoinAddressBalance($registry))(self::DOGE_ADDRESS);
    }

    public function testBitcoinUseCaseDoesNotFallbackToDogecoinAdapter(): void
    {
        $registry = new ChainAdapterRegistry([self::dogecoinAdapter()]);

        $this->expectException(ChainAdapterNotFound::class);
        $this->expectExceptionMessage('bitcoin:mainnet');

        (new GetBitcoinAddressBalance($registry))(self::BTC_ADDRESS);
    }

    public function testDogecoinAndBitcoinUseCasesDelegateToTheirOwnAdapters(): void
    {
        $registry = new ChainAdapterRegistry([
            self::dogecoinAdapter(),
            self::bitcoinAdapter(),
        ]);

        $dogecoinBalance = (new GetDogecoinAddressBalance($registry))(self::DOGE_ADDRESS);
        $bitcoinBalance = (new GetBitcoinAddressBalance($registry))(self::BTC_ADDRESS);
        $dogecoinUtxos = (new GetDogecoinAddressUtxos($registry))(self::DOGE_ADDRESS);
        $bitcoinUtxos = (new GetBitcoinAddressUtxos($registry))(self::BTC_ADDRESS);
        $dogecoinTransaction = (new BroadcastDogecoinTransaction($registry))('00');
        $bitcoinTransaction = (new BroadcastBitcoinTransaction($registry))('00');

        self::assertSame(111_000_000, $dogecoinBalance->smallestUnit);
        self::assertSame(222_000, $bitcoinBalance->smallestUnit);
        self::assertSame(333_000_000, $dogecoinUtxos[0]->valueSmallestUnit);
        self::assertSame(444_000, $bitcoinUtxos[0]->valueSmallestUnit);
        self::assertSame(DogecoinRawTransaction::fromHex('00')->txid, $dogecoinTransaction->txid);
        self::assertSame(BitcoinRawTransaction::fromHex('00')->txid, $bitcoinTransaction->txid);
    }

    public function testAdaptersExposeExistingFeePoliciesThroughUtxoCapability(): void
    {
        $registry = new ChainAdapterRegistry([
            self::dogecoinAdapter(),
            self::bitcoinAdapter(),
        ]);

        $dogecoinFeeRate = $registry
            ->requireCapability('dogecoin', 'mainnet', UtxoFeeRateCapability::class)
            ->feeRate();
        $bitcoinFeeRate = $registry
            ->requireCapability('bitcoin', 'mainnet', UtxoFeeRateCapability::class)
            ->feeRate();

        self::assertSame('0.01', $dogecoinFeeRate->recommendedRate);
        self::assertSame(DogecoinFeePolicy::UNIT, $dogecoinFeeRate->unit);
        self::assertSame('0.0001', $bitcoinFeeRate->recommendedRate);
        self::assertSame(BitcoinFeePolicy::UNIT, $bitcoinFeeRate->unit);
    }

    private static function dogecoinAdapter(): DogecoinMainnetAdapter
    {
        $balanceProvider = new class implements DogecoinBalanceProvider {
            public function getConfirmedBalance(DogecoinAddress $address): AddressBalance
            {
                return new AddressBalance($address->value, 111_000_000);
            }
        };
        $utxoProvider = new class implements DogecoinUtxoProvider {
            public function getConfirmedUtxos(DogecoinAddress $address): array
            {
                return [new DogecoinUtxo(
                    str_repeat('ab', 32),
                    1,
                    333_000_000,
                    '76a914000000000000000000000000000000000000000088ac',
                    3,
                )];
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
            $utxoProvider,
            new DogecoinFeePolicy('0.01'),
            $broadcaster,
        );
    }

    private static function bitcoinAdapter(): BitcoinMainnetAdapter
    {
        $balanceProvider = new class implements BitcoinBalanceProvider {
            public function getConfirmedBalance(BitcoinAddress $address): AddressBalance
            {
                return new AddressBalance($address->value, 222_000);
            }
        };
        $utxoProvider = new class implements BitcoinUtxoProvider {
            public function getConfirmedUtxos(BitcoinAddress $address): array
            {
                return [new BitcoinUtxo(
                    str_repeat('cd', 32),
                    2,
                    444_000,
                    '76a914000000000000000000000000000000000000000088ac',
                    4,
                )];
            }
        };
        $broadcaster = new class implements BitcoinTransactionBroadcaster {
            public function broadcast(BitcoinRawTransaction $transaction): string
            {
                return $transaction->txid;
            }
        };

        return new BitcoinMainnetAdapter(
            $balanceProvider,
            $utxoProvider,
            new BitcoinFeePolicy('0.0001'),
            $broadcaster,
        );
    }
}
