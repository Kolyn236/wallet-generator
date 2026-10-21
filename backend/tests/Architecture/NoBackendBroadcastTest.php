<?php

declare(strict_types=1);

namespace App\Tests\Architecture;

use App\Kernel;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\RouterInterface;

final class NoBackendBroadcastTest extends TestCase
{
    public function testDefaultRouterPreservesPublicReadsAndPreparationWithoutBroadcastRoutes(): void
    {
        $kernel = new Kernel('test', false);
        $kernel->boot();

        try {
            $router = $kernel->getContainer()->get('router');
            self::assertInstanceOf(RouterInterface::class, $router);
            $routes = $router->getRouteCollection();

            foreach ($routes as $name => $route) {
                self::assertStringNotContainsString('broadcast', strtolower($name));
                self::assertStringNotContainsString('broadcast', strtolower($route->getPath()));
            }

            foreach (['dogecoin', 'bitcoin', 'litecoin'] as $chain) {
                foreach (['balance', 'utxos', 'fee_policy'] as $operation) {
                    $route = $routes->get('api_'.$chain.'_'.$operation);
                    self::assertNotNull($route);
                    self::assertSame(['GET'], $route->getMethods());
                }
            }
            foreach (['api_ethereum_balance', 'api_ethereum_usdt_erc20_balance'] as $name) {
                $route = $routes->get($name);
                self::assertNotNull($route);
                self::assertSame(['GET'], $route->getMethods());
            }
            $prepare = $routes->get('api_ethereum_prepare');
            self::assertNotNull($prepare);
            self::assertSame('/api/chains/ethereum/mainnet/transactions/prepare', $prepare->getPath());
            self::assertSame(['POST'], $prepare->getMethods());
        } finally {
            $kernel->shutdown();
        }
    }

    /** @param class-string $class */
    #[DataProvider('providerClassProvider')]
    public function testAdaptersAndProviderClientsHaveNoBroadcastMethods(string $class): void
    {
        $reflection = new \ReflectionClass($class);

        foreach ($reflection->getMethods(\ReflectionMethod::IS_PUBLIC) as $method) {
            self::assertStringNotContainsString('broadcast', strtolower($method->getName()), $class);
        }
        foreach ($reflection->getInterfaceNames() as $interface) {
            self::assertStringNotContainsString('broadcast', strtolower($interface), $class);
        }
    }

    /** @return iterable<string, array{class-string}> */
    public static function providerClassProvider(): iterable
    {
        foreach ([
            \App\Blockchain\Infrastructure\DogecoinMainnetAdapter::class,
            \App\Blockchain\Infrastructure\BitcoinMainnetAdapter::class,
            \App\Blockchain\Infrastructure\EthereumMainnetAdapter::class,
            \App\Blockchain\Infrastructure\LitecoinMainnetAdapter::class,
            \App\Blockchain\Infrastructure\EthereumJsonRpcClient::class,
            \App\Blockchain\Infrastructure\BlockCypherUtxoMainnetClient::class,
        ] as $class) {
            yield $class => [$class];
        }
    }

    #[DataProvider('chainProvider')]
    public function testBroadcastEndpointIsNotAvailable(string $chain): void
    {
        $kernel = new Kernel('test', false);

        try {
            // Empty public payload cannot trigger a provider call, even before removal.
            $request = Request::create('/api/chains/'.$chain.'/mainnet/transactions/broadcast', 'POST', server: ['CONTENT_TYPE' => 'application/json'], content: '{}');
            $response = $kernel->handle($request);

            self::assertSame(404, $response->getStatusCode());
            $kernel->terminate($request, $response);
        } finally {
            $kernel->shutdown();
        }
    }

    /** @return iterable<string, array{string}> */
    public static function chainProvider(): iterable
    {
        foreach (['dogecoin', 'bitcoin', 'ethereum', 'litecoin', 'tron'] as $chain) {
            yield $chain => [$chain];
        }
    }
}
