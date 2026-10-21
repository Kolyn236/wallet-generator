<?php

declare(strict_types=1);

namespace App\Blockchain\Infrastructure;

use App\Blockchain\Application\TronProviderFailed;
use App\Blockchain\Domain\TronAddress;

final class TronProviderData
{
    public static function integer(mixed $value, int $max = \PHP_INT_MAX): int
    {
        if (\is_int($value) && $value >= 0 && $value <= $max) {
            return $value;
        }
        if (\is_string($value) && preg_match('/^(0|[1-9][0-9]*)$/', $value) && (\strlen($value) < \strlen((string) $max) || (\strlen($value) === \strlen((string) $max) && strcmp($value, (string) $max) <= 0))) {
            return (int) $value;
        }
        throw new TronProviderFailed();
    }

    /** @param array<string,mixed> $account */
    public static function account(array $account, TronAddress $expected): bool
    {
        if ([] === $account) {
            return false;
        }
        if (($account['address'] ?? null) !== $expected->hex) {
            throw new TronProviderFailed();
        }
        if (isset($account['balance'])) {
            self::integer($account['balance']);
        }

        return true;
    }
}
