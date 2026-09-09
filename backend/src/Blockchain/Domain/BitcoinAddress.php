<?php

declare(strict_types=1);

namespace App\Blockchain\Domain;

final readonly class BitcoinAddress
{
    private const string BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    private const int P2PKH_VERSION = 0x00;
    private const int P2SH_VERSION = 0x05;
    private const int DECODED_LENGTH = 25;
    private const int PAYLOAD_LENGTH = 21;

    private function __construct(public string $value)
    {
    }

    public static function fromString(string $address): self
    {
        if ('' === $address || 1 !== preg_match('/^[1-9A-HJ-NP-Za-km-z]{26,35}$/', $address)) {
            throw new \InvalidArgumentException('Invalid Bitcoin address format.');
        }

        $decoded = self::decodeBase58($address);
        if (self::DECODED_LENGTH !== \strlen($decoded)) {
            throw new \InvalidArgumentException('Invalid Bitcoin address length.');
        }

        $version = \ord($decoded[0]);
        if (!\in_array($version, [self::P2PKH_VERSION, self::P2SH_VERSION], true)) {
            throw new \InvalidArgumentException('Only Bitcoin mainnet legacy P2PKH/P2SH addresses are supported.');
        }

        $payload = substr($decoded, 0, self::PAYLOAD_LENGTH);
        $checksum = substr($decoded, self::PAYLOAD_LENGTH, 4);
        $expectedChecksum = substr(
            hash('sha256', hash('sha256', $payload, true), true),
            0,
            4,
        );

        if (!hash_equals($expectedChecksum, $checksum)) {
            throw new \InvalidArgumentException('Invalid Bitcoin address checksum.');
        }

        return new self($address);
    }

    private static function decodeBase58(string $value): string
    {
        $leadingZeroes = strspn($value, '1');
        $numericPart = substr($value, $leadingZeroes);

        /** @var list<int> $bytes Little-endian byte array. */
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
