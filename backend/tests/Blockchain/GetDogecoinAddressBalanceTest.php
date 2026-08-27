<?php

declare(strict_types=1);

namespace App\Tests\Blockchain;

use App\Blockchain\Application\DogecoinBalanceProvider;
use App\Blockchain\Application\GetDogecoinAddressBalance;
use App\Blockchain\Domain\AddressBalance;
use InvalidArgumentException;
use LogicException;
use PHPUnit\Framework\TestCase;

final class GetDogecoinAddressBalanceTest extends TestCase
{
    public function testReturnsProviderBalanceWithoutFloatingPointMath(): void
    {
        $provider = new class implements DogecoinBalanceProvider {
            public function getConfirmedBalance(string $address): AddressBalance
            {
                return new AddressBalance($address, 412_345_678);
            }
        };

        $balance = (new GetDogecoinAddressBalance($provider))('D8B7Q2uWqvFhC8dZp4tRk6Nn3Lm5Ys9Xa');

        self::assertSame('4.12345678', $balance->decimal());
        self::assertSame(412_345_678, $balance->smallestUnit);
    }

    public function testRejectsObviouslyInvalidAddressBeforeProviderCall(): void
    {
        $provider = new class implements DogecoinBalanceProvider {
            public function getConfirmedBalance(string $address): AddressBalance
            {
                throw new LogicException('Provider must not be called for an invalid address.');
            }
        };

        $this->expectException(InvalidArgumentException::class);

        (new GetDogecoinAddressBalance($provider))('not-a-doge-address');
    }
}
