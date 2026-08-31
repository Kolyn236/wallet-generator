<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

final readonly class BroadcastEthereumTransaction
{
    public function __construct(private ChainAdapterRegistry $registry)
    {
    }

    public function __invoke(string $rawTransaction): string
    {
        if (1 !== preg_match('/^0x(?:[0-9a-fA-F]{2})+$/', $rawTransaction)) {
            throw new \InvalidArgumentException('Invalid signed Ethereum raw transaction.');
        }

        $capability = $this->registry->requireCapability('ethereum', 'mainnet', RawTransactionBroadcastCapability::class);

        return $capability->broadcastRawTransaction($rawTransaction);
    }
}
