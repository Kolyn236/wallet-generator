<?php

declare(strict_types=1);

namespace App\Tests\Blockchain;

use App\Blockchain\Application\DogecoinBalanceProvider;
use App\Blockchain\Application\GetDogecoinAddressBalance;
use App\Blockchain\Domain\AddressBalance;
use App\Blockchain\Domain\DogecoinAddress;
use PHPUnit\Framework\TestCase;

final class GetDogecoinAddressBalanceTest extends TestCase
{
    private const string VALID_ADDRESS = 'D9popZh3N9mNNwTVwrG9jLLuS5Ym8tEYvd';

    public function testReturnsProviderBalanceWithoutFloatingPointMath(): void
    {
        $provider = new class implements DogecoinBalanceProvider {
            public function getConfirmedBalance(DogecoinAddress $address): AddressBalance
            {
                return new AddressBalance($address->value, 412_345_678);
            }
        };

        $balance = (new GetDogecoinAddressBalance($provider))(self::VALID_ADDRESS);

        self::assertSame(self::VALID_ADDRESS, $balance->address);
        self::assertSame('4.12345678', $balance->decimal());
        self::assertSame(412_345_678, $balance->smallestUnit);
    }

    public function testRejectsInvalidChecksumBeforeProviderCall(): void
    {
        $provider = new class implements DogecoinBalanceProvider {
            public function getConfirmedBalance(DogecoinAddress $address): AddressBalance
            {
                throw new \LogicException('Provider must not be called for an invalid address.');
            }
        };

        $this->expectException(\InvalidArgumentException::class);

        (new GetDogecoinAddressBalance($provider))('D9popZh3N9mNNwTVwrG9jLLuS5Ym8tEYve');
    }
}
