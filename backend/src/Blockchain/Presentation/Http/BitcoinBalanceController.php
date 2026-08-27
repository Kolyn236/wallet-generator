<?php

declare(strict_types=1);

namespace App\Blockchain\Presentation\Http;

use App\Blockchain\Application\BalanceLookupFailed;
use App\Blockchain\Application\GetBitcoinAddressBalance;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

final readonly class BitcoinBalanceController
{
    public function __construct(private GetBitcoinAddressBalance $getBalance)
    {
    }

    #[Route('/api/chains/bitcoin/mainnet/addresses/{address}/balance', name: 'api_bitcoin_balance', methods: ['GET'])]
    public function __invoke(string $address): JsonResponse
    {
        try {
            $balance = ($this->getBalance)($address);
        } catch (\InvalidArgumentException) {
            return new JsonResponse(['error' => 'invalid_address'], 400);
        } catch (BalanceLookupFailed $exception) {
            return new JsonResponse([
                'error' => 'provider_unavailable',
                'reason' => $exception->reason,
            ], 502);
        }

        return new JsonResponse([
            'chain' => 'bitcoin',
            'network' => 'mainnet',
            'address' => $balance->address,
            'balance' => $balance->decimal(),
            'balanceSmallestUnit' => $balance->smallestUnit,
            'unit' => 'BTC',
        ]);
    }
}
