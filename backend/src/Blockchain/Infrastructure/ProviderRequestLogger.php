<?php

declare(strict_types=1);

namespace App\Blockchain\Infrastructure;

final class ProviderRequestLogger
{
    /**
     * @param array<string, bool|float|int|string|null> $context
     */
    public function info(string $event, array $context = []): void
    {
        $this->write('info', $event, $context);
    }

    /**
     * @param array<string, bool|float|int|string|null> $context
     */
    public function warning(string $event, array $context = []): void
    {
        $this->write('warning', $event, $context);
    }

    /**
     * @param array<string, bool|float|int|string|null> $context
     */
    public function error(string $event, array $context = []): void
    {
        $this->write('error', $event, $context);
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
    private function write(string $level, string $event, array $context): void
    {
        $record = [
            'channel' => 'blockchain_provider',
            'level' => $level,
            'event' => $event,
            'timestamp' => gmdate('c'),
            ...$context,
        ];

        $encoded = json_encode($record, \JSON_UNESCAPED_SLASHES | \JSON_UNESCAPED_UNICODE);
        error_log(false === $encoded ? '[blockchain_provider] log_encoding_failed' : $encoded);
    }
}
