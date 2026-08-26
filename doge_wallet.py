#!/usr/bin/env python3
"""
Educational Dogecoin mainnet wallet + raw P2PKH transaction tool.

The private key and transaction signature are created locally. No third-party
Python packages are required. Network access is only used by explicit broadcast
commands.
"""

from __future__ import annotations

import argparse
import getpass
import hashlib
import hmac
import json
import math
import secrets
import struct
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation, ROUND_DOWN

# secp256k1 domain parameters.
P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
GX = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798
GY = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8
G = (GX, GY)

# Dogecoin mainnet Base58Check version bytes from Dogecoin Core chainparams.
DOGE_P2PKH_PREFIX = 0x1E
DOGE_WIF_PREFIX = 0x9E

KOINU_PER_DOGE = 100_000_000
RECOMMENDED_FEE_RATE_KOINU_PER_KB = 1_000_000  # 0.01 DOGE/kB.
SOFT_DUST_KOINU = 1_000_000  # 0.01 DOGE.
SIGHASH_ALL = 0x01

BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
BASE58_INDEX = {char: index for index, char in enumerate(BASE58_ALPHABET)}

Point = tuple[int, int] | None


@dataclass(frozen=True)
class Wallet:
    private_key: int
    public_key_compressed: bytes
    address: str
    wif: str


@dataclass(frozen=True)
class TxOutput:
    value: int
    script_pubkey: bytes


@dataclass(frozen=True)
class BuiltTransaction:
    raw: bytes
    txid: str
    size: int
    fee: int
    sent: int
    change: int
    source_address: str
    destination_address: str
    change_address: str | None


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
    number = int.from_bytes(data, byteorder="big")
    encoded = ""

    while number:
        number, remainder = divmod(number, 58)
        encoded = BASE58_ALPHABET[remainder] + encoded

    leading_zeroes = len(data) - len(data.lstrip(b"\x00"))
    return ("1" * leading_zeroes) + encoded


def base58_decode(text: str) -> bytes:
    if not text:
        raise ValueError("Base58 value cannot be empty.")

    number = 0
    for char in text:
        try:
            digit = BASE58_INDEX[char]
        except KeyError as exc:
            raise ValueError(f"Invalid Base58 character: {char!r}") from exc
        number = number * 58 + digit

    body = b"" if number == 0 else number.to_bytes((number.bit_length() + 7) // 8, "big")
    leading_zeroes = len(text) - len(text.lstrip("1"))
    return (b"\x00" * leading_zeroes) + body


def base58check(payload: bytes) -> str:
    checksum = double_sha256(payload)[:4]
    return base58_encode(payload + checksum)


def base58check_decode(text: str) -> bytes:
    decoded = base58_decode(text)
    if len(decoded) < 5:
        raise ValueError("Base58Check value is too short.")

    payload, checksum = decoded[:-4], decoded[-4:]
    expected = double_sha256(payload)[:4]
    if not hmac.compare_digest(checksum, expected):
        raise ValueError("Invalid Base58Check checksum.")
    return payload


def mod_inverse_field(value: int) -> int:
    return pow(value, P - 2, P)


def point_add(left: Point, right: Point) -> Point:
    if left is None:
        return right
    if right is None:
        return left

    x1, y1 = left
    x2, y2 = right

    if x1 == x2 and (y1 + y2) % P == 0:
        return None

    if left == right:
        if y1 == 0:
            return None
        slope = (3 * x1 * x1) * mod_inverse_field(2 * y1 % P) % P
    else:
        slope = (y2 - y1) * mod_inverse_field((x2 - x1) % P) % P

    x3 = (slope * slope - x1 - x2) % P
    y3 = (slope * (x1 - x3) - y1) % P
    return x3, y3


def scalar_multiply(scalar: int, point: Point = G) -> Point:
    if not 1 <= scalar < N:
        raise ValueError("Scalar must be in the range 1..n-1.")

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
    payload = (
        bytes([DOGE_WIF_PREFIX])
        + private_key.to_bytes(32, byteorder="big")
        + b"\x01"
    )
    return base58check(payload)


def wif_to_private_key(wif: str) -> int:
    payload = base58check_decode(wif.strip())
    if len(payload) != 34:
        raise ValueError("Only compressed Dogecoin mainnet WIF keys are supported.")
    if payload[0] != DOGE_WIF_PREFIX:
        raise ValueError("WIF is not a Dogecoin mainnet private key.")
    if payload[-1] != 0x01:
        raise ValueError("Only compressed WIF keys are supported.")

    private_key = int.from_bytes(payload[1:33], "big")
    if not 1 <= private_key < N:
        raise ValueError("WIF contains an invalid secp256k1 private key.")
    return private_key


def wallet_from_private_key(private_key: int) -> Wallet:
    public_key = compressed_public_key(private_key)
    return Wallet(
        private_key=private_key,
        public_key_compressed=public_key,
        address=public_key_to_address(public_key),
        wif=private_key_to_wif(private_key),
    )


def wallet_from_wif(wif: str) -> Wallet:
    return wallet_from_private_key(wif_to_private_key(wif))


def generate_wallet() -> Wallet:
    private_key = secrets.randbelow(N - 1) + 1
    return wallet_from_private_key(private_key)


def doge_to_koinu(value: str | Decimal) -> int:
    try:
        amount = Decimal(value)
    except InvalidOperation as exc:
        raise ValueError(f"Invalid DOGE amount: {value!r}") from exc

    if not amount.is_finite() or amount < 0:
        raise ValueError("DOGE amount must be a non-negative finite number.")

    quantized = amount.quantize(Decimal("0.00000001"), rounding=ROUND_DOWN)
    if quantized != amount:
        raise ValueError("DOGE supports at most 8 decimal places.")
    return int(quantized * KOINU_PER_DOGE)


def format_doge(koinu: int) -> str:
    sign = "-" if koinu < 0 else ""
    value = abs(koinu)
    whole, fraction = divmod(value, KOINU_PER_DOGE)
    return f"{sign}{whole}.{fraction:08d}"


def address_to_pubkey_hash(address: str) -> bytes:
    payload = base58check_decode(address.strip())
    if len(payload) != 21:
        raise ValueError("Expected a legacy Dogecoin P2PKH address.")
    if payload[0] != DOGE_P2PKH_PREFIX:
        raise ValueError("Address is not a Dogecoin mainnet P2PKH address.")
    return payload[1:]


def p2pkh_script_pubkey(address: str) -> bytes:
    pubkey_hash = address_to_pubkey_hash(address)
    return b"\x76\xa9\x14" + pubkey_hash + b"\x88\xac"


def encode_varint(value: int) -> bytes:
    if value < 0:
        raise ValueError("Varint cannot be negative.")
    if value < 0xFD:
        return bytes([value])
    if value <= 0xFFFF:
        return b"\xfd" + struct.pack("<H", value)
    if value <= 0xFFFFFFFF:
        return b"\xfe" + struct.pack("<I", value)
    if value <= 0xFFFFFFFFFFFFFFFF:
        return b"\xff" + struct.pack("<Q", value)
    raise ValueError("Varint is too large.")


def push_data(data: bytes) -> bytes:
    length = len(data)
    if length < 0x4C:
        return bytes([length]) + data
    if length <= 0xFF:
        return b"\x4c" + bytes([length]) + data
    if length <= 0xFFFF:
        return b"\x4d" + struct.pack("<H", length) + data
    raise ValueError("Pushdata is too large for this educational tool.")


def serialize_input(prev_txid: str, vout: int, script_sig: bytes, sequence: int = 0xFFFFFFFF) -> bytes:
    try:
        txid_bytes = bytes.fromhex(prev_txid)
    except ValueError as exc:
        raise ValueError("UTXO txid must be 64 hexadecimal characters.") from exc
    if len(txid_bytes) != 32:
        raise ValueError("UTXO txid must be exactly 32 bytes / 64 hex characters.")
    if not 0 <= vout <= 0xFFFFFFFF:
        raise ValueError("UTXO vout is outside uint32 range.")
    if not 0 <= sequence <= 0xFFFFFFFF:
        raise ValueError("Sequence is outside uint32 range.")

    return (
        txid_bytes[::-1]
        + struct.pack("<I", vout)
        + encode_varint(len(script_sig))
        + script_sig
        + struct.pack("<I", sequence)
    )


def serialize_output(output: TxOutput) -> bytes:
    if not 0 <= output.value <= 0x7FFFFFFFFFFFFFFF:
        raise ValueError("Output value is outside int64 range.")
    return (
        struct.pack("<Q", output.value)
        + encode_varint(len(output.script_pubkey))
        + output.script_pubkey
    )


def serialize_transaction(
    prev_txid: str,
    vout: int,
    script_sig: bytes,
    outputs: list[TxOutput],
    *,
    version: int = 1,
    locktime: int = 0,
    sequence: int = 0xFFFFFFFF,
) -> bytes:
    return (
        struct.pack("<I", version)
        + encode_varint(1)
        + serialize_input(prev_txid, vout, script_sig, sequence)
        + encode_varint(len(outputs))
        + b"".join(serialize_output(output) for output in outputs)
        + struct.pack("<I", locktime)
    )


def deterministic_k(private_key: int, message_hash: bytes) -> int:
    """RFC6979 deterministic nonce generation with HMAC-SHA256."""
    if len(message_hash) != 32:
        raise ValueError("ECDSA message hash must be exactly 32 bytes.")

    x = private_key.to_bytes(32, "big")
    h1 = (int.from_bytes(message_hash, "big") % N).to_bytes(32, "big")

    v = b"\x01" * 32
    k = b"\x00" * 32

    k = hmac.new(k, v + b"\x00" + x + h1, hashlib.sha256).digest()
    v = hmac.new(k, v, hashlib.sha256).digest()
    k = hmac.new(k, v + b"\x01" + x + h1, hashlib.sha256).digest()
    v = hmac.new(k, v, hashlib.sha256).digest()

    while True:
        v = hmac.new(k, v, hashlib.sha256).digest()
        candidate = int.from_bytes(v, "big")
        if 1 <= candidate < N:
            return candidate
        k = hmac.new(k, v + b"\x00", hashlib.sha256).digest()
        v = hmac.new(k, v, hashlib.sha256).digest()


def der_integer(value: int) -> bytes:
    if value <= 0:
        raise ValueError("DER integer must be positive.")
    raw = value.to_bytes((value.bit_length() + 7) // 8, "big")
    if raw[0] & 0x80:
        raw = b"\x00" + raw
    return b"\x02" + bytes([len(raw)]) + raw


def der_signature(r: int, s: int) -> bytes:
    body = der_integer(r) + der_integer(s)
    return b"\x30" + bytes([len(body)]) + body


def ecdsa_sign(private_key: int, message_hash: bytes) -> tuple[int, int]:
    z = int.from_bytes(message_hash, "big")
    nonce = deterministic_k(private_key, message_hash)

    point = scalar_multiply(nonce)
    if point is None:
        raise RuntimeError("ECDSA nonce produced point at infinity.")

    r = point[0] % N
    if r == 0:
        raise RuntimeError("ECDSA produced r=0.")

    s = (pow(nonce, -1, N) * (z + r * private_key)) % N
    if s == 0:
        raise RuntimeError("ECDSA produced s=0.")

    # Standard low-S form.
    if s > N // 2:
        s = N - s
    return r, s


def ecdsa_verify(public_key_point: Point, message_hash: bytes, r: int, s: int) -> bool:
    """Small self-test verifier; transaction creation does not depend on it."""
    if public_key_point is None or not (1 <= r < N and 1 <= s < N):
        return False

    z = int.from_bytes(message_hash, "big")
    w = pow(s, -1, N)
    u1 = (z * w) % N
    u2 = (r * w) % N
    point = point_add(scalar_multiply(u1), scalar_multiply(u2, public_key_point))
    return point is not None and point[0] % N == r


def signature_hash(
    prev_txid: str,
    vout: int,
    prev_script_pubkey: bytes,
    outputs: list[TxOutput],
) -> bytes:
    unsigned = serialize_transaction(
        prev_txid,
        vout,
        prev_script_pubkey,
        outputs,
    )
    return double_sha256(unsigned + struct.pack("<I", SIGHASH_ALL))


def sign_p2pkh_transaction(
    private_key: int,
    prev_txid: str,
    vout: int,
    outputs: list[TxOutput],
) -> tuple[bytes, bytes, tuple[int, int]]:
    public_key = compressed_public_key(private_key)
    source_address = public_key_to_address(public_key)
    prev_script_pubkey = p2pkh_script_pubkey(source_address)

    digest = signature_hash(prev_txid, vout, prev_script_pubkey, outputs)
    r, s = ecdsa_sign(private_key, digest)
    signature = der_signature(r, s) + bytes([SIGHASH_ALL])
    script_sig = push_data(signature) + push_data(public_key)

    raw = serialize_transaction(prev_txid, vout, script_sig, outputs)
    return raw, digest, (r, s)


def build_signed_transaction(
    *,
    private_key: int,
    source_address: str,
    prev_txid: str,
    vout: int,
    input_value: int,
    destination_address: str,
    send_value: int,
    fee_rate_koinu_per_kb: int = RECOMMENDED_FEE_RATE_KOINU_PER_KB,
    change_address: str | None = None,
) -> BuiltTransaction:
    if input_value <= 0:
        raise ValueError("UTXO amount must be greater than zero.")
    if send_value <= 0:
        raise ValueError("Send amount must be greater than zero.")
    if send_value < SOFT_DUST_KOINU:
        raise ValueError("Send amount is below 0.01 DOGE; this tool avoids soft-dust outputs.")
    if fee_rate_koinu_per_kb <= 0:
        raise ValueError("Fee rate must be greater than zero.")

    wallet = wallet_from_private_key(private_key)
    if wallet.address != source_address:
        raise ValueError(
            "The WIF/private key does not match --source. "
            f"WIF derives {wallet.address}."
        )

    # Validate addresses before any signing.
    p2pkh_script_pubkey(source_address)
    destination_script = p2pkh_script_pubkey(destination_address)
    if change_address is None:
        change_address = source_address
    change_script = p2pkh_script_pubkey(change_address)

    if send_value >= input_value:
        raise ValueError("Send amount must leave room for the network fee.")

    # Iterate because exact DER signature length changes the exact tx byte size,
    # and Dogecoin's recommended fee is calculated over exact transaction size.
    fee = 0

    for _ in range(8):
        available_change = input_value - send_value - fee
        if available_change < 0:
            raise ValueError("UTXO is too small for send amount plus network fee.")

        outputs = [TxOutput(send_value, destination_script)]
        if available_change >= SOFT_DUST_KOINU:
            outputs.append(TxOutput(available_change, change_script))

        raw, _, _ = sign_p2pkh_transaction(private_key, prev_txid, vout, outputs)
        actual_fee = input_value - sum(output.value for output in outputs)
        recommended_fee = math.ceil(len(raw) * fee_rate_koinu_per_kb / 1000)
        new_fee = max(actual_fee, recommended_fee)

        if new_fee == fee:
            break
        fee = new_fee
    else:
        raise RuntimeError("Fee calculation did not converge.")

    # Rebuild until both exact signed byte size and output amounts agree.
    for _ in range(8):
        available_change = input_value - send_value - fee
        if available_change < 0:
            raise ValueError("UTXO is too small for send amount plus network fee.")

        outputs = [TxOutput(send_value, destination_script)]
        if available_change >= SOFT_DUST_KOINU:
            outputs.append(TxOutput(available_change, change_script))
            final_change = available_change
            final_change_address: str | None = change_address
        else:
            final_change = 0
            final_change_address = None

        raw, _, _ = sign_p2pkh_transaction(private_key, prev_txid, vout, outputs)
        final_fee = input_value - sum(output.value for output in outputs)
        recommended_fee = math.ceil(len(raw) * fee_rate_koinu_per_kb / 1000)

        if final_fee >= recommended_fee:
            break
        fee = recommended_fee
    else:
        raise RuntimeError("Final fee calculation did not converge.")

    txid = double_sha256(raw)[::-1].hex()

    return BuiltTransaction(
        raw=raw,
        txid=txid,
        size=len(raw),
        fee=final_fee,
        sent=send_value,
        change=final_change,
        source_address=source_address,
        destination_address=destination_address,
        change_address=final_change_address,
    )


def read_raw_transaction(path: str | None) -> str:
    if path:
        with open(path, "r", encoding="utf-8") as handle:
            raw_hex = handle.read().strip()
    else:
        raw_hex = sys.stdin.read().strip()

    try:
        raw = bytes.fromhex(raw_hex)
    except ValueError as exc:
        raise ValueError("Raw transaction must be hexadecimal.") from exc

    if not raw:
        raise ValueError("Raw transaction is empty.")
    return raw.hex()


def broadcast_dogechain(raw_hex: str) -> dict:
    """
    Broadcast a signed raw transaction through DogeChain.

    This sends only the already-signed public transaction. The private key/WIF
    never leaves the local machine.
    """
    endpoint = "https://dogechain.info/api/v1/pushtx"
    body = urllib.parse.urlencode({"tx": raw_hex}).encode("ascii")
    request = urllib.request.Request(
        endpoint,
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            text = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"DogeChain HTTP {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"DogeChain request failed: {exc.reason}") from exc

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"raw_response": text}


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


def print_built_transaction(tx: BuiltTransaction, output_path: str | None) -> None:
    print("Signed Dogecoin transaction created locally.")
    print()
    print(f"Source:       {tx.source_address}")
    print(f"Destination:  {tx.destination_address}")
    print(f"Send:         {format_doge(tx.sent)} DOGE")
    print(f"Change:       {format_doge(tx.change)} DOGE")
    if tx.change_address:
        print(f"Change addr:  {tx.change_address}")
    else:
        print("Change addr:  none (small remainder was added to fee)")
    print(f"Network fee:  {format_doge(tx.fee)} DOGE")
    print(f"Size:         {tx.size} bytes")
    print(f"TXID:         {tx.txid}")
    print()
    if output_path:
        print(f"Raw tx saved: {output_path}")
    else:
        print("Raw transaction:")
        print(tx.raw.hex())
    print()
    print("NOT BROADCAST.")
    print("Review the destination, amount, change and fee before broadcasting.")


def self_test() -> None:
    """Verify crypto primitives, wallet vectors and a signed P2PKH transaction."""
    assert ripemd160_python(b"").hex() == "9c1185a5c5e9fc54612808977ee8f548b2258d31"
    assert ripemd160_python(b"abc").hex() == "8eb208f7e05d987a9b044a8e98c6b087f15a0bfc"

    wallet = wallet_from_private_key(1)
    expected_public_key = "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798"
    expected_address = "DFpN6QqFfUm3gKNaxN6tNcab1FArL9cZLE"
    expected_wif = "QNcdLVw8fHkixm6NNyN6nVwxKek4u7qrioRbQmjxac5TVoTtZuot"

    assert wallet.public_key_compressed.hex() == expected_public_key
    assert wallet.address == expected_address
    assert wallet.wif == expected_wif
    assert wallet_from_wif(expected_wif).private_key == 1
    assert address_to_pubkey_hash(expected_address) == hash160(wallet.public_key_compressed)

    # Build a deterministic dummy spend. The referenced txid need not exist:
    # this checks local serialization + signing only.
    destination = wallet_from_private_key(2).address
    outputs = [
        TxOutput(doge_to_koinu("1"), p2pkh_script_pubkey(destination)),
        TxOutput(doge_to_koinu("8.99"), p2pkh_script_pubkey(wallet.address)),
    ]
    dummy_prev_txid = "11" * 32
    raw, digest, (r, s) = sign_p2pkh_transaction(1, dummy_prev_txid, 0, outputs)
    assert len(raw) in (225, 226, 227)
    assert len(double_sha256(raw)) == 32
    assert ecdsa_verify(G, digest, r, s)

    built = build_signed_transaction(
        private_key=1,
        source_address=wallet.address,
        prev_txid=dummy_prev_txid,
        vout=0,
        input_value=doge_to_koinu("10"),
        destination_address=destination,
        send_value=doge_to_koinu("3"),
    )
    assert built.sent == doge_to_koinu("3")
    assert built.change > 0
    assert built.fee >= math.ceil(
        built.size * RECOMMENDED_FEE_RATE_KOINU_PER_KB / 1000
    )
    assert built.sent + built.change + built.fee == doge_to_koinu("10")

    print("Self-test passed.")


def add_build_tx_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--source", required=True, help="source Dogecoin P2PKH address")
    parser.add_argument("--utxo-txid", required=True, help="transaction id containing the UTXO")
    parser.add_argument("--utxo-vout", type=int, required=True, help="UTXO output index")
    parser.add_argument("--utxo-amount", required=True, help="UTXO amount in DOGE")
    parser.add_argument("--to", required=True, help="destination Dogecoin P2PKH address")
    parser.add_argument("--amount", required=True, help="amount to send in DOGE")
    parser.add_argument(
        "--change",
        help="change address; defaults to the source address",
    )
    parser.add_argument(
        "--fee-rate",
        default="0.01",
        help="fee rate in DOGE/kB; default: 0.01",
    )
    parser.add_argument(
        "--out",
        help="write signed raw transaction hex to this file instead of stdout",
    )
    parser.add_argument(
        "--wif-file",
        help="read the source WIF from a local file instead of prompting",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Educational Dogecoin mainnet wallet and P2PKH transaction tool."
    )
    parser.add_argument(
        "--self-test",
        action="store_true",
        help="run deterministic local tests and exit",
    )

    subparsers = parser.add_subparsers(dest="command")

    subparsers.add_parser("generate", help="generate a new local wallet")

    build_parser = subparsers.add_parser(
        "build-tx",
        help="build and sign a one-input P2PKH transaction locally",
    )
    add_build_tx_arguments(build_parser)

    broadcast_parser = subparsers.add_parser(
        "broadcast",
        help="broadcast an already-signed raw transaction",
    )
    broadcast_parser.add_argument(
        "--raw-file",
        help="file containing raw tx hex; if omitted, read from stdin",
    )
    broadcast_parser.add_argument(
        "--provider",
        choices=("dogechain",),
        default="dogechain",
        help="broadcast provider; default: dogechain",
    )
    broadcast_parser.add_argument(
        "--yes",
        action="store_true",
        help="required acknowledgement that the transaction is ready to broadcast",
    )

    return parser.parse_args()


def load_wif(args: argparse.Namespace) -> str:
    if args.wif_file:
        with open(args.wif_file, "r", encoding="utf-8") as handle:
            return handle.read().strip()
    return getpass.getpass("Source wallet WIF (hidden): ").strip()


def main() -> int:
    args = parse_args()

    try:
        if args.self_test:
            self_test()
            return 0

        if args.command in (None, "generate"):
            print_wallet(generate_wallet())
            return 0

        if args.command == "build-tx":
            wif = load_wif(args)
            private_key = wif_to_private_key(wif)
            input_value = doge_to_koinu(args.utxo_amount)
            send_value = doge_to_koinu(args.amount)
            fee_rate = doge_to_koinu(args.fee_rate)

            tx = build_signed_transaction(
                private_key=private_key,
                source_address=args.source,
                prev_txid=args.utxo_txid,
                vout=args.utxo_vout,
                input_value=input_value,
                destination_address=args.to,
                send_value=send_value,
                fee_rate_koinu_per_kb=fee_rate,
                change_address=args.change,
            )

            if args.out:
                with open(args.out, "w", encoding="utf-8") as handle:
                    handle.write(tx.raw.hex() + "\n")
            print_built_transaction(tx, args.out)
            return 0

        if args.command == "broadcast":
            if not args.yes:
                raise ValueError(
                    "Broadcast is irreversible. Re-run with --yes after reviewing the signed transaction."
                )
            raw_hex = read_raw_transaction(args.raw_file)
            result = broadcast_dogechain(raw_hex)
            print(json.dumps(result, indent=2, ensure_ascii=False))
            return 0

        raise RuntimeError(f"Unsupported command: {args.command}")

    except (RuntimeError, ValueError, AssertionError, OSError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
