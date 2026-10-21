<?php

declare(strict_types=1);

namespace App\Blockchain\Presentation\Http;

use App\Blockchain\Application\ChainAdapterRegistry;
use App\Blockchain\Application\TronPreparationCapability;
use App\Blockchain\Application\TronProviderFailed;
use App\Blockchain\Application\TronStatusCapability;
use App\Blockchain\Application\TronTokenBalanceCapability;
use App\Blockchain\Application\TronTransferIntent;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

final readonly class TronController
{
    public function __construct(private ChainAdapterRegistry $registry)
    {
    }

    #[Route('/api/chains/tron/mainnet/tokens/usdt/addresses/{address}/balance', name: 'api_tron_usdt_balance', methods: ['GET'])]
    public function balance(string $address): JsonResponse
    {
        try {
            $balance = $this->registry->requireCapability('tron', 'mainnet', TronTokenBalanceCapability::class)->tokenBalanceBaseUnits($address);

            return new JsonResponse([
                'chain' => 'tron', 'network' => 'mainnet', 'networkId' => 'tron-mainnet',
                'assetRouteId' => TronTransferIntent::ROUTE, 'address' => $address,
                'balanceBaseUnits' => $balance, 'decimals' => 6,
                'contractAddress' => 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
            ]);
        } catch (\InvalidArgumentException) {
            return new JsonResponse(['error' => 'invalid_address'], 400);
        } catch (TronProviderFailed $error) {
            return self::providerError($error);
        }
    }

    #[Route('/api/chains/tron/mainnet/transactions/prepare', name: 'api_tron_prepare', methods: ['POST'])]
    public function prepare(Request $request): JsonResponse
    {
        try {
            if (\strlen($request->getContent()) > 4096) {
                return new JsonResponse(['error' => 'invalid_transaction_intent'], 400);
            }
            $input = json_decode($request->getContent(), true, 16, \JSON_THROW_ON_ERROR);
            if (!\is_array($input)) {
                return new JsonResponse(['error' => 'invalid_transaction_intent'], 400);
            }
            // Validate before resolving a provider; only public intent is accepted.
            new TronTransferIntent($input);

            return new JsonResponse($this->registry->requireCapability('tron', 'mainnet', TronPreparationCapability::class)->prepareTransfer($input));
        } catch (\JsonException) {
            return new JsonResponse(['error' => 'invalid_json'], 400);
        } catch (\InvalidArgumentException) {
            return new JsonResponse(['error' => 'invalid_transaction_intent'], 400);
        } catch (TronProviderFailed $error) {
            return self::providerError($error);
        }
    }

    #[Route('/api/chains/tron/mainnet/transactions/{txId}', name: 'api_tron_status', requirements: ['txId' => '[0-9a-f]{64}'], methods: ['GET'])]
    public function status(string $txId): JsonResponse
    {
        try {
            return new JsonResponse($this->registry->requireCapability('tron', 'mainnet', TronStatusCapability::class)->transactionStatus($txId));
        } catch (\InvalidArgumentException) {
            return new JsonResponse(['error' => 'invalid_transaction_id'], 400);
        } catch (TronProviderFailed $error) {
            return self::providerError($error);
        }
    }

    private static function providerError(TronProviderFailed $error): JsonResponse
    {
        $status = match ($error->reason) {
            'provider_not_configured', 'provider_rate_limited', 'provider_unavailable' => 503,
            'transfer_estimation_failed', 'fee_limit_exceeded', 'sender_inactive', 'insufficient_token_balance', 'insufficient_trx_balance' => 422,
            default => 502,
        };

        return new JsonResponse(['error' => $error->reason], $status);
    }
}
