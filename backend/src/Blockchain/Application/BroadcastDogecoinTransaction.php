<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

use App\Blockchain\Domain\DogecoinRawTransaction;

final readonly class BroadcastDogecoinTransaction
{
    public function __construct(private DogecoinTransactionBroadcaster $broadcaster)
    {
    }

    public function __invoke(string $rawTransaction): DogecoinRawTransaction
    {
        $transaction = DogecoinRawTransaction::fromHex($rawTransaction);
        $providerTxid = strtolower($this->broadcaster->broadcast($transaction));

        if ($providerTxid !== $transaction->txid) {
            throw new BroadcastFailed('provider_txid_mismatch');
        }

        return $transaction;
    }
}
