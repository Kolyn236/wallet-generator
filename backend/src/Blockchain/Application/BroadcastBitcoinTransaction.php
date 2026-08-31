<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

use App\Blockchain\Domain\BitcoinRawTransaction;

final readonly class BroadcastBitcoinTransaction
{
    public function __construct(private ChainAdapterRegistry $adapters)
    {
    }

    public function __invoke(string $rawTransaction): BitcoinRawTransaction
    {
        $transaction = BitcoinRawTransaction::fromHex($rawTransaction);
        $capability = $this->adapters->requireCapability('bitcoin', 'mainnet', RawTransactionBroadcastCapability::class);
        $providerTxid = strtolower($capability->broadcastRawTransaction($transaction->hex));

        if ($providerTxid !== $transaction->txid) {
            throw new BroadcastFailed('provider_txid_mismatch');
        }

        return $transaction;
    }
}
