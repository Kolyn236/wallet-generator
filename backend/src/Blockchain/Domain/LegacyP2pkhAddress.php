<?php

declare(strict_types=1);

namespace App\Blockchain\Domain;

final readonly class LegacyP2pkhAddress
{
    private const string BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

    private function __construct(public string $value)
    {
    }

    public static function fromString(string $address, int $version): self
    {
        if ('' === $address || $version < 0 || $version > 255 || 1 !== preg_match('/^[1-9A-HJ-NP-Za-km-z]{26,35}$/', $address)) {
            throw new \InvalidArgumentException('Invalid legacy P2PKH address format.');
        }
        $decoded = self::decodeBase58($address);
        if (25 !== \strlen($decoded) || $version !== \ord($decoded[0])) {
            throw new \InvalidArgumentException('Unexpected legacy P2PKH network version.');
        }
        $payload = substr($decoded, 0, 21);
        $checksum = substr($decoded, 21, 4);
        $expected = substr(hash('sha256', hash('sha256', $payload, true), true), 0, 4);
        if (!hash_equals($expected, $checksum)) {
            throw new \InvalidArgumentException('Invalid legacy P2PKH address checksum.');
        }

        return new self($address);
    }

    private static function decodeBase58(string $value): string
    {
        $leadingZeroes = strspn($value, '1');
        $numericPart = substr($value, $leadingZeroes);
        $bytes = [0];
        foreach (str_split($numericPart) as $character) {
            $digit = strpos(self::BASE58_ALPHABET, $character);
            if (false === $digit) {
                throw new \InvalidArgumentException('Invalid Base58 character.');
            }
            $carry = $digit;
            $count = \count($bytes);
            for ($index = 0; $index < $count; ++$index) {
                $carry += $bytes[$index] * 58;
                $bytes[$index] = $carry & 0xFF;
                $carry >>= 8;
            }
            while ($carry > 0) {
                $bytes[] = $carry & 0xFF;
                $carry >>= 8;
            }
        }
        $decoded = '';
        if ('' !== $numericPart) {
            for ($index = \count($bytes) - 1; $index >= 0; --$index) {
                $decoded .= \chr($bytes[$index]);
            }
            $decoded = ltrim($decoded, "\0");
        }

        return str_repeat("\0", $leadingZeroes).$decoded;
    }
}
