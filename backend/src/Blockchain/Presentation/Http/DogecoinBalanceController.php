<?php

declare(strict_types=1);

namespace App\Blockchain\Presentation\Http;

use App\Blockchain\Application\BalanceLookupFailed;
use App\Blockchain\Application\GetDogecoinAddressBalance;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

final readonly class DogecoinBalanceController
{
    public function __construct(private GetDogecoinAddressBalance $getBalance)
    {
    }

    #[Route('/api/chains/dogecoin/mainnet/addresses/{address}/balance', name: 'api_dogecoin_balance', methods: ['GET'])]
    public function __invoke(string $address): JsonResponse
    {
        try {
            $balance = ($this->getBalance)($address);
        } catch (\InvalidArgumentException) {
            return new JsonResponse(['error' => 'invalid_address'], 400);
        } catch (BalanceLookupFailed) {
            return new JsonResponse(['error' => 'provider_unavailable'], 502);
        }

        return new JsonResponse([
            'chain' => 'dogecoin',
            'network' => 'mainnet',
            'address' => $balance->address,
            'balance' => $balance->decimal(),
            'balanceSmallestUnit' => $balance->smallestUnit,
            'unit' => 'DOGE',
        ]);
    }
}
