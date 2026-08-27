<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

final readonly class DogecoinFeePolicy
{
    public const string KIND = 'utxo-rate-per-kb';
    public const string UNIT = 'DOGE/kB';

    public string $recommendedRateDogePerKb;

    public function __construct(string $recommendedRateDogePerKb)
    {
        $normalized = trim($recommendedRateDogePerKb);
        $match = [];

        if (1 !== preg_match('/^(0|[1-9]\d*)(?:\.(\d{1,8}))?$/', $normalized, $match)) {
            throw new \InvalidArgumentException('DOGE_RECOMMENDED_FEE_RATE must be a positive DOGE amount with at most 8 decimal places.');
        }

        $whole = $match[1];
        $fraction = $match[2] ?? '';
        if ('0' === $whole && '' === trim($fraction, '0')) {
            throw new \InvalidArgumentException('DOGE_RECOMMENDED_FEE_RATE must be greater than zero.');
        }

        $this->recommendedRateDogePerKb = $normalized;
    }
}
