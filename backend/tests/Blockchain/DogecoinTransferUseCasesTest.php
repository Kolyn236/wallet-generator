<?php

declare(strict_types=1);

namespace App\Tests\Blockchain;

use App\Blockchain\Application\BroadcastDogecoinTransaction;
use App\Blockchain\Application\BroadcastFailed;
use App\Blockchain\Application\DogecoinTransactionBroadcaster;
use App\Blockchain\Application\DogecoinUtxoProvider;
use App\Blockchain\Application\GetDogecoinAddressUtxos;
use App\Blockchain\Domain\DogecoinAddress;
use App\Blockchain\Domain\DogecoinRawTransaction;
use App\Blockchain\Domain\DogecoinUtxo;
use PHPUnit\Framework\TestCase;

final class DogecoinTransferUseCasesTest extends TestCase
{
    private const string VALID_ADDRESS = 'D9popZh3N9mNNwTVwrG9jLLuS5Ym8tEYvd';

    public function testReturnsConfirmedUtxosThroughApplicationPort(): void
    {
        $provider = new class implements DogecoinUtxoProvider {
            public function getConfirmedUtxos(DogecoinAddress $address): array
            {
                return [new DogecoinUtxo(
                    str_repeat('ab', 32),
                    2,
                    250_000_000,
                    '76a914000000000000000000000000000000000000000088ac',
                    7,
                )];
            }
        };

        $utxos = (new GetDogecoinAddressUtxos($provider))(self::VALID_ADDRESS);

        self::assertCount(1, $utxos);
        self::assertSame(250_000_000, $utxos[0]->valueSmallestUnit);
        self::assertSame(7, $utxos[0]->confirmations);
    }

    public function testRejectsInvalidAddressBeforeUtxoProviderCall(): void
    {
        $provider = new class implements DogecoinUtxoProvider {
            public function getConfirmedUtxos(DogecoinAddress $address): array
            {
                throw new \LogicException('Provider must not be called for an invalid address.');
            }
        };

        $this->expectException(\InvalidArgumentException::class);

        (new GetDogecoinAddressUtxos($provider))('D9popZh3N9mNNwTVwrG9jLLuS5Ym8tEYve');
    }

    public function testBroadcastReturnsLocallyComputedTransactionIdentity(): void
    {
        $broadcaster = new class implements DogecoinTransactionBroadcaster {
            public function broadcast(DogecoinRawTransaction $transaction): string
            {
                return $transaction->txid;
            }
        };

        $transaction = (new BroadcastDogecoinTransaction($broadcaster))('00');
        $expected = bin2hex(strrev(hash('sha256', hash('sha256', "\x00", true), true)));

        self::assertSame($expected, $transaction->txid);
        self::assertSame(1, $transaction->sizeBytes);
        self::assertSame('00', $transaction->hex);
    }

    public function testRejectsProviderTxidMismatch(): void
    {
        $broadcaster = new class implements DogecoinTransactionBroadcaster {
            public function broadcast(DogecoinRawTransaction $transaction): string
            {
                return str_repeat('0', 64);
            }
        };

        $this->expectException(BroadcastFailed::class);
        $this->expectExceptionMessage('provider_txid_mismatch');

        (new BroadcastDogecoinTransaction($broadcaster))('00');
    }

    public function testRejectsInvalidRawTransactionBeforeProviderCall(): void
    {
        $broadcaster = new class implements DogecoinTransactionBroadcaster {
            public function broadcast(DogecoinRawTransaction $transaction): string
            {
                throw new \LogicException('Provider must not be called for invalid raw transaction data.');
            }
        };

        $this->expectException(\InvalidArgumentException::class);

        (new BroadcastDogecoinTransaction($broadcaster))('not-hex');
    }
}
