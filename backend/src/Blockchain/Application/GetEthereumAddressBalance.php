<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

use App\Blockchain\Domain\EthereumAddress;

final readonly class GetEthereumAddressBalance
{
    public function __construct(private ChainAdapterRegistry $registry)
    {
    }

    public function __invoke(string $address): EthereumAddressBalance
    {
        $validated = EthereumAddress::fromString($address);
        $capability = $this->registry->requireCapability('ethereum', 'mainnet', EvmNativeBalanceCapability::class);

        return new EthereumAddressBalance(
            $validated->value,
            $capability->nativeBalanceWei($validated->value),
        );
    }
}
