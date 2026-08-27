<?php

declare(strict_types=1);

namespace App\Blockchain\Domain;

final readonly class DogecoinAddress
{
    private const string BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    private const int P2PKH_VERSION = 0x1e;
    private const int DECODED_LENGTH = 25;
    private const int PAYLOAD_LENGTH = 21;

    private function __construct(public string $value)
    {
    }

    public static function fromString(string $address): self
    {
        if ('' === $address || 1 !== \preg_match('/^[1-9A-HJ-NP-Za-km-z]{26,35}$/', $address)) {
            throw new \InvalidArgumentException('Invalid Dogecoin address format.');
        }

        $decoded = self::decodeBase58($address);
        if (self::DECODED_LENGTH !== \strlen($decoded) || self::P2PKH_VERSION !== \ord($decoded[0])) {
            throw new \InvalidArgumentException('Invalid Dogecoin address version.');
        }

        $payload = \substr($decoded, 0, self::PAYLOAD_LENGTH);
        $checksum = \substr($decoded, self::PAYLOAD_LENGTH, 4);
        $expectedChecksum = \substr(
            \hash('sha256', \hash('sha256', $payload, true), true),
            0,
            4,
        );

        if (!\hash_equals($expectedChecksum, $checksum)) {
            throw new \InvalidArgumentException('Invalid Dogecoin address checksum.');
        }

        return new self($address);
    }

    private static function decodeBase58(string $value): string
    {
        /** @var list<int> $bytes Little-endian byte array. */
        $bytes = [0];

        foreach (\str_split($value) as $character) {
            $digit = \strpos(self::BASE58_ALPHABET, $character);
            if (false === $digit) {
                throw new \InvalidArgumentException('Invalid Base58 character.');
            }

            $carry = $digit;
            $count = \count($bytes);
            for ($index = 0; $index < $count; ++$index) {
                $carry += $bytes[$index] * 58;
                $bytes[$index] = $carry & 0xff;
                $carry >>= 8;
            }

            while ($carry > 0) {
                $bytes[] = $carry & 0xff;
                $carry >>= 8;
            }
        }

        $decoded = '';
        for ($index = \count($bytes) - 1; $index >= 0; --$index) {
            $decoded .= \chr($bytes[$index]);
        }

        return $decoded;
    }
}
