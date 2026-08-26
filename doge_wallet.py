#!/usr/bin/env python3
"""
Educational Dogecoin mainnet wallet generator.

Generates a secp256k1 private key locally, derives the compressed public key,
encodes a Dogecoin P2PKH address, and exports the private key in compressed WIF.

No network requests and no third-party Python packages are used.
"""

from __future__ import annotations

import argparse
import hashlib
import secrets
import sys
from dataclasses import dataclass

# secp256k1 domain parameters.
P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
GX = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798
GY = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8
G = (GX, GY)

# Dogecoin mainnet Base58Check version bytes from Dogecoin Core chainparams.
DOGE_P2PKH_PREFIX = 0x1E
DOGE_WIF_PREFIX = 0x9E

BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

Point = tuple[int, int] | None


@dataclass(frozen=True)
class Wallet:
    private_key: int
    public_key_compressed: bytes
    address: str
    wif: str


def sha256(data: bytes) -> bytes:
    return hashlib.sha256(data).digest()


def double_sha256(data: bytes) -> bytes:
    return sha256(sha256(data))


def hash160(data: bytes) -> bytes:
    """SHA-256 followed by RIPEMD-160."""
    digest = sha256(data)
    try:
        return hashlib.new("ripemd160", digest).digest()
    except ValueError as exc:
        raise RuntimeError(
            "RIPEMD-160 is not available in this Python/OpenSSL build."
        ) from exc


def base58_encode(data: bytes) -> str:
    """Encode bytes using the Bitcoin/Dogecoin Base58 alphabet."""
    number = int.from_bytes(data, byteorder="big")
    encoded = ""

    while number:
        number, remainder = divmod(number, 58)
        encoded = BASE58_ALPHABET[remainder] + encoded

    leading_zeroes = len(data) - len(data.lstrip(b"\x00"))
    return ("1" * leading_zeroes) + (encoded or "")


def base58check(payload: bytes) -> str:
    """Base58Check = payload + first 4 bytes of double-SHA256(payload)."""
    checksum = double_sha256(payload)[:4]
    return base58_encode(payload + checksum)


def mod_inverse(value: int) -> int:
    """Multiplicative inverse modulo the secp256k1 field prime."""
    return pow(value, P - 2, P)


def point_add(left: Point, right: Point) -> Point:
    """Add two points on y^2 = x^3 + 7 over the secp256k1 finite field."""
    if left is None:
        return right
    if right is None:
        return left

    x1, y1 = left
    x2, y2 = right

    if x1 == x2 and (y1 + y2) % P == 0:
        return None

    if left == right:
        slope = (3 * x1 * x1) * mod_inverse(2 * y1 % P) % P
    else:
        slope = (y2 - y1) * mod_inverse((x2 - x1) % P) % P

    x3 = (slope * slope - x1 - x2) % P
    y3 = (slope * (x1 - x3) - y1) % P
    return x3, y3


def scalar_multiply(scalar: int, point: Point = G) -> Point:
    """Double-and-add scalar multiplication on secp256k1."""
    if not 1 <= scalar < N:
        raise ValueError("Private key must be in the range 1..n-1.")

    result: Point = None
    addend = point
    value = scalar

    while value:
        if value & 1:
            result = point_add(result, addend)
        addend = point_add(addend, addend)
        value >>= 1

    return result


def compressed_public_key(private_key: int) -> bytes:
    point = scalar_multiply(private_key)
    if point is None:
        raise RuntimeError("Unexpected point at infinity.")

    x, y = point
    prefix = b"\x02" if y % 2 == 0 else b"\x03"
    return prefix + x.to_bytes(32, byteorder="big")


def public_key_to_address(public_key: bytes) -> str:
    payload = bytes([DOGE_P2PKH_PREFIX]) + hash160(public_key)
    return base58check(payload)


def private_key_to_wif(private_key: int) -> str:
    # Trailing 0x01 means the corresponding public key is compressed.
    payload = (
        bytes([DOGE_WIF_PREFIX])
        + private_key.to_bytes(32, byteorder="big")
        + b"\x01"
    )
    return base58check(payload)


def wallet_from_private_key(private_key: int) -> Wallet:
    public_key = compressed_public_key(private_key)
    return Wallet(
        private_key=private_key,
        public_key_compressed=public_key,
        address=public_key_to_address(public_key),
        wif=private_key_to_wif(private_key),
    )


def generate_wallet() -> Wallet:
    private_key = secrets.randbelow(N - 1) + 1
    return wallet_from_private_key(private_key)


def self_test() -> None:
    """
    Deterministic vector for private key = 1.

    Never use this test key for real funds.
    """
    wallet = wallet_from_private_key(1)

    expected_public_key = (
        "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798"
    )
    expected_address = "DFpN6QqFfUm3gKNaxN6tNcab1FArL9cZLE"
    expected_wif = "QNcdLVw8fHkixm6NNyN6nVwxKek4u7qrioRbQmjxac5TVoTtZuot"

    assert wallet.public_key_compressed.hex() == expected_public_key
    assert wallet.address == expected_address
    assert wallet.wif == expected_wif

    print("Self-test passed.")


def print_wallet(wallet: Wallet) -> None:
    print("Dogecoin mainnet wallet generated locally.")
    print()
    print(f"Private key (hex): {wallet.private_key:064x}")
    print(f"Private key (WIF): {wallet.wif}")
    print(f"Public key:        {wallet.public_key_compressed.hex()}")
    print(f"DOGE address:      {wallet.address}")
    print()
    print("WARNING:")
    print("- Anyone who gets the private key or WIF can spend the DOGE.")
    print("- Do not paste private keys into chats, websites, screenshots, or Git.")
    print("- Back up the WIF securely before sending real funds to this address.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a Dogecoin mainnet P2PKH wallet locally."
    )
    parser.add_argument(
        "--self-test",
        action="store_true",
        help="run a deterministic derivation test and exit",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        if args.self_test:
            self_test()
        else:
            print_wallet(generate_wallet())
    except (RuntimeError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
