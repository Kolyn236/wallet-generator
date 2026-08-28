<?php

declare(strict_types=1);

namespace App\Blockchain\Presentation\Http;

use App\Blockchain\Application\BitcoinFeePolicy;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

final readonly class BitcoinFeePolicyController
{
    public function __construct(private BitcoinFeePolicy $feePolicy)
    {
    }

    #[Route('/api/chains/bitcoin/mainnet/fee-policy', name: 'api_bitcoin_fee_policy', methods: ['GET'])]
    public function __invoke(): JsonResponse
    {
        return new JsonResponse([
            'chain' => 'bitcoin',
            'network' => 'mainnet',
            'kind' => BitcoinFeePolicy::KIND,
            'recommendedRate' => $this->feePolicy->recommendedRateBtcPerKb,
            'unit' => BitcoinFeePolicy::UNIT,
        ], headers: [
            'Cache-Control' => 'no-store, private',
        ]);
    }
}
