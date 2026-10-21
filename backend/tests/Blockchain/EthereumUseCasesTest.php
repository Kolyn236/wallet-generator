<?php

declare(strict_types=1);

namespace App\Tests\Blockchain;

use App\Blockchain\Application\ChainAdapter;
use App\Blockchain\Application\ChainAdapterRegistry;
use App\Blockchain\Application\Eip1559FeeQuote;
use App\Blockchain\Application\Eip1559FeeQuoteCapability;
use App\Blockchain\Application\EvmGasEstimateCapability;
use App\Blockchain\Application\EvmNativeBalanceCapability;
use App\Blockchain\Application\EvmPendingNonceCapability;
use App\Blockchain\Application\EvmTransactionIntent;
use App\Blockchain\Application\GetEthereumAddressBalance;
use App\Blockchain\Application\PrepareEthereumTransaction;
use PHPUnit\Framework\TestCase;

final class EthereumUseCasesTest extends TestCase
{
    private const string FROM = '0x1111111111111111111111111111111111111111';
    private const string TO = '0x2222222222222222222222222222222222222222';

    public function testBalanceFormattingUsesEighteenDecimalsWithoutFloat(): void
    {
        $registry = new ChainAdapterRegistry([self::adapter()]);

        $balance = (new GetEthereumAddressBalance($registry))(self::FROM);

        self::assertSame('1234500000000000000', $balance->balanceWei);
        self::assertSame('1.2345', $balance->decimal());
    }

    public function testPreparePropagatesPublicSnapshotLosslessly(): void
    {
        $registry = new ChainAdapterRegistry([self::adapter()]);
        $intent = new EvmTransactionIntent(
            self::FROM,
            self::TO,
            '1000000000000000',
            '0x',
        );

        $prepared = (new PrepareEthereumTransaction($registry))($intent);

        self::assertSame(1, $prepared::CHAIN_ID);
        self::assertSame(self::FROM, $prepared->intent->from);
        self::assertSame(self::TO, $prepared->intent->to);
        self::assertSame('1000000000000000', $prepared->intent->valueWei);
        self::assertSame('0x', $prepared->intent->data);
        self::assertSame('1234500000000000000', $prepared->senderBalanceWei);
        self::assertSame('9223372036854775808', $prepared->nonce);
        self::assertSame('21000', $prepared->gasLimit);
        self::assertSame('20000000000', $prepared->feePolicy->baseFeePerGasWei);
        self::assertSame('1000000000', $prepared->feePolicy->maxPriorityFeePerGasWei);
        self::assertSame('41000000000', $prepared->feePolicy->maxFeePerGasWei);
    }

    public function testTransactionIntentRejectsMalformedCalldata(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        new EvmTransactionIntent(self::FROM, self::TO, '1', '0x123');
    }

    public function testTransactionIntentRejectsNonCanonicalDecimalAmount(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        new EvmTransactionIntent(self::FROM, self::TO, '01', '0x');
    }

    private static function adapter(): ChainAdapter
    {
        return new class implements ChainAdapter, EvmNativeBalanceCapability, EvmPendingNonceCapability, EvmGasEstimateCapability, Eip1559FeeQuoteCapability {
            public function chain(): string
            {
                return 'ethereum';
            }

            public function network(): string
            {
                return 'mainnet';
            }

            public function nativeBalanceWei(string $address): string
            {
                return '1234500000000000000';
            }

            public function pendingNonce(string $address): string
            {
                return '9223372036854775808';
            }

            public function estimateGas(EvmTransactionIntent $intent): string
            {
                return '21000';
            }

            public function eip1559FeeQuote(): Eip1559FeeQuote
            {
                return new Eip1559FeeQuote('20000000000', '1000000000', '41000000000');
            }
        };
    }
}
