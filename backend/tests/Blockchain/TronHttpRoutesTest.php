<?php

declare(strict_types=1);

namespace App\Tests\Blockchain;

use App\Kernel;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Request;

final class TronHttpRoutesTest extends TestCase
{
    public function testRuntimeRegistrationAndMissingConfigurationFailClosed(): void
    {
        $previous = $_ENV;
        $_ENV['TRON_RPC_URL'] = '';
        $_ENV['ETHEREUM_RPC_URL'] = '';
        $_ENV['DOGE_RECOMMENDED_FEE_RATE'] = '0.01';
        $_ENV['BTC_RECOMMENDED_FEE_RATE'] = '0.00010000';
        $kernel = new Kernel('test', false);
        try {
            $response = $kernel->handle(Request::create('/api/chains/tron/mainnet/tokens/usdt/addresses/TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t/balance'));
            self::assertSame(503, $response->getStatusCode());
            self::assertSame(['error' => 'provider_not_configured'], json_decode((string) $response->getContent(), true));
            $response = $kernel->handle(Request::create('/api/chains/tron/mainnet/transactions/prepare', 'POST', content: '{"assetRouteId":"usdt-tron-mainnet-trc20","from":"bad","to":"bad","amountBaseUnits":"1"}'));
            self::assertSame(400, $response->getStatusCode());
            $response = $kernel->handle(Request::create('/api/chains/tron/mainnet/transactions/not-a-transaction'));
            self::assertSame(404, $response->getStatusCode());
        } finally {
            $kernel->shutdown();
            $_ENV = $previous;
        }
    }
}
