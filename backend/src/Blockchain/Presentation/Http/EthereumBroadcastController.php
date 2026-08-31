<?php

declare(strict_types=1);

namespace App\Blockchain\Presentation\Http;

use App\Blockchain\Application\BroadcastEthereumTransaction;
use App\Blockchain\Application\EthereumRpcFailed;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

final readonly class EthereumBroadcastController
{
    public function __construct(private BroadcastEthereumTransaction $broadcastTransaction)
    {
    }

    #[Route('/api/chains/ethereum/mainnet/transactions/broadcast', name: 'api_ethereum_broadcast', methods: ['POST'])]
    public function __invoke(Request $request): JsonResponse
    {
        try {
            $payload = json_decode($request->getContent(), true, 32, \JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return new JsonResponse(['error' => 'invalid_json'], 400);
        }

        if (!\is_array($payload)
            || ['rawTransaction'] !== array_keys($payload)
            || !\is_string($payload['rawTransaction'])
        ) {
            return new JsonResponse(['error' => 'invalid_transaction'], 400);
        }

        try {
            $txHash = ($this->broadcastTransaction)($payload['rawTransaction']);
        } catch (\InvalidArgumentException) {
            return new JsonResponse(['error' => 'invalid_transaction'], 400);
        } catch (EthereumRpcFailed $exception) {
            return new JsonResponse(['error' => $exception->reason], self::statusFor($exception));
        }

        return new JsonResponse([
            'chain' => 'ethereum',
            'network' => 'mainnet',
            'txHash' => $txHash,
        ], 201);
    }

    private static function statusFor(EthereumRpcFailed $exception): int
    {
        return match ($exception->reason) {
            'provider_not_configured', 'provider_rate_limited' => 503,
            default => 502,
        };
    }
}
