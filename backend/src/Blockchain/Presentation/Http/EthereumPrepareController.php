<?php

declare(strict_types=1);

namespace App\Blockchain\Presentation\Http;

use App\Blockchain\Application\EthereumRpcFailed;
use App\Blockchain\Application\EvmTransactionIntent;
use App\Blockchain\Application\PrepareEthereumTransaction;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

final readonly class EthereumPrepareController
{
    private const array ALLOWED_FIELDS = ['from', 'to', 'valueWei', 'data'];

    public function __construct(private PrepareEthereumTransaction $prepareTransaction)
    {
    }

    #[Route('/api/chains/ethereum/mainnet/transactions/prepare', name: 'api_ethereum_prepare', methods: ['POST'])]
    public function __invoke(Request $request): JsonResponse
    {
        try {
            $payload = json_decode($request->getContent(), true, 32, \JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return new JsonResponse(['error' => 'invalid_json'], 400);
        }

        if (!\is_array($payload) || array_diff(array_keys($payload), self::ALLOWED_FIELDS)) {
            return new JsonResponse(['error' => 'invalid_transaction_intent'], 400);
        }

        foreach (self::ALLOWED_FIELDS as $field) {
            if (!isset($payload[$field]) || !\is_string($payload[$field])) {
                return new JsonResponse(['error' => 'invalid_transaction_intent'], 400);
            }
        }

        try {
            $intent = new EvmTransactionIntent(
                $payload['from'],
                $payload['to'],
                $payload['valueWei'],
                $payload['data'],
            );
            $prepared = ($this->prepareTransaction)($intent);
        } catch (\InvalidArgumentException) {
            return new JsonResponse(['error' => 'invalid_transaction_intent'], 400);
        } catch (EthereumRpcFailed $exception) {
            return new JsonResponse(['error' => $exception->reason], self::statusFor($exception));
        }

        return new JsonResponse([
            'chain' => 'ethereum',
            'network' => 'mainnet',
            'chainId' => $prepared::CHAIN_ID,
            'from' => $prepared->intent->from,
            'to' => $prepared->intent->to,
            'valueWei' => $prepared->intent->valueWei,
            'data' => $prepared->intent->data,
            'senderBalanceWei' => $prepared->senderBalanceWei,
            'nonce' => $prepared->nonce,
            'gasLimit' => $prepared->gasLimit,
            'feePolicy' => [
                'kind' => 'eip1559',
                'baseFeePerGasWei' => $prepared->feePolicy->baseFeePerGasWei,
                'maxPriorityFeePerGasWei' => $prepared->feePolicy->maxPriorityFeePerGasWei,
                'maxFeePerGasWei' => $prepared->feePolicy->maxFeePerGasWei,
            ],
        ]);
    }

    private static function statusFor(EthereumRpcFailed $exception): int
    {
        return match ($exception->reason) {
            'provider_not_configured', 'provider_rate_limited' => 503,
            'gas_estimation_failed' => 422,
            default => 502,
        };
    }
}
