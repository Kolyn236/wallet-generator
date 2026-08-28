<?php

declare(strict_types=1);

namespace App\Blockchain\Presentation\Http;

use App\Blockchain\Application\BroadcastBitcoinTransaction;
use App\Blockchain\Application\BroadcastFailed;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

final readonly class BitcoinBroadcastController
{
    public function __construct(private BroadcastBitcoinTransaction $broadcastTransaction)
    {
    }

    #[Route('/api/chains/bitcoin/mainnet/transactions/broadcast', name: 'api_bitcoin_broadcast', methods: ['POST'])]
    public function __invoke(Request $request): JsonResponse
    {
        try {
            $payload = json_decode($request->getContent(), true, 32, \JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return new JsonResponse(['error' => 'invalid_json'], 400);
        }

        $rawTransaction = \is_array($payload) ? ($payload['rawTransaction'] ?? null) : null;
        if (!\is_string($rawTransaction)) {
            return new JsonResponse(['error' => 'invalid_transaction'], 400);
        }

        try {
            $transaction = ($this->broadcastTransaction)($rawTransaction);
        } catch (\InvalidArgumentException) {
            return new JsonResponse(['error' => 'invalid_transaction'], 400);
        } catch (BroadcastFailed $exception) {
            return new JsonResponse([
                'error' => 'broadcast_failed',
                'reason' => $exception->reason,
            ], 502);
        }

        return new JsonResponse([
            'chain' => 'bitcoin',
            'network' => 'mainnet',
            'txid' => $transaction->txid,
        ], 201);
    }
}
