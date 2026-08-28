<?php

declare(strict_types=1);

namespace App\Tests\Blockchain;

use App\Blockchain\Application\BitcoinFeePolicy;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class BitcoinFeePolicyTest extends TestCase
{
    public function testKeepsValidRuntimeRate(): void
    {
        $policy = new BitcoinFeePolicy(' 0.00010000 ');

        self::assertSame('0.00010000', $policy->recommendedRateBtcPerKb);
        self::assertSame('utxo-rate-per-kb', BitcoinFeePolicy::KIND);
        self::assertSame('BTC/kB', BitcoinFeePolicy::UNIT);
    }

    #[DataProvider('invalidRates')]
    public function testRejectsInvalidRuntimeRate(string $rate): void
    {
        $this->expectException(\InvalidArgumentException::class);
        new BitcoinFeePolicy($rate);
    }

    /** @return iterable<string, array{string}> */
    public static function invalidRates(): iterable
    {
        yield 'empty' => [''];
        yield 'zero' => ['0'];
        yield 'negative' => ['-0.0001'];
        yield 'text' => ['abc'];
        yield 'too precise' => ['0.000000001'];
    }
}
