<?php

declare(strict_types=1);

namespace App\Blockchain\Presentation\Http;

use App\Blockchain\Application\AddressBalanceCapability;
use App\Blockchain\Application\BalanceLookupFailed;
use App\Blockchain\Application\BroadcastFailed;
use App\Blockchain\Application\ChainAdapterRegistry;
use App\Blockchain\Application\RawTransactionBroadcastCapability;
use App\Blockchain\Application\UtxoFeeRateCapability;
use App\Blockchain\Application\UtxoLookupCapability;
use App\Blockchain\Application\UtxoLookupFailed;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

final readonly class LitecoinController
{
    public function __construct(private ChainAdapterRegistry $registry)
    {
    }

    #[Route('/api/chains/litecoin/mainnet/addresses/{address}/balance', name: 'api_litecoin_balance', methods: ['GET'])]
    public function balance(string $address): JsonResponse
    {
        try {
            $capability = $this->registry->requireCapability('litecoin', 'mainnet', AddressBalanceCapability::class);
            $balance = $capability->getConfirmedBalance($address);
        } catch (\InvalidArgumentException) {
            return new JsonResponse(['error' => 'invalid_address'], 400);
        } catch (BalanceLookupFailed $e) {
            return new JsonResponse(['error' => 'provider_unavailable', 'reason' => $e->reason], 502);
        }

        return new JsonResponse(['chain' => 'litecoin', 'network' => 'mainnet', 'address' => $balance->address, 'balance' => $balance->decimal(), 'balanceSmallestUnit' => $balance->smallestUnit, 'unit' => 'LTC']);
    }

    #[Route('/api/chains/litecoin/mainnet/addresses/{address}/utxos', name: 'api_litecoin_utxos', methods: ['GET'])]
    public function utxos(string $address): JsonResponse
    {
        try {
            $capability = $this->registry->requireCapability('litecoin', 'mainnet', UtxoLookupCapability::class);
            $utxos = $capability->getConfirmedUtxos($address);
        } catch (\InvalidArgumentException) {
            return new JsonResponse(['error' => 'invalid_address'], 400);
        } catch (UtxoLookupFailed $e) {
            return new JsonResponse(['error' => 'provider_unavailable', 'reason' => $e->reason], 502);
        }

        return new JsonResponse(['chain' => 'litecoin', 'network' => 'mainnet', 'address' => $address, 'utxos' => $utxos]);
    }

    #[Route('/api/chains/litecoin/mainnet/fee-policy', name: 'api_litecoin_fee_policy', methods: ['GET'])]
    public function feePolicy(): JsonResponse
    {
        $capability = $this->registry->requireCapability('litecoin', 'mainnet', UtxoFeeRateCapability::class);
        $rate = $capability->feeRate();

        return new JsonResponse(['chain' => 'litecoin', 'network' => 'mainnet', 'kind' => $rate->kind, 'recommendedRate' => $rate->recommendedRate, 'unit' => $rate->unit]);
    }

    #[Route('/api/chains/litecoin/mainnet/transactions/broadcast', name: 'api_litecoin_broadcast', methods: ['POST'])]
    public function broadcast(Request $request): JsonResponse
    {
        try {
            $payload = $request->toArray();
            $raw = $payload['rawTransaction'] ?? null;
            if (!\is_string($raw)) {
                throw new \InvalidArgumentException();
            }
            $capability = $this->registry->requireCapability('litecoin', 'mainnet', RawTransactionBroadcastCapability::class);
            $txid = $capability->broadcastRawTransaction($raw);
        } catch (\InvalidArgumentException) {
            return new JsonResponse(['error' => 'invalid_transaction'], 400);
        } catch (BroadcastFailed $e) {
            return new JsonResponse(['error' => 'provider_unavailable', 'reason' => $e->reason], 502);
        }

        return new JsonResponse(['chain' => 'litecoin', 'network' => 'mainnet', 'txid' => $txid]);
    }
}
