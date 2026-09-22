<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

interface TronReadProvider
{
    /** @return array<string,mixed> */
    public function networkIdentity(): array;
    /** @return array<string,mixed> */
    public function latestBlock(): array;
    /** @return array<string,mixed> */
    public function account(string $address): array;
    /** @return array<string,mixed> */
    public function accountResources(string $address): array;
    /** @return array<string,mixed> */
    public function chainParameters(): array;
    public function tokenBalance(string $contractHex, string $address): string;
    public function estimateEnergy(string $ownerHex, string $contractHex, string $dataHex): ?string;
    /** @return array<string,mixed> */
    public function prepareTransfer(string $ownerHex, string $contractHex, string $dataHex, int $expirationMs, int $timestampMs, int $feeLimitSun): array;
    /** @return array<string,mixed> */
    /** @param array<string,mixed> $signedTransaction */
    public function broadcast(array $signedTransaction): array;
    /** @return array<string,mixed> */
    public function transactionById(string $txId): array;
    /** @return array<string,mixed> */
    public function transactionInfoById(string $txId): array;
}
