<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

final readonly class PrepareEthereumTransaction
{
    public function __construct(private ChainAdapterRegistry $registry)
    {
    }

    public function __invoke(EvmTransactionIntent $intent): PreparedEthereumTransaction
    {
        $balance = $this->registry->requireCapability('ethereum', 'mainnet', EvmNativeBalanceCapability::class);
        $nonce = $this->registry->requireCapability('ethereum', 'mainnet', EvmPendingNonceCapability::class);
        $gas = $this->registry->requireCapability('ethereum', 'mainnet', EvmGasEstimateCapability::class);
        $fees = $this->registry->requireCapability('ethereum', 'mainnet', Eip1559FeeQuoteCapability::class);

        return new PreparedEthereumTransaction(
            $intent,
            $balance->nativeBalanceWei($intent->from),
            $nonce->pendingNonce($intent->from),
            $gas->estimateGas($intent),
            $fees->eip1559FeeQuote(),
        );
    }
}
