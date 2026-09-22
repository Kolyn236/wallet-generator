<?php

declare(strict_types=1);

namespace App\Blockchain\Presentation\Http;

use App\Blockchain\Application\TronProviderException;
use App\Blockchain\Application\TronTransferService;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

final readonly class TronPrepareController
{
    public function __construct(private TronTransferService $service) {}
    #[Route('/api/chains/tron/mainnet/usdt-trc20/prepare', methods: ['POST'])]
    public function __invoke(Request $request): JsonResponse
    {
        try { if ('application/json' !== strtolower((string) $request->headers->get('Content-Type')) || strlen($request->getContent()) > 65536) throw new \InvalidArgumentException(); $payload=json_decode($request->getContent(),true,32,JSON_THROW_ON_ERROR); if (!is_array($payload)) throw new \InvalidArgumentException(); return new JsonResponse($this->service->prepare($payload)); }
        catch (\JsonException|\InvalidArgumentException) { return self::error('INVALID_INTENT','Invalid transfer intent.',false,400); }
        catch (TronProviderException $e) { return self::error($e->codeName,$e->getMessage(),$e->retryable,502); }
    }
    private static function error(string $code,string $message,bool $retryable,int $status): JsonResponse { return new JsonResponse(['error'=>['code'=>$code,'message'=>$message,'retryable'=>$retryable]],$status); }
}
