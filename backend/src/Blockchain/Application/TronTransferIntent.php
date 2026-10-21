<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

use App\Blockchain\Domain\EvmQuantity;
use App\Blockchain\Domain\TronAddress;

final readonly class TronTransferIntent
{
    public const ROUTE = 'usdt-tron-mainnet-trc20';
    public const UINT256_MAX = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
    public TronAddress $from;
    public TronAddress $to;
    public string $amount;

    /** @param array<string,mixed> $input */
    public function __construct(array $input)
    {
        $fields = ['assetRouteId', 'from', 'to', 'amountBaseUnits'];
        if (4 !== \count($input) || [] !== array_diff(array_keys($input), $fields)) {
            throw new \InvalidArgumentException('Invalid transaction intent.');
        }
        foreach ($fields as $key) {
            if (!\is_string($input[$key] ?? null)) {
                throw new \InvalidArgumentException('Invalid transaction intent.');
            }
        }
        if (self::ROUTE !== $input['assetRouteId']) {
            throw new \InvalidArgumentException('Invalid asset route.');
        }
        $amount = $input['amountBaseUnits'];
        if (\strlen($amount) > 78 || !preg_match('/^[1-9][0-9]*$/', $amount) || (78 === \strlen($amount) && strcmp($amount, self::UINT256_MAX) > 0)) {
            throw new \InvalidArgumentException('Invalid token amount.');
        }
        $this->from = TronAddress::fromString($input['from']);
        $this->to = TronAddress::fromString($input['to']);
        $this->amount = $amount;
    }

    public function parameterHex(): string
    {
        return str_pad(substr($this->to->hex, 2), 64, '0', \STR_PAD_LEFT).str_pad(substr(EvmQuantity::fromDecimal($this->amount)->toHex(), 2), 64, '0', \STR_PAD_LEFT);
    }
}
