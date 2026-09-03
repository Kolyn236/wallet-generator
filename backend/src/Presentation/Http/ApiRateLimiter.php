<?php

declare(strict_types=1);

namespace App\Presentation\Http;

use Psr\Cache\CacheItemPoolInterface;

final readonly class ApiRateLimiter
{
    /**
     * @param array<string, array{limit: int, window: int}> $policies
     */
    public function __construct(
        private CacheItemPoolInterface $pool,
        private ApiClock $clock,
        private array $policies,
    ) {
    }

    public function consume(string $policy, string $clientIdentifier): ApiRateLimitDecision
    {
        $config = $this->policies[$policy] ?? null;
        if (null === $config || $config['limit'] < 1 || $config['window'] < 1) {
            throw new \LogicException('Unknown or invalid API rate-limit policy: '.$policy);
        }

        $now = $this->clock->now();
        $window = $config['window'];
        $windowStart = intdiv($now, $window) * $window;
        $retryAfter = max(1, ($windowStart + $window) - $now);
        $key = 'api_rate_limit.'.hash('sha256', $policy."\0".$clientIdentifier."\0".$windowStart);
        $item = $this->pool->getItem($key);
        $stored = $item->get();
        $current = $item->isHit() && \is_int($stored) ? $stored : 0;

        if ($current >= $config['limit']) {
            return new ApiRateLimitDecision(false, $retryAfter);
        }

        $item->set($current + 1);
        $item->expiresAfter($retryAfter + 1);
        $this->pool->save($item);

        return new ApiRateLimitDecision(true, 0);
    }
}
