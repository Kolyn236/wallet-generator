<?php

declare(strict_types=1);

namespace App\Blockchain\Infrastructure;

use App\Blockchain\Application\ChainAdapter;
use App\Blockchain\Application\Eip1559FeeQuote;
use App\Blockchain\Application\Eip1559FeeQuoteCapability;
use App\Blockchain\Application\Erc20BalanceCapability;
use App\Blockchain\Application\EthereumRpcFailed;
use App\Blockchain\Application\EvmGasEstimateCapability;
use App\Blockchain\Application\EvmNativeBalanceCapability;
use App\Blockchain\Application\EvmPendingNonceCapability;
use App\Blockchain\Application\EvmTransactionIntent;
use App\Blockchain\Application\RawTransactionBroadcastCapability;
use App\Blockchain\Application\SuccessfulBroadcastStore;
use App\Blockchain\Domain\EthereumAddress;

final readonly class EthereumMainnetAdapter implements ChainAdapter, EvmNativeBalanceCapability, Erc20BalanceCapability, EvmPendingNonceCapability, EvmGasEstimateCapability, Eip1559FeeQuoteCapability, RawTransactionBroadcastCapability
{
    private const string PROVIDER = 'ethereum-json-rpc';
    private const string CHAIN = 'ethereum';
    private const string NETWORK = 'mainnet';

    public function __construct(
        private EthereumJsonRpcClient $rpc,
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

    public function nativeBalanceWei(string $address): string
    {
        $validated = EthereumAddress::fromString($address)->value;
        $loader = fn (): string => $this->guarded('native_balance', fn (): string => $this->rpc->balanceWei($validated));

        return null === $this->readCache
            ? $loader()
            : $this->readCache->remember(self::CHAIN, self::NETWORK, 'native_balance', ['address' => strtolower($validated)], $loader);
    }

    public function erc20Balance(string $contractAddress, string $holderAddress): string
    {
        $contract = EthereumAddress::fromString($contractAddress)->value;
        $holder = EthereumAddress::fromString($holderAddress)->value;
        $loader = fn (): string => $this->guarded('erc20_balance', fn (): string => $this->rpc->erc20Balance($contract, $holder));

        return null === $this->readCache
            ? $loader()
            : $this->readCache->remember(self::CHAIN, self::NETWORK, 'erc20_balance', [
                'address' => strtolower($holder),
                'token' => strtolower($contract),
            ], $loader);
    }

    public function pendingNonce(string $address): string
    {
        $validated = EthereumAddress::fromString($address)->value;

        return $this->guarded('pending_nonce', fn (): string => $this->rpc->pendingNonce($validated));
    }

    public function estimateGas(EvmTransactionIntent $intent): string
    {
        return $this->guarded('gas_estimate', fn (): string => $this->rpc->estimateGas($intent));
    }

    public function eip1559FeeQuote(): Eip1559FeeQuote
    {
        return $this->guarded('fee_quote', fn (): Eip1559FeeQuote => $this->rpc->feeQuote());
    }

    public function broadcastRawTransaction(string $rawTransaction): string
    {
        if (1 !== preg_match('/^0x(?:[0-9a-fA-F]{2})+$/', $rawTransaction)) {
            throw new \InvalidArgumentException('Invalid signed Ethereum raw transaction.');
        }

        $normalized = strtolower($rawTransaction);
        $rawBytes = hex2bin(substr($normalized, 2));
        if (false === $rawBytes) {
            throw new \InvalidArgumentException('Invalid signed Ethereum raw transaction.');
        }
        $fingerprint = hash('sha256', $rawBytes);
        $knownTxid = $this->broadcastStore?->findSuccessfulTxid(self::CHAIN, self::NETWORK, $fingerprint);
        if (null !== $knownTxid) {
            return $knownTxid;
        }

        $txid = strtolower($this->guarded('broadcast', fn (): string => $this->rpc->broadcast($normalized)));
        $this->broadcastStore?->rememberSuccessful(self::CHAIN, self::NETWORK, $txid, $fingerprint);

        return $txid;
    }

    /**
     * @template T
     * @param callable(): T $call
     * @return T
     */
    private function guarded(string $operation, callable $call): mixed
    {
        if ($this->providerCooldown?->isActive(self::PROVIDER, self::CHAIN, self::NETWORK, $operation)) {
            throw new EthereumRpcFailed('provider_rate_limited', 429);
        }

        try {
            return $call();
        } catch (EthereumRpcFailed $exception) {
            if ('provider_rate_limited' === $exception->reason || 429 === $exception->httpStatus) {
                $this->providerCooldown?->trip(self::PROVIDER, self::CHAIN, self::NETWORK, $operation);
            }

            throw $exception;
        }
    }
}
