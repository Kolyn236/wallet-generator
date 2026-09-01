<?php

declare(strict_types=1);

namespace App\Blockchain\Infrastructure;

use App\Blockchain\Application\AddressBalanceCapability;
use App\Blockchain\Application\ChainAdapter;
use App\Blockchain\Application\RawTransactionBroadcastCapability;
use App\Blockchain\Application\UtxoFeeRate;
use App\Blockchain\Application\UtxoFeeRateCapability;
use App\Blockchain\Application\UtxoLookupCapability;
use App\Blockchain\Domain\AddressBalance;

final readonly class LitecoinMainnetAdapter implements ChainAdapter, AddressBalanceCapability, UtxoLookupCapability, UtxoFeeRateCapability, RawTransactionBroadcastCapability
{
    private const string ADDRESS_PATTERN = '/^L[1-9A-HJ-NP-Za-km-z]{25,34}$/';

    public function __construct(
        private BlockCypherUtxoMainnetClient $client,
        private string $recommendedRateLtcPerKb = '0.00001000',
    ) {
    }

    public function chain(): string { return 'litecoin'; }
    public function network(): string { return 'mainnet'; }

    public function getConfirmedBalance(string $address): AddressBalance
    {
        self::assertAddress($address);
        return new AddressBalance($address, $this->client->balance('ltc', 'litecoin', $address));
    }

    public function getConfirmedUtxos(string $address): array
    {
        self::assertAddress($address);
        return $this->client->utxos('ltc', 'litecoin', $address);
    }

    public function feeRate(): UtxoFeeRate
    {
        return new UtxoFeeRate('utxo-rate-per-kb', $this->recommendedRateLtcPerKb, 'LTC/kB');
    }

    public function broadcastRawTransaction(string $rawTransaction): string
    {
        return $this->client->broadcast('ltc', 'litecoin', $rawTransaction);
    }

    private static function assertAddress(string $address): void
    {
        if (1 !== preg_match(self::ADDRESS_PATTERN, $address)) {
            throw new \InvalidArgumentException('Invalid Litecoin mainnet legacy P2PKH address.');
        }
    }
}
