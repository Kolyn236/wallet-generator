<?php

declare(strict_types=1);

namespace App\Tests\Blockchain;

use App\Blockchain\Application\BroadcastDogecoinTransaction;
use App\Blockchain\Application\BroadcastFailed;
use App\Blockchain\Application\ChainAdapter;
use App\Blockchain\Application\ChainAdapterRegistry;
use App\Blockchain\Application\GetDogecoinAddressUtxos;
use App\Blockchain\Application\RawTransactionBroadcastCapability;
use App\Blockchain\Application\UtxoLookupCapability;
use App\Blockchain\Domain\DogecoinRawTransaction;
use App\Blockchain\Domain\DogecoinUtxo;
use PHPUnit\Framework\TestCase;

final class DogecoinTransferUseCasesTest extends TestCase
{
    private const string VALID_ADDRESS = 'D9popZh3N9mNNwTVwrG9jLLuS5Ym8tEYvd';

    public function testReturnsConfirmedUtxosThroughRegisteredCapability(): void
    {
        $adapter = new class implements ChainAdapter, UtxoLookupCapability {
            public function chain(): string
            {
                return 'dogecoin';
            }

            public function network(): string
            {
                return 'mainnet';
            }

            public function getConfirmedUtxos(string $address): array
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

        $utxos = (new GetDogecoinAddressUtxos(new ChainAdapterRegistry([$adapter])))(self::VALID_ADDRESS);

        self::assertCount(1, $utxos);
        self::assertSame(250_000_000, $utxos[0]->valueSmallestUnit);
        self::assertSame(7, $utxos[0]->confirmations);
    }

    public function testRejectsInvalidAddressBeforeAdapterLookup(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        (new GetDogecoinAddressUtxos(new ChainAdapterRegistry([])))('D9popZh3N9mNNwTVwrG9jLLuS5Ym8tEYve');
    }

    public function testBroadcastReturnsLocallyComputedTransactionIdentity(): void
    {
        $adapter = new class implements ChainAdapter, RawTransactionBroadcastCapability {
            public function chain(): string
            {
                return 'dogecoin';
            }

            public function network(): string
            {
                return 'mainnet';
            }

            public function broadcastRawTransaction(string $rawTransaction): string
            {
                return DogecoinRawTransaction::fromHex($rawTransaction)->txid;
            }
        };

        $transaction = (new BroadcastDogecoinTransaction(new ChainAdapterRegistry([$adapter])))('00');
        $expected = bin2hex(strrev(hash('sha256', hash('sha256', "\x00", true), true)));

        self::assertSame($expected, $transaction->txid);
        self::assertSame(1, $transaction->sizeBytes);
        self::assertSame('00', $transaction->hex);
    }

    public function testRejectsProviderTxidMismatch(): void
    {
        $adapter = new class implements ChainAdapter, RawTransactionBroadcastCapability {
            public function chain(): string
            {
                return 'dogecoin';
            }

            public function network(): string
            {
                return 'mainnet';
            }

            public function broadcastRawTransaction(string $rawTransaction): string
            {
                return str_repeat('0', 64);
            }
        };

        $this->expectException(BroadcastFailed::class);
        $this->expectExceptionMessage('provider_txid_mismatch');

        (new BroadcastDogecoinTransaction(new ChainAdapterRegistry([$adapter])))('00');
    }

    public function testRejectsInvalidRawTransactionBeforeAdapterLookup(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        (new BroadcastDogecoinTransaction(new ChainAdapterRegistry([])))('not-hex');
    }
}
