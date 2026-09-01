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
use App\Blockchain\Domain\LegacyP2pkhAddress;

final readonly class LitecoinMainnetAdapter implements ChainAdapter, AddressBalanceCapability, UtxoLookupCapability, UtxoFeeRateCapability, RawTransactionBroadcastCapability
{
    private const int P2PKH_VERSION = 0x30;

    public function __construct(
        private BlockCypherUtxoMainnetClient $client,
        private string $recommendedRateLtcPerKb = '0.00001000',
    ) {
    }

    public function chain(): string { return 'litecoin'; }
    public function network(): string { return 'mainnet'; }

    public function getConfirmedBalance(string $address): AddressBalance
    {
        $validated = LegacyP2pkhAddress::fromString($address, self::P2PKH_VERSION);
        return new AddressBalance($validated->value, $this->client->balance('ltc', 'litecoin', $validated->value));
    }

    public function getConfirmedUtxos(string $address): array
    {
        $validated = LegacyP2pkhAddress::fromString($address, self::P2PKH_VERSION);
        return $this->client->utxos('ltc', 'litecoin', $validated->value);
    }

    public function feeRate(): UtxoFeeRate
    {
        return new UtxoFeeRate('utxo-rate-per-kb', $this->recommendedRateLtcPerKb, 'LTC/kB');
    }

    public function broadcastRawTransaction(string $rawTransaction): string
    {
        return $this->client->broadcast('ltc', 'litecoin', $rawTransaction);
    }
}
