<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

interface SuccessfulBroadcastStore
{
    public function findSuccessfulTxid(string $chain, string $network, string $signedPayloadFingerprint): ?string;

    public function rememberSuccessful(
        string $chain,
        string $network,
        string $txid,
        string $signedPayloadFingerprint,
    ): void;
}
