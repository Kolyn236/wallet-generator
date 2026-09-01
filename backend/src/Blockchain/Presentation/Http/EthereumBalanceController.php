<?php

declare(strict_types=1);

namespace App\Blockchain\Presentation\Http;

use App\Blockchain\Application\EthereumRpcFailed;
use App\Blockchain\Application\GetEthereumAddressBalance;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

final readonly class EthereumBalanceController
{
    public function __construct(private GetEthereumAddressBalance $getBalance)
    {
    }

    #[Route('/api/chains/ethereum/mainnet/addresses/{address}/balance', name: 'api_ethereum_balance', methods: ['GET'])]
    public function __invoke(string $address): JsonResponse
    {
        try {
            $balance = ($this->getBalance)($address);
        } catch (\InvalidArgumentException) {
            return new JsonResponse(['error' => 'invalid_address'], 400);
        } catch (EthereumRpcFailed $exception) {
            return new JsonResponse(['error' => $exception->reason], self::statusFor($exception));
        }

        return new JsonResponse([
            'chain' => 'ethereum',
            'network' => 'mainnet',
            'address' => $balance->address,
            'balance' => $balance->decimal(),
            'balanceWei' => $balance->balanceWei,
            'unit' => 'ETH',
        ]);
    }

    private static function statusFor(EthereumRpcFailed $exception): int
    {
        return match ($exception->reason) {
            'provider_not_configured' => 503,
            'provider_rate_limited' => 503,
            default => 502,
        };
    }
}
