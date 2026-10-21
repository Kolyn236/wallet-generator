<?php

declare(strict_types=1);

namespace App\Blockchain\Domain;

final readonly class TronAddress
{
    private function __construct(public string $base58, public string $hex)
    {
    }

    public static function fromString(string $address): self
    {
        if (1 !== preg_match('/^T[1-9A-HJ-NP-Za-km-z]{33}$/', $address)) {
            throw new \InvalidArgumentException('Invalid TRON address.');
        }
        // Reuse the dependency-free Base58Check validator with TRON's 0x41 prefix.
        LegacyP2pkhAddress::fromString($address, 0x41);
        $bytes = [0];
        foreach (str_split($address) as $character) {
            $carry = strpos('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz', $character);
            if (false === $carry) {
                throw new \InvalidArgumentException('Invalid TRON address.');
            }
            foreach ($bytes as $index => $byte) {
                $carry += $byte * 58;
                $bytes[$index] = $carry & 255;
                $carry >>= 8;
            }
            while ($carry > 0) {
                $bytes[] = $carry & 255;
                $carry >>= 8;
            }
        }
        $decoded = implode('', array_map(chr(...), array_reverse($bytes)));

        return new self($address, bin2hex(substr($decoded, 0, 21)));
    }
}
