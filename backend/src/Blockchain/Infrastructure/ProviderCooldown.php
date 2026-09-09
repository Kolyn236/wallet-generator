<?php

declare(strict_types=1);

namespace App\Blockchain\Infrastructure;

use Psr\Cache\CacheItemPoolInterface;

final readonly class ProviderCooldown
{
    public function __construct(
        private CacheItemPoolInterface $pool,
        private ProviderRequestLogger $logger,
        private int $cooldownSeconds,
    ) {
        if ($this->cooldownSeconds < 1) {
            throw new \InvalidArgumentException('Provider cooldown must be positive.');
        }
    }

    public function isActive(string $provider, string $chain, string $network, string $operation): bool
    {
        $item = $this->pool->getItem(self::key($provider, $chain, $network, $operation));
        if (!$item->isHit() || true !== $item->get()) {
            return false;
        }

        $this->logger->warning([
            'provider' => $provider,
            'chain' => $chain,
            'network' => $network,
            'operation' => $operation,
            'reason' => 'provider_cooldown',
            'outcome' => 'provider_call_suppressed',
            'provider_cooldown' => true,
        ]);

        return true;
    }

    public function trip(string $provider, string $chain, string $network, string $operation): void
    {
        $item = $this->pool->getItem(self::key($provider, $chain, $network, $operation));
        $item->set(true);
        $item->expiresAfter($this->cooldownSeconds);
        $this->pool->save($item);

        $this->logger->warning([
            'provider' => $provider,
            'chain' => $chain,
            'network' => $network,
            'operation' => $operation,
            'reason' => 'provider_rate_limited',
            'outcome' => 'provider_cooldown_started',
            'provider_cooldown' => true,
            'cooldown_seconds' => $this->cooldownSeconds,
        ]);
    }

    private static function key(string $provider, string $chain, string $network, string $operation): string
    {
        return 'provider_cooldown.'.hash('sha256', implode("\0", [$provider, $chain, $network, $operation]));
    }
}
