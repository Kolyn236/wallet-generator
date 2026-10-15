<?php

declare(strict_types=1);

namespace App\Blockchain\Infrastructure;

use App\Blockchain\Application\ChainAdapter;
use App\Blockchain\Application\Trc20BalanceCapability;
use App\Blockchain\Domain\TronAddress;

final readonly class TronMainnetAdapter implements ChainAdapter, Trc20BalanceCapability
{
    public function __construct(private TronFullNodeClient $client)
    {
    }

    public function chain(): string
    {
        return 'tron';
    }

    public function network(): string
    {
        return 'mainnet';
    }

    public function trc20Balance(string $contractAddress, string $holderAddress): string
    {
        return $this->client->trc20Balance(
            TronAddress::fromString($contractAddress)->base58,
            TronAddress::fromString($holderAddress)->base58,
        );
    }
}
