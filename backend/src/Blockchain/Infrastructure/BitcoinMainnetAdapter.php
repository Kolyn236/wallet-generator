<?php

declare(strict_types=1);

namespace App\Blockchain\Infrastructure;

use App\Blockchain\Application\AddressBalanceCapability;
use App\Blockchain\Application\BalanceLookupFailed;
use App\Blockchain\Application\BitcoinBalanceProvider;
use App\Blockchain\Application\BitcoinFeePolicy;
use App\Blockchain\Application\BitcoinTransactionBroadcaster;
use App\Blockchain\Application\BitcoinUtxoProvider;
use App\Blockchain\Application\BroadcastFailed;
use App\Blockchain\Application\ChainAdapter;
use App\Blockchain\Application\RawTransactionBroadcastCapability;
use App\Blockchain\Application\SuccessfulBroadcastStore;
use App\Blockchain\Application\UtxoFeeRate;
use App\Blockchain\Application\UtxoFeeRateCapability;
use App\Blockchain\Application\UtxoLookupCapability;
use App\Blockchain\Application\UtxoLookupFailed;
use App\Blockchain\Domain\AddressBalance;
use App\Blockchain\Domain\BitcoinAddress;
use App\Blockchain\Domain\BitcoinRawTransaction;
use App\Blockchain\Domain\BitcoinUtxo;

final readonly class BitcoinMainnetAdapter implements ChainAdapter, AddressBalanceCapability, UtxoLookupCapability, UtxoFeeRateCapability, RawTransactionBroadcastCapability
{
    private const string PROVIDER = 'blockcypher';
    private const string CHAIN = 'bitcoin';
    private const string NETWORK = 'mainnet';

    public function __construct(
        private BitcoinBalanceProvider $balanceProvider,
        private BitcoinUtxoProvider $utxoProvider,
        private BitcoinFeePolicy $feePolicy,
        private BitcoinTransactionBroadcaster $transactionBroadcaster,
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
        $validated = BitcoinAddress::fromString($address);
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
     * @return list<BitcoinUtxo>
     */
    public function getConfirmedUtxos(string $address): array
    {
        $validated = BitcoinAddress::fromString($address);
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
            BitcoinFeePolicy::KIND,
            $this->feePolicy->recommendedRateBtcPerKb,
            BitcoinFeePolicy::UNIT,
        );
    }

    public function broadcastRawTransaction(string $rawTransaction): string
    {
        $transaction = BitcoinRawTransaction::fromHex($rawTransaction);
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
