<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

interface EvmGasEstimateCapability
{
    public function estimateGas(EvmTransactionIntent $intent): string;
}
