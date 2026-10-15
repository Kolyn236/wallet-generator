<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

use App\Blockchain\Domain\TronAddress;

final readonly class GetUsdtTrc20Balance
{
    public const string CONTRACT_ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
    public const string CONTRACT_HEX = '41a614f803b6fd780986a42c78ec9c7f77e6ded13c';
    public const int DECIMALS = 6;
    public const string SYMBOL = 'USDT';

    public function __construct(private ChainAdapterRegistry $registry)
    {
    }

    public function __invoke(string $address): Trc20TokenBalance
    {
        $holder = TronAddress::fromString($address);
        $capability = $this->registry->requireCapability('tron', 'mainnet', Trc20BalanceCapability::class);

        return new Trc20TokenBalance(
            $holder->base58,
            $capability->trc20Balance(self::CONTRACT_ADDRESS, $holder->base58),
            self::DECIMALS,
            self::SYMBOL,
        );
    }
}
