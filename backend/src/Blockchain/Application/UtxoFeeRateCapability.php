<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

interface UtxoFeeRateCapability
{
    public function feeRate(): UtxoFeeRate;
}
