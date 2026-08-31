<?php

declare(strict_types=1);

namespace App\Blockchain\Infrastructure;

use App\Blockchain\Application\AddressBalanceCapability;
use App\Blockchain\Application\ChainAdapter;
use App\Blockchain\Application\DogecoinBalanceProvider;
use App\Blockchain\Application\DogecoinFeePolicy;
use App\Blockchain\Application\DogecoinTransactionBroadcaster;
use App\Blockchain\Application\DogecoinUtxoProvider;
use App\Blockchain\Application\RawTransactionBroadcastCapability;
use App\Blockchain\Application\UtxoFeeRate;
use App\Blockchain\Application\UtxoFeeRateCapability;
use App\Blockchain\Application\UtxoLookupCapability;
use App\Blockchain\Domain\AddressBalance;
use App\Blockchain\Domain\DogecoinAddress;
use App\Blockchain\Domain\DogecoinRawTransaction;
use App\Blockchain\Domain\DogecoinUtxo;

final readonly class DogecoinMainnetAdapter implements ChainAdapter, AddressBalanceCapability, UtxoLookupCapability, UtxoFeeRateCapability, RawTransactionBroadcastCapability
{
    public function __construct(
        private DogecoinBalanceProvider $balanceProvider,
        private DogecoinUtxoProvider $utxoProvider,
        private DogecoinFeePolicy $feePolicy,
        private DogecoinTransactionBroadcaster $transactionBroadcaster,
    ) {
    }

    public function chain(): string
    {
        return 'dogecoin';
    }

    public function network(): string
    {
        return 'mainnet';
    }

    public function getConfirmedBalance(string $address): AddressBalance
    {
        return $this->balanceProvider->getConfirmedBalance(DogecoinAddress::fromString($address));
    }

    /**
     * @return list<DogecoinUtxo>
     */
    public function getConfirmedUtxos(string $address): array
    {
        return $this->utxoProvider->getConfirmedUtxos(DogecoinAddress::fromString($address));
    }

    public function feeRate(): UtxoFeeRate
    {
        return new UtxoFeeRate(
            DogecoinFeePolicy::KIND,
            $this->feePolicy->recommendedRateDogePerKb,
            DogecoinFeePolicy::UNIT,
        );
    }

    public function broadcastRawTransaction(string $rawTransaction): string
    {
        return $this->transactionBroadcaster->broadcast(DogecoinRawTransaction::fromHex($rawTransaction));
    }
}
