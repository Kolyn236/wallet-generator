<?php

declare(strict_types=1);

namespace App\Blockchain\Domain;

final readonly class TronAddress
{
    private const string BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    private const int DECODED_LENGTH = 25;
    private const int PAYLOAD_LENGTH = 21;
    private const int MAINNET_PREFIX = 0x41;

    private function __construct(
        public string $base58,
        public string $hex,
    ) {
    }

    public static function fromString(string $address): self
    {
        if (1 !== preg_match('/^T[1-9A-HJ-NP-Za-km-z]{33}$/', $address)) {
            throw new \InvalidArgumentException('Invalid TRON address format.');
        }

        $decoded = self::decodeBase58($address);
        if (self::DECODED_LENGTH !== \strlen($decoded)) {
            throw new \InvalidArgumentException('Invalid TRON address length.');
        }

        $payload = substr($decoded, 0, self::PAYLOAD_LENGTH);
        if (self::MAINNET_PREFIX !== \ord($payload[0])) {
            throw new \InvalidArgumentException('Only TRON mainnet addresses are supported.');
        }

        $checksum = substr($decoded, self::PAYLOAD_LENGTH, 4);
        $expectedChecksum = substr(hash('sha256', hash('sha256', $payload, true), true), 0, 4);
        if (!hash_equals($expectedChecksum, $checksum)) {
            throw new \InvalidArgumentException('Invalid TRON address checksum.');
        }

        return new self($address, bin2hex($payload));
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
            for ($index = 0, $count = \count($bytes); $index < $count; ++$index) {
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
