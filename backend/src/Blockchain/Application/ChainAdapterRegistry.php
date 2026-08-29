<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

final class ChainAdapterRegistry
{
    /** @var array<string, ChainAdapter> */
    private array $adaptersByKey = [];

    /**
     * @param iterable<ChainAdapter> $adapters
     */
    public function __construct(iterable $adapters)
    {
        foreach ($adapters as $adapter) {
            $key = self::key($adapter->chain(), $adapter->network());

            if (isset($this->adaptersByKey[$key])) {
                throw new DuplicateChainAdapter(\sprintf('Duplicate chain adapter registered for "%s".', $key));
            }

            $this->adaptersByKey[$key] = $adapter;
        }
    }

    public function get(string $chain, string $network): ChainAdapter
    {
        $key = self::key($chain, $network);

        return $this->adaptersByKey[$key]
            ?? throw new ChainAdapterNotFound(\sprintf('No chain adapter registered for "%s".', $key));
    }

    /**
     * @template TCapability of object
     *
     * @param class-string<TCapability> $capability
     *
     * @return TCapability
     */
    public function requireCapability(string $chain, string $network, string $capability): object
    {
        $adapter = $this->get($chain, $network);

        if (!$adapter instanceof $capability) {
            throw new UnsupportedChainCapability(\sprintf('Chain adapter "%s" does not support capability "%s".', self::key($chain, $network), $capability));
        }

        return $adapter;
    }

    private static function key(string $chain, string $network): string
    {
        if ('' === $chain || '' === $network) {
            throw new \InvalidArgumentException('Chain and network identifiers cannot be empty.');
        }

        return $chain.':'.$network;
    }
}
