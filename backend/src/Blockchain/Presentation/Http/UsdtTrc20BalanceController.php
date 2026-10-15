<?php

declare(strict_types=1);

namespace App\Blockchain\Presentation\Http;

use App\Blockchain\Application\GetUsdtTrc20Balance;
use App\Blockchain\Application\TronProviderFailed;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

final readonly class UsdtTrc20BalanceController
{
    public function __construct(private GetUsdtTrc20Balance $getBalance)
    {
    }

    #[Route('/api/chains/tron/mainnet/tokens/usdt/addresses/{address}/balance', name: 'api_tron_usdt_trc20_balance', methods: ['GET'])]
    public function __invoke(string $address): JsonResponse
    {
        try {
            $balance = ($this->getBalance)($address);
        } catch (\InvalidArgumentException) {
            return new JsonResponse(['error' => 'invalid_address'], 400);
        } catch (TronProviderFailed $exception) {
            return new JsonResponse(['error' => $exception->reason], self::statusFor($exception));
        }

        return new JsonResponse([
            'chain' => 'tron',
            'network' => 'mainnet',
            'asset' => 'usdt',
            'standard' => 'trc20',
            'contractAddress' => GetUsdtTrc20Balance::CONTRACT_ADDRESS,
            'address' => $balance->address,
            'balance' => $balance->decimal(),
            'balanceSmallestUnit' => $balance->balanceSmallestUnit,
            'decimals' => $balance->decimals,
            'unit' => $balance->symbol,
        ]);
    }

    private static function statusFor(TronProviderFailed $exception): int
    {
        return match ($exception->reason) {
            'provider_not_configured', 'provider_rate_limited' => 503,
            default => 502,
        };
    }
}
