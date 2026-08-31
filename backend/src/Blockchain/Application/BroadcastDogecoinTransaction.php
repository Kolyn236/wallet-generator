<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

use App\Blockchain\Domain\DogecoinRawTransaction;

final readonly class BroadcastDogecoinTransaction
{
    public function __construct(private ChainAdapterRegistry $adapters)
    {
    }

    public function __invoke(string $rawTransaction): DogecoinRawTransaction
    {
        $transaction = DogecoinRawTransaction::fromHex($rawTransaction);
        $capability = $this->adapters->requireCapability('dogecoin', 'mainnet', RawTransactionBroadcastCapability::class);
        $providerTxid = strtolower($capability->broadcastRawTransaction($transaction->hex));

        if ($providerTxid !== $transaction->txid) {
            throw new BroadcastFailed('provider_txid_mismatch');
        }

        return $transaction;
    }
}
