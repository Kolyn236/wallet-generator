<?php

declare(strict_types=1);

namespace App\Blockchain\Infrastructure;

use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;

final readonly class ProviderReadCache
{
    /**
     * @param array<string, int> $ttls
     */
    public function __construct(
        private CacheInterface $cache,
        private array $ttls,
    ) {
    }

    /**
     * @template T
     *
     * @param array<string, int|string> $context
     * @param callable(): T             $loader
     *
     * @return T
     */
    public function remember(
        string $chain,
        string $network,
        string $operation,
        array $context,
        callable $loader,
    ): mixed {
        $ttl = $this->ttls[$operation] ?? 10;
        if ($ttl < 1) {
            throw new \LogicException('Provider read cache TTL must be positive.');
        }

        ksort($context);
        $scope = json_encode([
            'chain' => $chain,
            'network' => $network,
            'operation' => $operation,
            'context' => $context,
        ], \JSON_THROW_ON_ERROR | \JSON_UNESCAPED_SLASHES);
        $key = 'provider_read.'.hash('sha256', $scope);

        return $this->cache->get($key, static function (ItemInterface $item) use ($ttl, $loader): mixed {
            $item->expiresAfter($ttl);

            return $loader();
        });
    }
}
