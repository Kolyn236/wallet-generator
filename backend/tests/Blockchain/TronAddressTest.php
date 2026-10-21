<?php

declare(strict_types=1);

namespace App\Tests\Blockchain;

use App\Blockchain\Domain\TronAddress;
use PHPUnit\Framework\TestCase;

final class TronAddressTest extends TestCase
{
    public function testFullBase58CheckDecoding(): void
    {
        self::assertSame('41a614f803b6fd780986a42c78ec9c7f77e6ded13c', TronAddress::fromString('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')->hex);
    }

    public function testBadChecksumFails(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        TronAddress::fromString('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6u');
    }
}
