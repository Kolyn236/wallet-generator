<?php

declare(strict_types=1);

namespace App\Blockchain\Infrastructure;

final class ProviderRequestLogger
{
    /**
     * @param array<string, bool|float|int|string|null> $context
     */
    public function warning(array $context = []): void
    {
        $this->write('warning', $context);
    }

    /**
     * @param array<string, bool|float|int|string|null> $context
     */
    public function error(array $context = []): void
    {
        $this->write('error', $context);
    }

    public static function maskedAddress(string $address): string
    {
        if (\strlen($address) <= 12) {
            return $address;
        }

        return substr($address, 0, 6).'…'.substr($address, -4);
    }

    /**
     * @param array<string, bool|float|int|string|null> $context
     */
    private function write(string $level, array $context): void
    {
        $record = [
            'channel' => 'blockchain_provider',
            'level' => $level,
            'timestamp' => gmdate('c'),
            ...$context,
        ];

        $encoded = json_encode($record, \JSON_UNESCAPED_SLASHES | \JSON_UNESCAPED_UNICODE);
        error_log(false === $encoded ? '[blockchain_provider] log_encoding_failed' : $encoded);
    }
}
