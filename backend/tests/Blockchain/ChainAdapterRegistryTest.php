<?php

declare(strict_types=1);

namespace App\Tests\Blockchain;

use App\Blockchain\Application\AddressBalanceCapability;
use App\Blockchain\Application\ChainAdapter;
use App\Blockchain\Application\ChainAdapterNotFound;
use App\Blockchain\Application\ChainAdapterRegistry;
use App\Blockchain\Application\DuplicateChainAdapter;
use App\Blockchain\Application\UnsupportedChainCapability;
use PHPUnit\Framework\TestCase;

final class ChainAdapterRegistryTest extends TestCase
{
    public function testLooksUpAdaptersByExactChainAndNetwork(): void
    {
        $dogecoin = self::adapter('dogecoin', 'mainnet');
        $bitcoin = self::adapter('bitcoin', 'mainnet');
        $registry = new ChainAdapterRegistry([$dogecoin, $bitcoin]);

        self::assertSame($dogecoin, $registry->get('dogecoin', 'mainnet'));
        self::assertSame($bitcoin, $registry->get('bitcoin', 'mainnet'));
    }

    public function testRejectsDuplicateChainAndNetworkRegistration(): void
    {
        $this->expectException(DuplicateChainAdapter::class);
        $this->expectExceptionMessage('dogecoin:mainnet');

        new ChainAdapterRegistry([
            self::adapter('dogecoin', 'mainnet'),
            self::adapter('dogecoin', 'mainnet'),
        ]);
    }

    public function testMissingAdapterFailsExplicitly(): void
    {
        $registry = new ChainAdapterRegistry([]);

        $this->expectException(ChainAdapterNotFound::class);
        $this->expectExceptionMessage('bitcoin:mainnet');

        $registry->get('bitcoin', 'mainnet');
    }

    public function testUnsupportedCapabilityFailsClosed(): void
    {
        $registry = new ChainAdapterRegistry([self::adapter('dogecoin', 'mainnet')]);

        $this->expectException(UnsupportedChainCapability::class);
        $this->expectExceptionMessage(AddressBalanceCapability::class);

        $registry->requireCapability('dogecoin', 'mainnet', AddressBalanceCapability::class);
    }

    private static function adapter(string $chain, string $network): ChainAdapter
    {
        return new readonly class($chain, $network) implements ChainAdapter {
            public function __construct(
                private string $chainId,
                private string $networkId,
            ) {
            }

            public function chain(): string
            {
                return $this->chainId;
            }

            public function network(): string
            {
                return $this->networkId;
            }
        };
    }
}
