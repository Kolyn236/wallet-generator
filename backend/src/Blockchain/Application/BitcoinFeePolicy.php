<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

final readonly class BitcoinFeePolicy
{
    public const string KIND = 'utxo-rate-per-kb';
    public const string UNIT = 'BTC/kB';

    public string $recommendedRateBtcPerKb;

    public function __construct(string $recommendedRateBtcPerKb)
    {
        $normalized = trim($recommendedRateBtcPerKb);
        $match = [];

        if (1 !== preg_match('/^(0|[1-9]\d*)(?:\.(\d{1,8}))?$/', $normalized, $match)) {
            throw new \InvalidArgumentException('BTC_RECOMMENDED_FEE_RATE must be a positive BTC amount with at most 8 decimal places.');
        }

        $whole = $match[1];
        $fraction = $match[2] ?? '';
        if ('0' === $whole && '' === trim($fraction, '0')) {
            throw new \InvalidArgumentException('BTC_RECOMMENDED_FEE_RATE must be greater than zero.');
        }

        $this->recommendedRateBtcPerKb = $normalized;
    }
}
