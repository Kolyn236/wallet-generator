<?php

declare(strict_types=1);

namespace App\Blockchain\Presentation\Http;

use App\Blockchain\Application\TronProviderException;
use App\Blockchain\Application\TronTransferService;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

final readonly class TronBroadcastController
{
    public function __construct(private TronTransferService $service) {}
    #[Route('/api/chains/tron/mainnet/usdt-trc20/broadcast', methods: ['POST'])]
    public function __invoke(Request $request): JsonResponse
    {
        try { $payload=json_decode($request->getContent(),true,32,JSON_THROW_ON_ERROR); if (!is_array($payload)) throw new \InvalidArgumentException(); return new JsonResponse($this->service->broadcast($payload)); }
        catch (\JsonException|\InvalidArgumentException) { return self::error('INVALID_REQUEST','Invalid signed transaction request.',false,400); }
        catch (TronProviderException $e) { return self::error($e->codeName,$e->getMessage(),$e->retryable,502); }
    }
    private static function error(string $code,string $message,bool $retryable,int $status): JsonResponse { return new JsonResponse(['error'=>['code'=>$code,'message'=>$message,'retryable'=>$retryable]],$status); }
}
