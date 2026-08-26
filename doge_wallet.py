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
import struct
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


# RIPEMD-160 permutation/rotation tables.
_R = (
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8,
    3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12,
    1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2,
    4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13,
)

_R_PRIME = (
    5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12,
    6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2,
    15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13,
    8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14,
    12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11,
)

_S = (
    11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8,
    7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12,
    11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5,
    11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12,
    9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6,
)

_S_PRIME = (
    8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6,
    9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11,
    9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5,
    15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8,
    8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11,
)


def _rol32(value: int, bits: int) -> int:
    return ((value << bits) | (value >> (32 - bits))) & 0xFFFFFFFF


def _ripemd_f(round_index: int, x: int, y: int, z: int) -> int:
    if round_index < 16:
        return x ^ y ^ z
    if round_index < 32:
        return (x & y) | (~x & z)
    if round_index < 48:
        return (x | ~y) ^ z
    if round_index < 64:
        return (x & z) | (y & ~z)
    return x ^ (y | ~z)


def _ripemd_k(round_index: int) -> int:
    if round_index < 16:
        return 0x00000000
    if round_index < 32:
        return 0x5A827999
    if round_index < 48:
        return 0x6ED9EBA1
    if round_index < 64:
        return 0x8F1BBCDC
    return 0xA953FD4E


def _ripemd_k_prime(round_index: int) -> int:
    if round_index < 16:
        return 0x50A28BE6
    if round_index < 32:
        return 0x5C4DD124
    if round_index < 48:
        return 0x6D703EF3
    if round_index < 64:
        return 0x7A6D76E9
    return 0x00000000


def ripemd160_python(data: bytes) -> bytes:
    """Pure-Python RIPEMD-160 fallback for builds where OpenSSL omits it."""
    message = bytearray(data)
    bit_length = len(message) * 8

    message.append(0x80)
    while len(message) % 64 != 56:
        message.append(0)

    message.extend(struct.pack("<Q", bit_length))

    h0 = 0x67452301
    h1 = 0xEFCDAB89
    h2 = 0x98BADCFE
    h3 = 0x10325476
    h4 = 0xC3D2E1F0

    for offset in range(0, len(message), 64):
        words = struct.unpack("<16I", message[offset:offset + 64])

        a, b, c, d, e = h0, h1, h2, h3, h4
        ap, bp, cp, dp, ep = h0, h1, h2, h3, h4

        for j in range(80):
            t = (
                _rol32(
                    (
                        a
                        + _ripemd_f(j, b, c, d)
                        + words[_R[j]]
                        + _ripemd_k(j)
                    )
                    & 0xFFFFFFFF,
                    _S[j],
                )
                + e
            ) & 0xFFFFFFFF

            a, e, d, c, b = e, d, _rol32(c, 10), b, t

            tp = (
                _rol32(
                    (
                        ap
                        + _ripemd_f(79 - j, bp, cp, dp)
                        + words[_R_PRIME[j]]
                        + _ripemd_k_prime(j)
                    )
                    & 0xFFFFFFFF,
                    _S_PRIME[j],
                )
                + ep
            ) & 0xFFFFFFFF

            ap, ep, dp, cp, bp = ep, dp, _rol32(cp, 10), bp, tp

        t = (h1 + c + dp) & 0xFFFFFFFF
        h1 = (h2 + d + ep) & 0xFFFFFFFF
        h2 = (h3 + e + ap) & 0xFFFFFFFF
        h3 = (h4 + a + bp) & 0xFFFFFFFF
        h4 = (h0 + b + cp) & 0xFFFFFFFF
        h0 = t

    return struct.pack("<5I", h0, h1, h2, h3, h4)


def ripemd160(data: bytes) -> bytes:
    """Use OpenSSL RIPEMD-160 when available, otherwise the local fallback."""
    try:
        return hashlib.new("ripemd160", data).digest()
    except (ValueError, TypeError):
        return ripemd160_python(data)


def hash160(data: bytes) -> bytes:
    """SHA-256 followed by RIPEMD-160."""
    return ripemd160(sha256(data))


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
    Verify RIPEMD-160 and a deterministic Dogecoin vector.

    Never use the test private key for real funds.
    """
    assert ripemd160_python(b"").hex() == (
        "9c1185a5c5e9fc54612808977ee8f548b2258d31"
    )
    assert ripemd160_python(b"abc").hex() == (
        "8eb208f7e05d987a9b044a8e98c6b087f15a0bfc"
    )

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
        help="run deterministic RIPEMD-160/address tests and exit",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        if args.self_test:
            self_test()
        else:
            print_wallet(generate_wallet())
    except (RuntimeError, ValueError, AssertionError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
