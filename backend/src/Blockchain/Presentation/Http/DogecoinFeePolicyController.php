<?php

declare(strict_types=1);

namespace App\Blockchain\Presentation\Http;

use App\Blockchain\Application\ChainAdapterRegistry;
use App\Blockchain\Application\UtxoFeeRateCapability;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

final readonly class DogecoinFeePolicyController
{
    public function __construct(private ChainAdapterRegistry $adapters)
    {
    }

    #[Route('/api/chains/dogecoin/mainnet/fee-policy', name: 'api_dogecoin_fee_policy', methods: ['GET'])]
    public function __invoke(): JsonResponse
    {
        $feeRate = $this->adapters
            ->requireCapability('dogecoin', 'mainnet', UtxoFeeRateCapability::class)
            ->feeRate();

        return new JsonResponse([
            'chain' => 'dogecoin',
            'network' => 'mainnet',
            'kind' => $feeRate->kind,
            'recommendedRate' => $feeRate->recommendedRate,
            'unit' => $feeRate->unit,
        ], headers: [
            'Cache-Control' => 'no-store, private',
        ]);
    }
}
