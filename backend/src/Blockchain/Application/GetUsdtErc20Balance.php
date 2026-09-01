<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

use App\Blockchain\Domain\EthereumAddress;

final readonly class GetUsdtErc20Balance
{
    public const string CONTRACT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
    public const int DECIMALS = 6;
    public const string SYMBOL = 'USDT';

    public function __construct(private ChainAdapterRegistry $registry)
    {
    }

    public function __invoke(string $address): Erc20TokenBalance
    {
        $holder = EthereumAddress::fromString($address);
        $capability = $this->registry->requireCapability('ethereum', 'mainnet', Erc20BalanceCapability::class);

        return new Erc20TokenBalance(
            $holder->value,
            $capability->erc20Balance(self::CONTRACT_ADDRESS, $holder->value),
            self::DECIMALS,
            self::SYMBOL,
        );
    }
}
