<?php

declare(strict_types=1);

namespace App\Tests\Presentation\Http;

use App\Presentation\Http\HealthController;
use PHPUnit\Framework\TestCase;

final class HealthControllerTest extends TestCase
{
    public function testReturnsHealthyJsonResponse(): void
    {
        $response = (new HealthController())();

        self::assertSame(200, $response->getStatusCode());
        self::assertSame('no-store', $response->headers->get('Cache-Control'));
        self::assertSame(
            ['status' => 'ok', 'service' => 'chain-courier-backend'],
            json_decode((string) $response->getContent(), true, flags: \JSON_THROW_ON_ERROR),
        );
    }
}
