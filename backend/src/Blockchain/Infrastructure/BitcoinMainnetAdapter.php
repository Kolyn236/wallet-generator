<?php

declare(strict_types=1);

namespace App\Blockchain\Infrastructure;

use App\Blockchain\Application\AddressBalanceCapability;
use App\Blockchain\Application\BitcoinBalanceProvider;
use App\Blockchain\Application\BitcoinFeePolicy;
use App\Blockchain\Application\BitcoinTransactionBroadcaster;
use App\Blockchain\Application\BitcoinUtxoProvider;
use App\Blockchain\Application\ChainAdapter;
use App\Blockchain\Application\RawTransactionBroadcastCapability;
use App\Blockchain\Application\UtxoFeeRate;
use App\Blockchain\Application\UtxoFeeRateCapability;
use App\Blockchain\Application\UtxoLookupCapability;
use App\Blockchain\Domain\AddressBalance;
use App\Blockchain\Domain\BitcoinAddress;
use App\Blockchain\Domain\BitcoinRawTransaction;
use App\Blockchain\Domain\BitcoinUtxo;

final readonly class BitcoinMainnetAdapter implements ChainAdapter, AddressBalanceCapability, UtxoLookupCapability, UtxoFeeRateCapability, RawTransactionBroadcastCapability
{
    public function __construct(
        private BitcoinBalanceProvider $balanceProvider,
        private BitcoinUtxoProvider $utxoProvider,
        private BitcoinFeePolicy $feePolicy,
        private BitcoinTransactionBroadcaster $transactionBroadcaster,
    ) {
    }

    public function chain(): string
    {
        return 'bitcoin';
    }

    public function network(): string
    {
        return 'mainnet';
    }

    public function getConfirmedBalance(string $address): AddressBalance
    {
        return $this->balanceProvider->getConfirmedBalance(BitcoinAddress::fromString($address));
    }

    /**
     * @return list<BitcoinUtxo>
     */
    public function getConfirmedUtxos(string $address): array
    {
        return $this->utxoProvider->getConfirmedUtxos(BitcoinAddress::fromString($address));
    }

    public function feeRate(): UtxoFeeRate
    {
        return new UtxoFeeRate(
            BitcoinFeePolicy::KIND,
            $this->feePolicy->recommendedRateBtcPerKb,
            BitcoinFeePolicy::UNIT,
        );
    }

    public function broadcastRawTransaction(string $rawTransaction): string
    {
        return $this->transactionBroadcaster->broadcast(BitcoinRawTransaction::fromHex($rawTransaction));
    }
}
