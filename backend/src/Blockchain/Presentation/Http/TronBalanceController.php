<?php

declare(strict_types=1);

namespace App\Blockchain\Presentation\Http;

use App\Blockchain\Application\TronProviderException;
use App\Blockchain\Application\TronTransferService;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

final readonly class TronBalanceController
{
    public function __construct(private TronTransferService $service) {}
    #[Route('/api/chains/tron/mainnet/usdt-trc20/balance', methods: ['POST'])]
    public function __invoke(Request $request): JsonResponse
    {
        try { $content=$request->getContent(); if ('application/json' !== strtolower((string) $request->headers->get('Content-Type')) || strlen($content) > 65536) throw new \InvalidArgumentException(); $data=$this->json($content); if (array_keys($data)!==['address'] || !is_string($data['address'])) throw new \InvalidArgumentException(); return new JsonResponse($this->service->balance($data['address'])); }
        catch (\JsonException|\InvalidArgumentException $e) { return self::error('INVALID_REQUEST', 'Invalid JSON request.', false, 400); }
        catch (TronProviderException $e) { return self::error($e->codeName, $e->getMessage(), $e->retryable, 502); }
    }
    /** @return array<string,mixed> */ private function json(string $content): array { $v=json_decode($content, true, 32, JSON_THROW_ON_ERROR); if (!is_array($v)) throw new \InvalidArgumentException(); return $v; }
    private static function error(string $code,string $message,bool $retryable,int $status): JsonResponse { return new JsonResponse(['error'=>['code'=>$code,'message'=>$message,'retryable'=>$retryable]],$status); }
}
