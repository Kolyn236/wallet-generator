<?php

declare(strict_types=1);

namespace App\Blockchain\Infrastructure;

use App\Blockchain\Application\AddressBalanceCapability;
use App\Blockchain\Application\BalanceLookupFailed;
use App\Blockchain\Application\BroadcastFailed;
use App\Blockchain\Application\ChainAdapter;
use App\Blockchain\Application\RawTransactionBroadcastCapability;
use App\Blockchain\Application\SuccessfulBroadcastStore;
use App\Blockchain\Application\UtxoFeeRate;
use App\Blockchain\Application\UtxoFeeRateCapability;
use App\Blockchain\Application\UtxoLookupCapability;
use App\Blockchain\Application\UtxoLookupFailed;
use App\Blockchain\Domain\AddressBalance;
use App\Blockchain\Domain\LegacyP2pkhAddress;

final readonly class LitecoinMainnetAdapter implements ChainAdapter, AddressBalanceCapability, UtxoLookupCapability, UtxoFeeRateCapability, RawTransactionBroadcastCapability
{
    private const int P2PKH_VERSION = 0x30;
    private const string PROVIDER = 'blockcypher';
    private const string CHAIN = 'litecoin';
    private const string NETWORK = 'mainnet';

    public function __construct(
        private BlockCypherUtxoMainnetClient $client,
        private string $recommendedRateLtcPerKb = '0.00001000',
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
        $validated = LegacyP2pkhAddress::fromString($address, self::P2PKH_VERSION);
        $loader = function () use ($validated): AddressBalance {
            if ($this->providerCooldown?->isActive(self::PROVIDER, self::CHAIN, self::NETWORK, 'balance')) {
                throw new BalanceLookupFailed('provider_rate_limited', 429);
            }

            try {
                return new AddressBalance($validated->value, $this->client->balance('ltc', self::CHAIN, $validated->value));
            } catch (BalanceLookupFailed $exception) {
                $this->tripCooldownIfRateLimited('balance', $exception->reason, $exception->providerStatus);
                throw $exception;
            }
        };

        return null === $this->readCache
            ? $loader()
            : $this->readCache->remember(self::CHAIN, self::NETWORK, 'balance', ['address' => $validated->value], $loader);
    }

    public function getConfirmedUtxos(string $address): array
    {
        $validated = LegacyP2pkhAddress::fromString($address, self::P2PKH_VERSION);
        $loader = function () use ($validated): array {
            if ($this->providerCooldown?->isActive(self::PROVIDER, self::CHAIN, self::NETWORK, 'utxo')) {
                throw new UtxoLookupFailed('provider_rate_limited', 429);
            }

            try {
                return $this->client->utxos('ltc', self::CHAIN, $validated->value);
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
        return new UtxoFeeRate('utxo-rate-per-kb', $this->recommendedRateLtcPerKb, 'LTC/kB');
    }

    public function broadcastRawTransaction(string $rawTransaction): string
    {
        $txid = self::localUtxoTxid($rawTransaction);
        $knownTxid = $this->broadcastStore?->findSuccessfulTxid(self::CHAIN, self::NETWORK, $txid);
        if (null !== $knownTxid) {
            return $knownTxid;
        }

        if ($this->providerCooldown?->isActive(self::PROVIDER, self::CHAIN, self::NETWORK, 'broadcast')) {
            throw new BroadcastFailed('provider_rate_limited', 429);
        }

        try {
            $providerTxid = strtolower($this->client->broadcast('ltc', self::CHAIN, $rawTransaction));
        } catch (BroadcastFailed $exception) {
            $this->tripCooldownIfRateLimited('broadcast', $exception->reason, $exception->providerStatus);
            throw $exception;
        }

        if ($providerTxid === $txid) {
            $this->broadcastStore?->rememberSuccessful(self::CHAIN, self::NETWORK, $txid, $txid);
        }

        return $providerTxid;
    }

    private function tripCooldownIfRateLimited(string $operation, string $reason, ?int $status): void
    {
        if ('provider_rate_limited' === $reason || 429 === $status) {
            $this->providerCooldown?->trip(self::PROVIDER, self::CHAIN, self::NETWORK, $operation);
        }
    }

    private static function localUtxoTxid(string $rawHex): string
    {
        $rawHex = strtolower(trim($rawHex));
        if ('' === $rawHex
            || 0 !== \strlen($rawHex) % 2
            || 1 !== preg_match('/^[0-9a-f]+$/', $rawHex)
            || \strlen($rawHex) > 200_000
        ) {
            throw new \InvalidArgumentException('Invalid raw UTXO transaction.');
        }

        $raw = hex2bin($rawHex);
        if (false === $raw) {
            throw new \InvalidArgumentException('Invalid raw UTXO transaction.');
        }

        return bin2hex(strrev(hash('sha256', hash('sha256', $raw, true), true)));
    }
}
