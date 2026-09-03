<?php

declare(strict_types=1);

namespace App\Blockchain\Infrastructure;

use App\Blockchain\Application\SuccessfulBroadcastStore;
use Psr\Cache\CacheItemPoolInterface;

final readonly class CacheSuccessfulBroadcastStore implements SuccessfulBroadcastStore
{
    public function __construct(
        private CacheItemPoolInterface $pool,
        private ProviderRequestLogger $logger,
        private int $ttlSeconds,
    ) {
        if ($this->ttlSeconds < 1) {
            throw new \InvalidArgumentException('Broadcast dedupe TTL must be positive.');
        }
    }

    public function findSuccessfulTxid(string $chain, string $network, string $signedPayloadFingerprint): ?string
    {
        $index = $this->pool->getItem(self::fingerprintKey($chain, $network, $signedPayloadFingerprint));
        $txid = $index->isHit() ? $index->get() : null;
        if (!\is_string($txid) || '' === $txid) {
            return null;
        }

        $success = $this->pool->getItem(self::successKey($chain, $network, $txid));
        if (!$success->isHit() || true !== $success->get()) {
            $this->pool->deleteItem($index->getKey());

            return null;
        }

        $this->logger->info([
            'chain' => $chain,
            'network' => $network,
            'operation' => 'broadcast',
            'outcome' => 'duplicate_suppressed',
            'txid' => $txid,
        ]);

        return $txid;
    }

    public function rememberSuccessful(
        string $chain,
        string $network,
        string $txid,
        string $signedPayloadFingerprint,
    ): void {
        $success = $this->pool->getItem(self::successKey($chain, $network, $txid));
        $success->set(true);
        $success->expiresAfter($this->ttlSeconds);
        $this->pool->save($success);

        $index = $this->pool->getItem(self::fingerprintKey($chain, $network, $signedPayloadFingerprint));
        $index->set($txid);
        $index->expiresAfter($this->ttlSeconds);
        $this->pool->save($index);
    }

    private static function successKey(string $chain, string $network, string $txid): string
    {
        return 'broadcast_success.'.hash('sha256', implode("\0", [$chain, $network, strtolower($txid)]));
    }

    private static function fingerprintKey(string $chain, string $network, string $fingerprint): string
    {
        return 'broadcast_index.'.hash('sha256', implode("\0", [$chain, $network, strtolower($fingerprint)]));
    }
}
