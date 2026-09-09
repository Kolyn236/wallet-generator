<?php

declare(strict_types=1);

namespace App\Tests\Presentation\Http;

use App\Presentation\Http\ApiAbuseLogger;
use App\Presentation\Http\ApiClock;
use App\Presentation\Http\ApiRateLimiter;
use App\Presentation\Http\ApiRateLimitSubscriber;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Cache\Adapter\ArrayAdapter;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\HttpKernelInterface;

final class ApiRateLimitSubscriberTest extends TestCase
{
    public function testNormalRequestsRemainBelowLimit(): void
    {
        $clock = new TestApiClock(1_000);
        $limiter = new ApiRateLimiter(new ArrayAdapter(), $clock, [
            'balance' => ['limit' => 2, 'window' => 60],
        ]);

        self::assertTrue($limiter->consume('balance', '203.0.113.10')->accepted);
        self::assertTrue($limiter->consume('balance', '203.0.113.10')->accepted);
    }

    public function testExhaustionReturnsStable429AndRetryAfter(): void
    {
        $clock = new TestApiClock(1_000);
        $subscriber = self::subscriber($clock, 2);

        self::assertNull(self::dispatch($subscriber)->getResponse());
        self::assertNull(self::dispatch($subscriber)->getResponse());

        $response = self::requireResponse(self::dispatch($subscriber)->getResponse());
        self::assertSame(429, $response->getStatusCode());
        self::assertSame('20', $response->headers->get('Retry-After'));
        $content = $response->getContent();
        self::assertIsString($content);
        self::assertSame([
            'error' => 'rate_limited',
            'reason' => 'too_many_requests',
            'operation' => 'balance',
        ], json_decode($content, true, 512, \JSON_THROW_ON_ERROR));
    }

    public function testRejectedRequestDoesNotReachProviderWork(): void
    {
        $clock = new TestApiClock(1_000);
        $subscriber = self::subscriber($clock, 1);
        $providerCalls = 0;

        foreach ([1, 2] as $_) {
            $event = self::dispatch($subscriber);
            if (null === $event->getResponse()) {
                ++$providerCalls;
            }
        }

        self::assertSame(1, $providerCalls);
    }

    public function testDifferentClientsHaveIndependentLimits(): void
    {
        $clock = new TestApiClock(1_000);
        $limiter = new ApiRateLimiter(new ArrayAdapter(), $clock, [
            'broadcast' => ['limit' => 1, 'window' => 60],
        ]);

        self::assertTrue($limiter->consume('broadcast', '198.51.100.1')->accepted);
        self::assertFalse($limiter->consume('broadcast', '198.51.100.1')->accepted);
        self::assertTrue($limiter->consume('broadcast', '198.51.100.2')->accepted);
    }

    private static function subscriber(TestApiClock $clock, int $limit): ApiRateLimitSubscriber
    {
        return new ApiRateLimitSubscriber(
            new ApiRateLimiter(new ArrayAdapter(), $clock, [
                'balance' => ['limit' => $limit, 'window' => 60],
            ]),
            new ApiAbuseLogger(),
            ['api_dogecoin_balance' => 'balance'],
        );
    }

    private static function requireResponse(?Response $response): Response
    {
        if (null === $response) {
            throw new \RuntimeException('Expected a rate-limited response.');
        }

        return $response;
    }

    private static function dispatch(ApiRateLimitSubscriber $subscriber): RequestEvent
    {
        $request = Request::create(
            '/api/chains/dogecoin/mainnet/addresses/D9popZh3N9mNNwTVwrG9jLLuS5Ym8tEYvd/balance',
            'GET',
            server: [
                'REMOTE_ADDR' => '203.0.113.10',
                'HTTP_X_FORWARDED_FOR' => '198.51.100.200',
            ],
        );
        $request->attributes->set('_route', 'api_dogecoin_balance');
        $request->attributes->set('address', 'D9popZh3N9mNNwTVwrG9jLLuS5Ym8tEYvd');

        $event = new RequestEvent(new TestHttpKernel(), $request, HttpKernelInterface::MAIN_REQUEST);
        $subscriber->onKernelRequest($event);

        return $event;
    }
}

final class TestApiClock implements ApiClock
{
    public function __construct(public int $timestamp)
    {
    }

    public function now(): int
    {
        return $this->timestamp;
    }
}

final class TestHttpKernel implements HttpKernelInterface
{
    public function handle(Request $request, int $type = self::MAIN_REQUEST, bool $catch = true): Response
    {
        return new Response();
    }
}
