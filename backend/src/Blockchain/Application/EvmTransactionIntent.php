<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

use App\Blockchain\Domain\EthereumAddress;
use App\Blockchain\Domain\EvmQuantity;

final readonly class EvmTransactionIntent
{
    private const int MAX_CALLDATA_BYTES = 32_768;

    public string $from;
    public string $to;
    public string $valueWei;
    public string $data;

    public function __construct(string $from, string $to, string $valueWei, string $data)
    {
        $this->from = EthereumAddress::fromString($from)->value;
        $this->to = EthereumAddress::fromString($to)->value;
        $this->valueWei = EvmQuantity::fromDecimal($valueWei)->decimal;

        if (1 !== preg_match('/^0x(?:[0-9a-fA-F]{2})*$/', $data)) {
            throw new \InvalidArgumentException('EVM calldata must be 0x-prefixed even-length hexadecimal data.');
        }
        if ((\strlen($data) - 2) / 2 > self::MAX_CALLDATA_BYTES) {
            throw new \InvalidArgumentException('EVM calldata is too large.');
        }

        $this->data = $data;
    }
}
