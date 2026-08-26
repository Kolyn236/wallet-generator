#!/usr/bin/env python3
"""
Build a Child-Pays-For-Parent (CPFP) Dogecoin transaction locally.

The child spends an unconfirmed P2PKH output controlled by the same wallet and
pays enough fee so that parent + child together reach a requested package fee
rate. Nothing is broadcast by this script.
"""

from __future__ import annotations

import argparse
import getpass
import math
import sys
from decimal import Decimal

from doge_wallet import (
    KOINU_PER_DOGE,
    RECOMMENDED_FEE_RATE_KOINU_PER_KB,
    SOFT_DUST_KOINU,
    TxOutput,
    doge_to_koinu,
    double_sha256,
    format_doge,
    p2pkh_script_pubkey,
    sign_p2pkh_transaction,
    wallet_from_wif,
)


def load_wif(path: str | None) -> str:
    if path:
        with open(path, "r", encoding="utf-8") as handle:
            return handle.read().strip()
    return getpass.getpass("Source wallet WIF (hidden): ").strip()


def build_cpfp(
    *,
    wif: str,
    source_address: str,
    parent_txid: str,
    parent_vout: int,
    parent_utxo_value: int,
    parent_fee: int,
    parent_size: int,
    destination_address: str,
    target_package_rate: int,
) -> tuple[bytes, int, int, int, Decimal]:
    if parent_size <= 0:
        raise ValueError("Parent size must be greater than zero.")
    if parent_utxo_value <= 0:
        raise ValueError("Parent UTXO amount must be greater than zero.")
    if parent_fee < 0:
        raise ValueError("Parent fee cannot be negative.")
    if target_package_rate <= 0:
        raise ValueError("Target package fee rate must be greater than zero.")

    wallet = wallet_from_wif(wif)
    if wallet.address != source_address:
        raise ValueError(
            "The WIF does not match --source. "
            f"WIF derives {wallet.address}."
        )

    destination_script = p2pkh_script_pubkey(destination_address)

    # Fee only moves upward. Signature DER length can change by a byte when the
    # output value changes, so this monotonic loop avoids oscillation and may
    # intentionally overpay by a tiny amount.
    child_fee = 0
    raw = b""
    child_size = 0

    for _ in range(16):
        output_value = parent_utxo_value - child_fee
        if output_value < SOFT_DUST_KOINU:
            raise ValueError("CPFP fee would leave an output below 0.01 DOGE.")

        outputs = [TxOutput(output_value, destination_script)]
        raw, _, _ = sign_p2pkh_transaction(
            wallet.private_key,
            parent_txid,
            parent_vout,
            outputs,
        )
        child_size = len(raw)

        package_size = parent_size + child_size
        target_total_fee = math.ceil(package_size * target_package_rate / 1000)
        child_min_fee = math.ceil(
            child_size * RECOMMENDED_FEE_RATE_KOINU_PER_KB / 1000
        )
        required_child_fee = max(
            child_min_fee,
            target_total_fee - parent_fee,
            0,
        )

        if required_child_fee <= child_fee:
            break
        child_fee = required_child_fee
    else:
        raise RuntimeError("CPFP fee calculation did not converge.")

    # Build one final time with the settled fee.
    output_value = parent_utxo_value - child_fee
    outputs = [TxOutput(output_value, destination_script)]
    raw, _, _ = sign_p2pkh_transaction(
        wallet.private_key,
        parent_txid,
        parent_vout,
        outputs,
    )
    child_size = len(raw)
    package_size = parent_size + child_size
    package_fee = parent_fee + child_fee
    package_rate_doge_per_kb = (
        Decimal(package_fee) * Decimal(1000)
        / Decimal(package_size)
        / Decimal(KOINU_PER_DOGE)
    )

    if package_fee * 1000 < target_package_rate * package_size:
        raise RuntimeError("Final package fee rate is below the requested target.")

    return raw, child_fee, output_value, child_size, package_rate_doge_per_kb


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build a local Dogecoin CPFP child transaction."
    )
    parser.add_argument("--source", required=True, help="address owning the parent output")
    parser.add_argument("--parent-txid", required=True, help="unconfirmed parent transaction id")
    parser.add_argument("--parent-vout", type=int, required=True, help="parent output index to spend")
    parser.add_argument("--parent-utxo-amount", required=True, help="parent output amount in DOGE")
    parser.add_argument("--parent-fee", required=True, help="parent transaction fee in DOGE")
    parser.add_argument("--parent-size", type=int, required=True, help="parent serialized size in bytes")
    parser.add_argument(
        "--to",
        help="child destination; defaults to --source (send the change back to yourself)",
    )
    parser.add_argument(
        "--target-package-rate",
        default="0.80",
        help="target fee rate for parent+child in DOGE/kB; default: 0.80",
    )
    parser.add_argument("--out", default="cpfp.tx", help="raw child tx output file")
    parser.add_argument("--wif-file", help="read source WIF from a local file")
    args = parser.parse_args()

    try:
        destination = args.to or args.source
        wif = load_wif(args.wif_file)
        raw, child_fee, output_value, child_size, package_rate = build_cpfp(
            wif=wif,
            source_address=args.source,
            parent_txid=args.parent_txid,
            parent_vout=args.parent_vout,
            parent_utxo_value=doge_to_koinu(args.parent_utxo_amount),
            parent_fee=doge_to_koinu(args.parent_fee),
            parent_size=args.parent_size,
            destination_address=destination,
            target_package_rate=doge_to_koinu(args.target_package_rate),
        )

        txid = double_sha256(raw)[::-1].hex()
        with open(args.out, "w", encoding="utf-8") as handle:
            handle.write(raw.hex() + "\n")

        print("CPFP child transaction created locally.")
        print()
        print(f"Parent:              {args.parent_txid}:{args.parent_vout}")
        print(f"Parent output:       {args.parent_utxo_amount} DOGE")
        print(f"Child destination:   {destination}")
        print(f"Child output:        {format_doge(output_value)} DOGE")
        print(f"Child fee:           {format_doge(child_fee)} DOGE")
        print(f"Child size:          {child_size} bytes")
        print(f"Package target:      {args.target_package_rate} DOGE/kB")
        print(f"Actual package rate: {package_rate:.8f} DOGE/kB")
        print(f"Child TXID:          {txid}")
        print(f"Raw tx saved:        {args.out}")
        print()
        print("NOT BROADCAST.")
        print("Review the child fee and destination before broadcasting.")
        return 0
    except (RuntimeError, ValueError, OSError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
