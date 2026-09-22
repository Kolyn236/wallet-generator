<?php

declare(strict_types=1);

namespace App\Blockchain\Domain;

final class TronAddress
{
    private const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    private function __construct(public readonly string $base58, public readonly string $hex) {}
    public static function fromString(string $value): self
    {
        if (!preg_match('/^T[1-9A-HJ-NP-Za-km-z]{33}$/', $value)) throw new \InvalidArgumentException('Invalid Tron address.');
        $decoded = [0]; foreach (str_split($value) as $char) { $p = strpos(self::ALPHABET, $char); if (false === $p) throw new \InvalidArgumentException('Invalid Tron address.'); $carry = $p; for ($i = count($decoded) - 1; $i >= 0; --$i) { $n = $decoded[$i] * 58 + $carry; $decoded[$i] = $n & 255; $carry = intdiv($n, 256); } while ($carry > 0) { array_unshift($decoded, $carry & 255); $carry = intdiv($carry, 256); } }
        $bytes = ''; foreach ($decoded as $byte) $bytes .= chr($byte); $bytes = str_pad($bytes, 25, "\0", STR_PAD_LEFT); if (strlen($bytes) !== 25 || $bytes[0] !== "\x41") throw new \InvalidArgumentException('Invalid Tron address.');
        if (!hash_equals(substr(hash('sha256', hash('sha256', substr($bytes, 0, 21), true), true), 0, 4), substr($bytes, 21))) throw new \InvalidArgumentException('Invalid Tron checksum.');
        return new self($value, strtolower(bin2hex(substr($bytes, 0, 21))));
    }
    public function payloadHex(): string { return substr($this->hex, 2); }
}
