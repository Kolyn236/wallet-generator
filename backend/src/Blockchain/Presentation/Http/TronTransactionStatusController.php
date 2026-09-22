<?php

declare(strict_types=1);

namespace App\Blockchain\Presentation\Http;

use App\Blockchain\Application\TronProviderException;
use App\Blockchain\Application\TronTransferService;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

final readonly class TronTransactionStatusController
{
    public function __construct(private TronTransferService $service) {}
    #[Route('/api/chains/tron/mainnet/transactions/{txId}', methods: ['GET'])]
    public function __invoke(string $txId): JsonResponse
    {
        try { return new JsonResponse($this->service->status($txId)); }
        catch (\InvalidArgumentException) { return new JsonResponse(['error'=>['code'=>'INVALID_REQUEST','message'=>'Invalid transaction identity.','retryable'=>false]],400); }
        catch (TronProviderException $e) { return new JsonResponse(['error'=>['code'=>$e->codeName,'message'=>$e->getMessage(),'retryable'=>$e->retryable]],502); }
    }
}
