<?php

declare(strict_types=1);

namespace App\Tests\Blockchain;

use App\Blockchain\Domain\EvmQuantity;
use PHPUnit\Framework\TestCase;

final class EvmQuantityTest extends TestCase
{
    public function testMaximumUint256RoundTripsWithoutNativeBigIntegerExtension(): void
    {
        $hex = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
        $decimal = '115792089237316195423570985008687907853269984665640564039457584007913129639935';

        $quantity = EvmQuantity::fromHex($hex);

        self::assertSame($decimal, $quantity->decimal);
        self::assertSame($hex, $quantity->toHex());
    }

    public function testDecimalValueConvertsToCanonicalHexQuantity(): void
    {
        self::assertSame('0x38d7ea4c68000', EvmQuantity::fromDecimal('1000000000000000')->toHex());
        self::assertSame('0x0', EvmQuantity::fromDecimal('0')->toHex());
    }

    public function testEip1559PolicyArithmeticIsExact(): void
    {
        $baseFee = EvmQuantity::fromDecimal('20000000000');
        $priorityFee = EvmQuantity::fromDecimal('1000000000');

        self::assertSame('41000000000', $baseFee->doubledPlus($priorityFee)->decimal);
    }

    public function testNonCanonicalQuantitiesAreRejected(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        EvmQuantity::fromHex('0x00');
    }
}
