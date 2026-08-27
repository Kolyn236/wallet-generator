#!/usr/bin/env python3
"""Fetch Dogecoin address balances and confirmed UTXOs using only a public address."""

from __future__ import annotations

from dataclasses import dataclass
import json
import urllib.error
import urllib.parse
import urllib.request

ENDPOINT = "https://api.blockcypher.com/v1/doge/main/addrs/{address}"


@dataclass(frozen=True)
class Utxo:
    txid: str
    vout: int
    value: int
    confirmations: int


@dataclass(frozen=True)
class AddressUtxos:
    address: str
    balance: int
    unconfirmed_balance: int
    final_balance: int
    utxos: tuple[Utxo, ...]


def _parse_utxo(ref: object) -> Utxo | None:
    if not isinstance(ref, dict):
        return None
    if ref.get("spent") is True:
        return None

    txid = ref.get("tx_hash")
    vout = ref.get("tx_output_n")
    value = ref.get("value")
    confirmations = ref.get("confirmations", 0)

    if not isinstance(txid, str) or len(txid) != 64:
        return None
    if not isinstance(vout, int) or vout < 0:
        return None
    if not isinstance(value, int) or value <= 0:
        return None
    if not isinstance(confirmations, int) or confirmations < 1:
        return None

    return Utxo(txid=txid, vout=vout, value=value, confirmations=confirmations)


def parse_address_response(payload: object, expected_address: str) -> AddressUtxos:
    if not isinstance(payload, dict):
        raise RuntimeError("BlockCypher returned an invalid address response.")

    address = payload.get("address")
    if address != expected_address:
        raise RuntimeError("BlockCypher returned an unexpected address.")

    if payload.get("hasMore") is True:
        raise RuntimeError(
            "BlockCypher returned a partial UTXO list; automatic selection is disabled for safety."
        )

    balance = payload.get("balance", 0)
    if not isinstance(balance, int) or balance < 0:
        raise RuntimeError("BlockCypher returned an invalid confirmed balance.")

    unconfirmed_balance = payload.get("unconfirmed_balance", 0)
    if not isinstance(unconfirmed_balance, int):
        raise RuntimeError("BlockCypher returned an invalid unconfirmed balance.")

    final_balance = payload.get("final_balance", balance + unconfirmed_balance)
    if not isinstance(final_balance, int) or final_balance < 0:
        raise RuntimeError("BlockCypher returned an invalid final balance.")
    if final_balance != balance + unconfirmed_balance:
        raise RuntimeError("BlockCypher returned inconsistent balance totals.")

    refs = payload.get("txrefs") or []
    if not isinstance(refs, list):
        raise RuntimeError("BlockCypher returned an invalid UTXO list.")

    utxos = tuple(
        sorted(
            (utxo for ref in refs if (utxo := _parse_utxo(ref)) is not None),
            key=lambda item: (item.value, -item.confirmations, item.txid, item.vout),
        )
    )
    return AddressUtxos(
        address=address,
        balance=balance,
        unconfirmed_balance=unconfirmed_balance,
        final_balance=final_balance,
        utxos=utxos,
    )


def fetch_confirmed_utxos(address: str, token: str | None = None) -> AddressUtxos:
    params: dict[str, str | int] = {
        "unspentOnly": "true",
        "confirmations": 1,
        "limit": 2000,
    }
    if token:
        params["token"] = token

    endpoint = ENDPOINT.format(address=urllib.parse.quote(address, safe=""))
    endpoint += "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(
        endpoint,
        headers={
            "Accept": "application/json",
            "User-Agent": "doge-wallet-generator/0.5",
        },
        method="GET",
    )

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            text = response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"BlockCypher HTTP {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"BlockCypher request failed: {exc.reason}") from exc

    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        raise RuntimeError("BlockCypher returned invalid JSON.") from exc

    return parse_address_response(payload, address)


def self_test() -> None:
    payload = {
        "address": "DExample",
        "balance": 900,
        "unconfirmed_balance": 125,
        "final_balance": 1025,
        "txrefs": [
            {"tx_hash": "22" * 32, "tx_output_n": 1, "value": 600, "confirmations": 2, "spent": False},
            {"tx_hash": "11" * 32, "tx_output_n": 0, "value": 300, "confirmations": 5, "spent": False},
            {"tx_hash": "33" * 32, "tx_output_n": 0, "value": 100, "confirmations": 0, "spent": False},
        ],
    }
    result = parse_address_response(payload, "DExample")
    assert result.balance == 900
    assert result.unconfirmed_balance == 125
    assert result.final_balance == 1025
    assert [item.value for item in result.utxos] == [300, 600]
    assert result.utxos[0].txid == "11" * 32

    payload_without_pending = {
        "address": "DExample",
        "balance": 900,
        "txrefs": [],
    }
    no_pending = parse_address_response(payload_without_pending, "DExample")
    assert no_pending.unconfirmed_balance == 0
    assert no_pending.final_balance == 900
    print("BlockCypher UTXO parser self-test passed.")


if __name__ == "__main__":
    self_test()
