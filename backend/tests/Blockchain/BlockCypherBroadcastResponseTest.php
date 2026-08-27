<?php

declare(strict_types=1);

namespace App\Tests\Blockchain;

use App\Blockchain\Infrastructure\BlockCypherBroadcastResponse;
use PHPUnit\Framework\TestCase;

final class BlockCypherBroadcastResponseTest extends TestCase
{
    private const string TXID = '633fe46be822550e5525aefd0b47bab2044b6305b0fa431bab0fe70665f58466';

    public function testReadsTransactionHashFromAcceptedPushResponse(): void
    {
        self::assertSame(self::TXID, BlockCypherBroadcastResponse::txid([
            'tx' => [
                'hash' => self::TXID,
                'confirmations' => 0,
            ],
        ]));
    }

    public function testKeepsCompatibilityWithRootHashResponses(): void
    {
        self::assertSame(self::TXID, BlockCypherBroadcastResponse::txid([
            'hash' => strtoupper(self::TXID),
        ]));
    }

    public function testRejectsMissingOrMalformedHash(): void
    {
        self::assertNull(BlockCypherBroadcastResponse::txid(['tx' => []]));
        self::assertNull(BlockCypherBroadcastResponse::txid(['tx' => ['hash' => 'not-a-txid']]));
    }
}
