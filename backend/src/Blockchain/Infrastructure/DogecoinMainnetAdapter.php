<?php

declare(strict_types=1);

namespace App\Blockchain\Infrastructure;

use App\Blockchain\Application\AddressBalanceCapability;
use App\Blockchain\Application\BalanceLookupFailed;
use App\Blockchain\Application\BroadcastFailed;
use App\Blockchain\Application\ChainAdapter;
use App\Blockchain\Application\DogecoinBalanceProvider;
use App\Blockchain\Application\DogecoinFeePolicy;
use App\Blockchain\Application\DogecoinTransactionBroadcaster;
use App\Blockchain\Application\DogecoinUtxoProvider;
use App\Blockchain\Application\RawTransactionBroadcastCapability;
use App\Blockchain\Application\SuccessfulBroadcastStore;
use App\Blockchain\Application\UtxoFeeRate;
use App\Blockchain\Application\UtxoFeeRateCapability;
use App\Blockchain\Application\UtxoLookupCapability;
use App\Blockchain\Application\UtxoLookupFailed;
use App\Blockchain\Domain\AddressBalance;
use App\Blockchain\Domain\DogecoinAddress;
use App\Blockchain\Domain\DogecoinRawTransaction;
use App\Blockchain\Domain\DogecoinUtxo;

final readonly class DogecoinMainnetAdapter implements ChainAdapter, AddressBalanceCapability, UtxoLookupCapability, UtxoFeeRateCapability, RawTransactionBroadcastCapability
{
    private const string PROVIDER = 'blockcypher';
    private const string CHAIN = 'dogecoin';
    private const string NETWORK = 'mainnet';

    public function __construct(
        private DogecoinBalanceProvider $balanceProvider,
        private DogecoinUtxoProvider $utxoProvider,
        private DogecoinFeePolicy $feePolicy,
        private DogecoinTransactionBroadcaster $transactionBroadcaster,
        private ?ProviderReadCache $readCache = null,
        private ?ProviderCooldown $providerCooldown = null,
        private ?SuccessfulBroadcastStore $broadcastStore = null,
    ) {
    }

    public function chain(): string
    {
        return self::CHAIN;
    }

    public function network(): string
    {
        return self::NETWORK;
    }

    public function getConfirmedBalance(string $address): AddressBalance
    {
        $validated = DogecoinAddress::fromString($address);
        $loader = function () use ($validated): AddressBalance {
            if ($this->providerCooldown?->isActive(self::PROVIDER, self::CHAIN, self::NETWORK, 'balance')) {
                throw new BalanceLookupFailed('provider_rate_limited', 429);
            }

            try {
                return $this->balanceProvider->getConfirmedBalance($validated);
            } catch (BalanceLookupFailed $exception) {
                $this->tripCooldownIfRateLimited('balance', $exception->reason, $exception->providerStatus);
                throw $exception;
            }
        };

        return null === $this->readCache
            ? $loader()
            : $this->readCache->remember(self::CHAIN, self::NETWORK, 'balance', ['address' => $validated->value], $loader);
    }

    /**
     * @return list<DogecoinUtxo>
     */
    public function getConfirmedUtxos(string $address): array
    {
        $validated = DogecoinAddress::fromString($address);
        $loader = function () use ($validated): array {
            if ($this->providerCooldown?->isActive(self::PROVIDER, self::CHAIN, self::NETWORK, 'utxo')) {
                throw new UtxoLookupFailed('provider_rate_limited', 429);
            }

            try {
                return $this->utxoProvider->getConfirmedUtxos($validated);
            } catch (UtxoLookupFailed $exception) {
                $this->tripCooldownIfRateLimited('utxo', $exception->reason, $exception->providerStatus);
                throw $exception;
            }
        };

        return null === $this->readCache
            ? $loader()
            : $this->readCache->remember(self::CHAIN, self::NETWORK, 'utxo', ['address' => $validated->value], $loader);
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
        $transaction = DogecoinRawTransaction::fromHex($rawTransaction);
        $knownTxid = $this->broadcastStore?->findSuccessfulTxid(self::CHAIN, self::NETWORK, $transaction->txid);
        if (null !== $knownTxid) {
            return $knownTxid;
        }

        if ($this->providerCooldown?->isActive(self::PROVIDER, self::CHAIN, self::NETWORK, 'broadcast')) {
            throw new BroadcastFailed('provider_rate_limited', 429);
        }

        try {
            $providerTxid = strtolower($this->transactionBroadcaster->broadcast($transaction));
        } catch (BroadcastFailed $exception) {
            $this->tripCooldownIfRateLimited('broadcast', $exception->reason, $exception->providerStatus);
            throw $exception;
        }

        if ($providerTxid === $transaction->txid) {
            $this->broadcastStore?->rememberSuccessful(self::CHAIN, self::NETWORK, $transaction->txid, $transaction->txid);
        }

        return $providerTxid;
    }

    private function tripCooldownIfRateLimited(string $operation, string $reason, ?int $status): void
    {
        if ('provider_rate_limited' === $reason || 429 === $status) {
            $this->providerCooldown?->trip(self::PROVIDER, self::CHAIN, self::NETWORK, $operation);
        }
    }
}
