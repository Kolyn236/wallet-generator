<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

use App\Blockchain\Domain\BitcoinRawTransaction;

final readonly class BroadcastBitcoinTransaction
{
    public function __construct(private BitcoinTransactionBroadcaster $broadcaster)
    {
    }

    public function __invoke(string $rawTransaction): BitcoinRawTransaction
    {
        $transaction = BitcoinRawTransaction::fromHex($rawTransaction);
        $providerTxid = strtolower($this->broadcaster->broadcast($transaction));

        if ($providerTxid !== $transaction->txid) {
            throw new BroadcastFailed('provider_txid_mismatch');
        }

        return $transaction;
    }
}
