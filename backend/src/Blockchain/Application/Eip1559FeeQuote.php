<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

use App\Blockchain\Domain\EvmQuantity;

final readonly class Eip1559FeeQuote
{
    public string $baseFeePerGasWei;
    public string $maxPriorityFeePerGasWei;
    public string $maxFeePerGasWei;

    public function __construct(
        string $baseFeePerGasWei,
        string $maxPriorityFeePerGasWei,
        string $maxFeePerGasWei,
    ) {
        $this->baseFeePerGasWei = EvmQuantity::fromDecimal($baseFeePerGasWei)->decimal;
        $this->maxPriorityFeePerGasWei = EvmQuantity::fromDecimal($maxPriorityFeePerGasWei)->decimal;
        $this->maxFeePerGasWei = EvmQuantity::fromDecimal($maxFeePerGasWei)->decimal;
    }
}
