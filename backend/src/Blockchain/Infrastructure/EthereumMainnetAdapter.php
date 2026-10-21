<?php

declare(strict_types=1);

namespace App\Blockchain\Infrastructure;

use App\Blockchain\Application\ChainAdapter;
use App\Blockchain\Application\Eip1559FeeQuote;
use App\Blockchain\Application\Eip1559FeeQuoteCapability;
use App\Blockchain\Application\Erc20BalanceCapability;
use App\Blockchain\Application\EvmGasEstimateCapability;
use App\Blockchain\Application\EvmNativeBalanceCapability;
use App\Blockchain\Application\EvmPendingNonceCapability;
use App\Blockchain\Application\EvmTransactionIntent;
use App\Blockchain\Domain\EthereumAddress;

final readonly class EthereumMainnetAdapter implements ChainAdapter, EvmNativeBalanceCapability, Erc20BalanceCapability, EvmPendingNonceCapability, EvmGasEstimateCapability, Eip1559FeeQuoteCapability
{
    public function __construct(private EthereumJsonRpcClient $rpc)
    {
    }

    public function chain(): string
    {
        return 'ethereum';
    }

    public function network(): string
    {
        return 'mainnet';
    }

    public function nativeBalanceWei(string $address): string
    {
        return $this->rpc->balanceWei(EthereumAddress::fromString($address)->value);
    }

    public function erc20Balance(string $contractAddress, string $holderAddress): string
    {
        return $this->rpc->erc20Balance(
            EthereumAddress::fromString($contractAddress)->value,
            EthereumAddress::fromString($holderAddress)->value,
        );
    }

    public function pendingNonce(string $address): string
    {
        return $this->rpc->pendingNonce(EthereumAddress::fromString($address)->value);
    }

    public function estimateGas(EvmTransactionIntent $intent): string
    {
        return $this->rpc->estimateGas($intent);
    }

    public function eip1559FeeQuote(): Eip1559FeeQuote
    {
        return $this->rpc->feeQuote();
    }
}
