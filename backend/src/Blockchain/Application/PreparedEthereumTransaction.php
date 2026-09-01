<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

use App\Blockchain\Domain\EvmQuantity;

final readonly class PreparedEthereumTransaction
{
    public const int CHAIN_ID = 1;

    public string $senderBalanceWei;
    public string $nonce;
    public string $gasLimit;

    public function __construct(
        public EvmTransactionIntent $intent,
        string $senderBalanceWei,
        string $nonce,
        string $gasLimit,
        public Eip1559FeeQuote $feePolicy,
    ) {
        $this->senderBalanceWei = EvmQuantity::fromDecimal($senderBalanceWei)->decimal;
        $this->nonce = EvmQuantity::fromDecimal($nonce)->decimal;
        $this->gasLimit = EvmQuantity::fromDecimal($gasLimit)->decimal;
    }
}
