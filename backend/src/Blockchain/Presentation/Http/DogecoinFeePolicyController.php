<?php

declare(strict_types=1);

namespace App\Blockchain\Presentation\Http;

use App\Blockchain\Application\DogecoinFeePolicy;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

final readonly class DogecoinFeePolicyController
{
    public function __construct(private DogecoinFeePolicy $feePolicy)
    {
    }

    #[Route('/api/chains/dogecoin/mainnet/fee-policy', name: 'api_dogecoin_fee_policy', methods: ['GET'])]
    public function __invoke(): JsonResponse
    {
        return new JsonResponse([
            'chain' => 'dogecoin',
            'network' => 'mainnet',
            'kind' => DogecoinFeePolicy::KIND,
            'recommendedRate' => $this->feePolicy->recommendedRateDogePerKb,
            'unit' => DogecoinFeePolicy::UNIT,
        ]);
    }
}
