<?php

declare(strict_types=1);

namespace App\Tests\Blockchain;

use App\Blockchain\Application\BitcoinTransactionBroadcaster;
use App\Blockchain\Application\BitcoinUtxoProvider;
use App\Blockchain\Application\BroadcastBitcoinTransaction;
use App\Blockchain\Application\BroadcastFailed;
use App\Blockchain\Application\GetBitcoinAddressUtxos;
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

    public function testReturnsConfirmedUtxosThroughApplicationPort(): void
    {
        $provider = new class implements BitcoinUtxoProvider {
            public function getConfirmedUtxos(BitcoinAddress $address): array
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

        $utxos = (new GetBitcoinAddressUtxos($provider))(self::VALID_ADDRESS);

        self::assertCount(1, $utxos);
        self::assertSame(250_000, $utxos[0]->valueSmallestUnit);
        self::assertSame(7, $utxos[0]->confirmations);
    }

    public function testRejectsInvalidAddressBeforeUtxoProviderCall(): void
    {
        $provider = new class implements BitcoinUtxoProvider {
            public function getConfirmedUtxos(BitcoinAddress $address): array
            {
                throw new \LogicException('Provider must not be called for an invalid address.');
            }
        };

        $this->expectException(\InvalidArgumentException::class);
        (new GetBitcoinAddressUtxos($provider))('1BoatSLRHtKNngkdXEeobR76b53LETtpyU');
    }

    public function testBroadcastReturnsLocallyComputedTransactionIdentity(): void
    {
        $broadcaster = new class implements BitcoinTransactionBroadcaster {
            public function broadcast(BitcoinRawTransaction $transaction): string
            {
                return $transaction->txid;
            }
        };

        $transaction = (new BroadcastBitcoinTransaction($broadcaster))('00');
        $expected = bin2hex(strrev(hash('sha256', hash('sha256', "\x00", true), true)));

        self::assertSame($expected, $transaction->txid);
        self::assertSame(1, $transaction->sizeBytes);
        self::assertSame('00', $transaction->hex);
    }

    public function testRejectsProviderTxidMismatch(): void
    {
        $broadcaster = new class implements BitcoinTransactionBroadcaster {
            public function broadcast(BitcoinRawTransaction $transaction): string
            {
                return str_repeat('0', 64);
            }
        };

        $this->expectException(BroadcastFailed::class);
        $this->expectExceptionMessage('provider_txid_mismatch');
        (new BroadcastBitcoinTransaction($broadcaster))('00');
    }
}
