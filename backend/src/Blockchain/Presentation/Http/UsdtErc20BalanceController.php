<?php

declare(strict_types=1);

namespace App\Blockchain\Presentation\Http;

use App\Blockchain\Application\EthereumRpcFailed;
use App\Blockchain\Application\GetUsdtErc20Balance;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

final readonly class UsdtErc20BalanceController
{
    public function __construct(private GetUsdtErc20Balance $getBalance)
    {
    }

    #[Route('/api/chains/ethereum/mainnet/tokens/usdt/addresses/{address}/balance', name: 'api_ethereum_usdt_erc20_balance', methods: ['GET'])]
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
            'asset' => 'usdt',
            'standard' => 'erc20',
            'contractAddress' => GetUsdtErc20Balance::CONTRACT_ADDRESS,
            'address' => $balance->address,
            'balance' => $balance->decimal(),
            'balanceSmallestUnit' => $balance->balanceSmallestUnit,
            'decimals' => $balance->decimals,
            'unit' => $balance->symbol,
        ]);
    }

    private static function statusFor(EthereumRpcFailed $exception): int
    {
        return match ($exception->reason) {
            'provider_not_configured', 'provider_rate_limited' => 503,
            default => 502,
        };
    }
}
