<?php

declare(strict_types=1);

namespace App\Blockchain\Presentation\Http;

use App\Blockchain\Application\GetDogecoinAddressUtxos;
use App\Blockchain\Application\UtxoLookupFailed;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

final readonly class DogecoinUtxoController
{
    public function __construct(private GetDogecoinAddressUtxos $getUtxos)
    {
    }

    #[Route('/api/chains/dogecoin/mainnet/addresses/{address}/utxos', name: 'api_dogecoin_utxos', methods: ['GET'])]
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
            'chain' => 'dogecoin',
            'network' => 'mainnet',
            'address' => $address,
            'utxos' => array_map(
                static fn ($utxo): array => [
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
