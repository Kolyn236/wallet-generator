<?php

declare(strict_types=1);

namespace App\Blockchain\Domain;

final readonly class DogecoinRawTransaction
{
    private const int MAX_BYTES = 100_000;

    private function __construct(
        public string $hex,
        public string $txid,
        public int $sizeBytes,
    ) {
    }

    public static function fromHex(string $rawHex): self
    {
        $rawHex = strtolower(trim($rawHex));

        if ('' === $rawHex || 0 !== \strlen($rawHex) % 2 || 1 !== preg_match('/^[0-9a-f]+$/', $rawHex)) {
            throw new \InvalidArgumentException('Raw Dogecoin transaction must be non-empty hexadecimal.');
        }

        $sizeBytes = intdiv(\strlen($rawHex), 2);
        if ($sizeBytes > self::MAX_BYTES) {
            throw new \InvalidArgumentException('Raw Dogecoin transaction is too large.');
        }

        $raw = hex2bin($rawHex);
        if (false === $raw) {
            throw new \InvalidArgumentException('Raw Dogecoin transaction could not be decoded.');
        }

        $hash = hash('sha256', hash('sha256', $raw, true), true);
        $txid = bin2hex(strrev($hash));

        return new self($rawHex, $txid, $sizeBytes);
    }
}
