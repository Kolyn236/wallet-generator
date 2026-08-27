<?php

declare(strict_types=1);

namespace App\Blockchain\Infrastructure;

use App\Blockchain\Application\BalanceLookupFailed;
use App\Blockchain\Application\DogecoinBalanceProvider;
use App\Blockchain\Domain\AddressBalance;

final class BlockCypherDogecoinBalanceProvider implements DogecoinBalanceProvider
{
    private const string ENDPOINT = 'https://api.blockcypher.com/v1/doge/main/addrs/%s?limit=1';

    public function getConfirmedBalance(string $address): AddressBalance
    {
        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'timeout' => 10,
                'ignore_errors' => true,
                'header' => "Accept: application/json\r\nUser-Agent: wallet-platform/0.1\r\n",
            ],
        ]);

        $payload = @file_get_contents(\sprintf(self::ENDPOINT, rawurlencode($address)), false, $context);

        if (false === $payload) {
            throw new BalanceLookupFailed('Dogecoin provider request failed.');
        }

        try {
            $decoded = json_decode($payload, true, 512, \JSON_THROW_ON_ERROR);
        } catch (\JsonException $exception) {
            throw new BalanceLookupFailed('Dogecoin provider returned invalid JSON.', previous: $exception);
        }

        if (!\is_array($decoded) || ($decoded['address'] ?? null) !== $address) {
            throw new BalanceLookupFailed('Dogecoin provider returned an unexpected response.');
        }

        $balance = $decoded['balance'] ?? null;
        if (!\is_int($balance) || $balance < 0) {
            throw new BalanceLookupFailed('Dogecoin provider returned an invalid balance.');
        }

        return new AddressBalance($address, $balance);
    }
}
