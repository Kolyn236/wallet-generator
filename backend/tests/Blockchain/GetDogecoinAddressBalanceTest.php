<?php

declare(strict_types=1);

namespace App\Tests\Blockchain;

use App\Blockchain\Application\AddressBalanceCapability;
use App\Blockchain\Application\ChainAdapter;
use App\Blockchain\Application\ChainAdapterRegistry;
use App\Blockchain\Application\GetDogecoinAddressBalance;
use App\Blockchain\Domain\AddressBalance;
use PHPUnit\Framework\TestCase;

final class GetDogecoinAddressBalanceTest extends TestCase
{
    private const string VALID_ADDRESS = 'D9popZh3N9mNNwTVwrG9jLLuS5Ym8tEYvd';

    public function testReturnsAdapterBalanceWithoutFloatingPointMath(): void
    {
        $adapter = new class implements ChainAdapter, AddressBalanceCapability {
            public function chain(): string
            {
                return 'dogecoin';
            }

            public function network(): string
            {
                return 'mainnet';
            }

            public function getConfirmedBalance(string $address): AddressBalance
            {
                return new AddressBalance($address, 412_345_678);
            }
        };

        $balance = (new GetDogecoinAddressBalance(new ChainAdapterRegistry([$adapter])))(self::VALID_ADDRESS);

        self::assertSame(self::VALID_ADDRESS, $balance->address);
        self::assertSame('4.12345678', $balance->decimal());
        self::assertSame(412_345_678, $balance->smallestUnit);
    }

    public function testRejectsInvalidChecksumBeforeAdapterLookup(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        (new GetDogecoinAddressBalance(new ChainAdapterRegistry([])))('D9popZh3N9mNNwTVwrG9jLLuS5Ym8tEYve');
    }
}
