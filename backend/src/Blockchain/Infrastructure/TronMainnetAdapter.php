<?php

declare(strict_types=1);

namespace App\Blockchain\Infrastructure;

use App\Blockchain\Application\ChainAdapter;
use App\Blockchain\Application\TronPreparationCapability;
use App\Blockchain\Application\TronStatusCapability;
use App\Blockchain\Application\TronTokenBalanceCapability;

final readonly class TronMainnetAdapter implements ChainAdapter, TronTokenBalanceCapability, TronPreparationCapability, TronStatusCapability
{
    public function __construct(private TronUsdtBalance $balance, private TronTransferPreparation $preparation, private TronTransactionStatus $status)
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

    public function tokenBalanceBaseUnits(string $address): string
    {
        return $this->balance->read($address);
    }

    /** @param array<string,mixed> $input
     * @return array<string,mixed>
     */
    public function prepareTransfer(array $input): array
    {
        return $this->preparation->prepare($input);
    }

    /** @return array<string,mixed> */
    public function transactionStatus(string $txId): array
    {
        return $this->status->read($txId);
    }
}
