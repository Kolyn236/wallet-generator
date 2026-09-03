<?php

declare(strict_types=1);

namespace App\Tests\Architecture;

use PHPUnit\Framework\TestCase;

final class SecretLoggingInvariantTest extends TestCase
{
    public function testAbuseTelemetryDoesNotInspectOrNameSecretBearingFields(): void
    {
        $paths = [
            __DIR__.'/../../src/Presentation/Http/ApiAbuseLogger.php',
            __DIR__.'/../../src/Blockchain/Infrastructure/ProviderRequestLogger.php',
            __DIR__.'/../../src/Blockchain/Infrastructure/ProviderCooldown.php',
            __DIR__.'/../../src/Blockchain/Infrastructure/CacheSuccessfulBroadcastStore.php',
        ];
        $forbidden = [
            'mnemonic',
            'privatekey',
            'private_key',
            "'wif'",
            'getcontent()',
            'rawtransaction',
            'ethereum_rpc_url',
            'rpcurl',
        ];

        foreach ($paths as $path) {
            $source = file_get_contents($path);
            self::assertIsString($source);
            $normalized = strtolower($source);

            foreach ($forbidden as $needle) {
                self::assertStringNotContainsString($needle, $normalized, $path.' must not inspect or log '.$needle);
            }
        }
    }

    public function testRateLimitPoliciesKeepExpensiveOperationsStricterThanCheapOnes(): void
    {
        $services = file_get_contents(__DIR__.'/../../config/services.yaml');
        self::assertIsString($services);

        self::assertStringContainsString('cheap: { limit: 120, window: 60 }', $services);
        self::assertStringContainsString('balance: { limit: 60, window: 60 }', $services);
        self::assertStringContainsString('utxo: { limit: 30, window: 60 }', $services);
        self::assertStringContainsString('ethereum_prepare: { limit: 10, window: 60 }', $services);
        self::assertStringContainsString('broadcast: { limit: 5, window: 60 }', $services);
    }

    public function testTrustedProxyDefaultDoesNotTrustArbitraryNetworks(): void
    {
        $framework = file_get_contents(__DIR__.'/../../config/packages/framework.yaml');
        $services = file_get_contents(__DIR__.'/../../config/services.yaml');
        self::assertIsString($framework);
        self::assertIsString($services);

        self::assertStringContainsString("trusted_proxies: '%env(TRUSTED_PROXIES)%'", $framework);
        self::assertStringContainsString("env(TRUSTED_PROXIES): ''", $services);
        self::assertStringNotContainsString('0.0.0.0/0', $framework.$services);
        self::assertStringNotContainsString('private_ranges', strtolower($framework.$services));
    }
}
