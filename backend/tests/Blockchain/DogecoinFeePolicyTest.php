<?php

declare(strict_types=1);

namespace App\Tests\Blockchain;

use App\Blockchain\Application\DogecoinFeePolicy;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class DogecoinFeePolicyTest extends TestCase
{
    public function testKeepsValidRuntimeRate(): void
    {
        $policy = new DogecoinFeePolicy(' 0.01234567 ');

        self::assertSame('0.01234567', $policy->recommendedRateDogePerKb);
        self::assertSame('utxo-rate-per-kb', DogecoinFeePolicy::KIND);
        self::assertSame('DOGE/kB', DogecoinFeePolicy::UNIT);
    }

    #[DataProvider('invalidRates')]
    public function testRejectsInvalidRuntimeRate(string $rate): void
    {
        $this->expectException(\InvalidArgumentException::class);

        new DogecoinFeePolicy($rate);
    }

    /** @return iterable<string, array{string}> */
    public static function invalidRates(): iterable
    {
        yield 'empty' => [''];
        yield 'zero' => ['0'];
        yield 'negative' => ['-0.01'];
        yield 'text' => ['abc'];
        yield 'too precise' => ['0.000000001'];
    }
}
