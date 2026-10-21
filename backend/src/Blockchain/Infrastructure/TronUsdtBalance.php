<?php

declare(strict_types=1);

namespace App\Blockchain\Infrastructure;

use App\Blockchain\Application\TronProviderFailed;
use App\Blockchain\Domain\EvmQuantity;
use App\Blockchain\Domain\TronAddress;

final readonly class TronUsdtBalance
{
    public const CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
    public const CONTRACT_HEX = '41a614f803b6fd780986a42c78ec9c7f77e6ded13c';

    public function __construct(private TronRpcClient $rpc)
    {
    }

    public function read(string $address): string
    {
        $holder = TronAddress::fromString($address);
        $this->rpc->assertMainnet();
        $data = $this->rpc->read('/wallet/triggerconstantcontract', [
            'owner_address' => $holder->hex, 'contract_address' => self::CONTRACT_HEX,
            'function_selector' => 'balanceOf(address)',
            'parameter' => str_pad(substr($holder->hex, 2), 64, '0', \STR_PAD_LEFT),
            'visible' => false,
        ]);
        $word = $data['constant_result'][0] ?? null;
        if (($data['result']['result'] ?? null) !== true || !\is_string($word) || 1 !== preg_match('/^[0-9a-fA-F]{64}$/', $word) || 1 !== \count($data['constant_result'])) {
            throw new TronProviderFailed();
        }

        // ABI uint256 uses the same exact integer conversion, never floating point.
        return EvmQuantity::fromHex('0x'.(ltrim($word, '0') ?: '0'))->decimal;
    }
}
