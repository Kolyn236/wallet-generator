<?php

declare(strict_types=1);

namespace App\Blockchain\Infrastructure;

use App\Blockchain\Application\TronProviderFailed;

final readonly class TronRpcClient
{
    // TIP-474: full mainnet genesis identity, not merely an address prefix.
    public const GENESIS = '00000000000000001ebf88508a03865c71d452e25f4d51194196a1d22b6653dc';

    public function __construct(private string $rpcUrl, private TronHttpTransport $transport)
    {
    }

    public function assertMainnet(): void
    {
        $block = $this->read('/wallet/getblockbynum', ['num' => 0]);
        if (($block['blockID'] ?? null) !== self::GENESIS) {
            throw new TronProviderFailed('provider_network_mismatch');
        }
    }

    /** @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    public function read(string $path, array $payload = []): array
    {
        // Transport is deliberately incapable of forwarding arbitrary node operations.
        if (!\in_array($path, [
            '/wallet/getblockbynum', '/wallet/triggerconstantcontract', '/wallet/getaccount',
            '/wallet/getchainparameters', '/wallet/getaccountresource',
            '/wallet/gettransactionbyid', '/wallet/gettransactioninfobyid',
            '/walletsolidity/getnowblock', '/walletsolidity/gettransactionbyid',
            '/walletsolidity/gettransactioninfobyid',
        ], true)) {
            throw new \LogicException('Unsupported TRON read operation.');
        }
        if (!\in_array(parse_url($this->rpcUrl, \PHP_URL_SCHEME), ['https', 'http'], true)) {
            throw new TronProviderFailed('provider_not_configured');
        }
        try {
            $body = $this->transport->post(rtrim($this->rpcUrl, '/').$path, json_encode((object) $payload, \JSON_THROW_ON_ERROR));
            if (\strlen($body) > 1048576 || !str_starts_with(ltrim($body), '{')) {
                throw new TronProviderFailed();
            }
            $data = json_decode($body, true, 64, \JSON_THROW_ON_ERROR | \JSON_BIGINT_AS_STRING);
        } catch (TronProviderFailed $error) {
            throw $error;
        } catch (\Throwable) {
            throw new TronProviderFailed('provider_unavailable');
        }
        if (!\is_array($data) || isset($data['Error']) || isset($data['error'])) {
            throw new TronProviderFailed();
        }

        return $data;
    }
}
