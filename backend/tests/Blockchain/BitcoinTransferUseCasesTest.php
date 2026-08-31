<?php

declare(strict_types=1);

namespace App\Tests\Blockchain;

use App\Blockchain\Application\BroadcastBitcoinTransaction;
use App\Blockchain\Application\BroadcastFailed;
use App\Blockchain\Application\ChainAdapter;
use App\Blockchain\Application\ChainAdapterRegistry;
use App\Blockchain\Application\GetBitcoinAddressUtxos;
use App\Blockchain\Application\RawTransactionBroadcastCapability;
use App\Blockchain\Application\UtxoLookupCapability;
use App\Blockchain\Domain\BitcoinAddress;
use App\Blockchain\Domain\BitcoinRawTransaction;
use App\Blockchain\Domain\BitcoinUtxo;
use PHPUnit\Framework\TestCase;

final class BitcoinTransferUseCasesTest extends TestCase
{
    private const string VALID_ADDRESS = '1BoatSLRHtKNngkdXEeobR76b53LETtpyT';

    public function testAcceptsBitcoinMainnetP2pkhAddress(): void
    {
        self::assertSame(self::VALID_ADDRESS, BitcoinAddress::fromString(self::VALID_ADDRESS)->value);
    }

    public function testReturnsConfirmedUtxosThroughRegisteredCapability(): void
    {
        $adapter = new class implements ChainAdapter, UtxoLookupCapability {
            public function chain(): string
            {
                return 'bitcoin';
            }

            public function network(): string
            {
                return 'mainnet';
            }

            public function getConfirmedUtxos(string $address): array
            {
                return [new BitcoinUtxo(
                    str_repeat('ab', 32),
                    2,
                    250_000,
                    '76a914000000000000000000000000000000000000000088ac',
                    7,
                )];
            }
        };

        $utxos = (new GetBitcoinAddressUtxos(new ChainAdapterRegistry([$adapter])))(self::VALID_ADDRESS);

        self::assertCount(1, $utxos);
        self::assertSame(250_000, $utxos[0]->valueSmallestUnit);
        self::assertSame(7, $utxos[0]->confirmations);
    }

    public function testRejectsInvalidAddressBeforeAdapterLookup(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        (new GetBitcoinAddressUtxos(new ChainAdapterRegistry([])))('1BoatSLRHtKNngkdXEeobR76b53LETtpyU');
    }

    public function testBroadcastReturnsLocallyComputedTransactionIdentity(): void
    {
        $adapter = new class implements ChainAdapter, RawTransactionBroadcastCapability {
            public function chain(): string
            {
                return 'bitcoin';
            }

            public function network(): string
            {
                return 'mainnet';
            }

            public function broadcastRawTransaction(string $rawTransaction): string
            {
                return BitcoinRawTransaction::fromHex($rawTransaction)->txid;
            }
        };

        $transaction = (new BroadcastBitcoinTransaction(new ChainAdapterRegistry([$adapter])))('00');
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
                return 'bitcoin';
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
        (new BroadcastBitcoinTransaction(new ChainAdapterRegistry([$adapter])))('00');
    }
}
