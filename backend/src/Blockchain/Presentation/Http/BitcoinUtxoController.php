<?php

declare(strict_types=1);

namespace App\Blockchain\Presentation\Http;

use App\Blockchain\Application\GetBitcoinAddressUtxos;
use App\Blockchain\Application\UtxoLookupFailed;
use App\Blockchain\Domain\BitcoinUtxo;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

final readonly class BitcoinUtxoController
{
    public function __construct(private GetBitcoinAddressUtxos $getUtxos)
    {
    }

    #[Route('/api/chains/bitcoin/mainnet/addresses/{address}/utxos', name: 'api_bitcoin_utxos', methods: ['GET'])]
    public function __invoke(string $address): JsonResponse
    {
        try {
            $utxos = ($this->getUtxos)($address);
        } catch (\InvalidArgumentException) {
            return new JsonResponse(['error' => 'invalid_address'], 400);
        } catch (UtxoLookupFailed $exception) {
            return new JsonResponse([
                'error' => 'provider_unavailable',
                'reason' => $exception->reason,
            ], 502);
        }

        return new JsonResponse([
            'chain' => 'bitcoin',
            'network' => 'mainnet',
            'address' => $address,
            'utxos' => array_map(
                static fn (BitcoinUtxo $utxo): array => [
                    'txid' => $utxo->txid,
                    'vout' => $utxo->vout,
                    'valueSmallestUnit' => (string) $utxo->valueSmallestUnit,
                    'scriptPubKey' => $utxo->scriptPubKey,
                    'confirmations' => $utxo->confirmations,
                ],
                $utxos,
            ),
        ]);
    }
}
