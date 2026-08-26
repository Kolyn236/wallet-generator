#!/usr/bin/env python3
"""Broadcast an already-signed Dogecoin raw transaction via Blockchair."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import urllib.error
import urllib.parse
import urllib.request

ENDPOINT = "https://api.blockchair.com/dogecoin/push/transaction"


def double_sha256(data: bytes) -> bytes:
    return hashlib.sha256(hashlib.sha256(data).digest()).digest()


def read_raw_tx(path: str) -> tuple[str, bytes]:
    with open(path, "r", encoding="utf-8") as handle:
        raw_hex = "".join(handle.read().split())

    try:
        raw = bytes.fromhex(raw_hex)
    except ValueError as exc:
        raise ValueError("Raw transaction file must contain hexadecimal data.") from exc

    if not raw:
        raise ValueError("Raw transaction is empty.")

    return raw.hex(), raw


def broadcast(raw_hex: str) -> dict:
    body = urllib.parse.urlencode({"data": raw_hex}).encode("ascii")
    request = urllib.request.Request(
        ENDPOINT,
        data=body,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "doge-wallet-generator/0.1",
            "Accept": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            text = response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Blockchair HTTP {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Blockchair request failed: {exc.reason}") from exc

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"raw_response": text}


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Broadcast an already-signed Dogecoin transaction via Blockchair."
    )
    parser.add_argument("raw_file", help="file containing signed raw transaction hex")
    parser.add_argument(
        "--yes",
        action="store_true",
        help="required acknowledgement that broadcasting is irreversible",
    )
    args = parser.parse_args()

    try:
        if not args.yes:
            raise ValueError("Re-run with --yes after reviewing the signed transaction.")

        raw_hex, raw = read_raw_tx(args.raw_file)
        txid = double_sha256(raw)[::-1].hex()

        print(f"Local TXID: {txid}")
        print("Broadcasting signed public transaction via Blockchair...")
        result = broadcast(raw_hex)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        print(f"Expected TXID: {txid}")
        return 0
    except (RuntimeError, ValueError, OSError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
