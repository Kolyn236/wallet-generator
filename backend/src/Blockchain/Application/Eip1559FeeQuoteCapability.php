<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

interface Eip1559FeeQuoteCapability
{
    public function eip1559FeeQuote(): Eip1559FeeQuote;
}
