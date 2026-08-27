#!/usr/bin/env python3
"""Resolve a CPFP parent transaction from BlockCypher using only its TXID."""

from __future__ import annotations

from dataclasses import dataclass
import json
import urllib.error
import urllib.parse
import urllib.request

from doge_wallet import double_sha256, p2pkh_script_pubkey

ENDPOINT = "https://api.blockcypher.com/v1/doge/main/txs/{txid}"


@dataclass(frozen=True)
class ParsedOutput:
    vout: int
    value: int
    script: bytes


@dataclass(frozen=True)
class ParsedTransaction:
    input_count: int
    outputs: tuple[ParsedOutput, ...]


@dataclass(frozen=True)
class CpfpParent:
    txid: str
    vout: int
    output_value: int
    fee: int
    size: int


def _read_varint(raw: bytes, offset: int) -> tuple[int, int]:
    if offset >= len(raw):
        raise ValueError("Unexpected end of transaction while reading varint.")
    prefix = raw[offset]
    offset += 1
    if prefix < 0xFD:
        return prefix, offset
    if prefix == 0xFD:
        width = 2
    elif prefix == 0xFE:
        width = 4
    else:
        width = 8
    end = offset + width
    if end > len(raw):
        raise ValueError("Unexpected end of transaction while reading varint value.")
    return int.from_bytes(raw[offset:end], "little"), end


def _skip(raw: bytes, offset: int, length: int, what: str) -> int:
    if length < 0 or offset + length > len(raw):
        raise ValueError(f"Unexpected end of transaction while reading {what}.")
    return offset + length


def parse_legacy_transaction(raw: bytes) -> ParsedTransaction:
    """Parse just enough of a legacy Dogecoin transaction to inspect its outputs."""
    if len(raw) < 10:
        raise ValueError("Parent transaction is too short.")

    offset = 4  # version
    input_count, offset = _read_varint(raw, offset)
    if input_count <= 0:
        raise ValueError("Parent transaction has no inputs or uses an unsupported encoding.")

    for _ in range(input_count):
        offset = _skip(raw, offset, 32 + 4, "input outpoint")
        script_len, offset = _read_varint(raw, offset)
        offset = _skip(raw, offset, script_len, "input script")
        offset = _skip(raw, offset, 4, "input sequence")

    output_count, offset = _read_varint(raw, offset)
    outputs: list[ParsedOutput] = []
    for vout in range(output_count):
        value_end = _skip(raw, offset, 8, "output value")
        value = int.from_bytes(raw[offset:value_end], "little")
        offset = value_end
        script_len, offset = _read_varint(raw, offset)
        script_end = _skip(raw, offset, script_len, "output script")
        outputs.append(ParsedOutput(vout=vout, value=value, script=raw[offset:script_end]))
        offset = script_end

    offset = _skip(raw, offset, 4, "locktime")
    if offset != len(raw):
        raise ValueError("Parent transaction contains trailing bytes or an unsupported encoding.")

    return ParsedTransaction(input_count=input_count, outputs=tuple(outputs))


def txid_from_raw(raw: bytes) -> str:
    return double_sha256(raw)[::-1].hex()


def _normalize_txid(value: str) -> str:
    txid = value.strip().lower()
    if len(txid) != 64:
        raise ValueError("Parent TXID must contain exactly 64 hexadecimal characters.")
    try:
        bytes.fromhex(txid)
    except ValueError as exc:
        raise ValueError("Parent TXID must be hexadecimal.") from exc
    return txid


def parse_cpfp_parent_response(
    payload: object,
    expected_txid: str,
    source_address: str,
) -> CpfpParent:
    if not isinstance(payload, dict):
        raise RuntimeError("BlockCypher returned an invalid transaction response.")

    txid = _normalize_txid(expected_txid)
    remote_hash = payload.get("hash")
    if not isinstance(remote_hash, str) or remote_hash.lower() != txid:
        raise RuntimeError("BlockCypher returned an unexpected parent TXID.")

    confirmations = payload.get("confirmations")
    block_height = payload.get("block_height")
    if not isinstance(confirmations, int) or confirmations < 0:
        raise RuntimeError("BlockCypher returned invalid parent confirmations.")
    if not isinstance(block_height, int):
        raise RuntimeError("BlockCypher returned an invalid parent block height.")
    if confirmations > 0 or block_height >= 0:
        raise ValueError(
            "The parent transaction is already confirmed; CPFP is no longer needed."
        )
    if payload.get("double_spend") is True:
        raise ValueError("The parent transaction is marked as a double spend.")

    raw_hex = payload.get("hex")
    if not isinstance(raw_hex, str) or not raw_hex:
        raise RuntimeError("BlockCypher did not return the parent raw transaction.")
    try:
        raw = bytes.fromhex(raw_hex)
    except ValueError as exc:
        raise RuntimeError("BlockCypher returned invalid parent transaction hex.") from exc
    if txid_from_raw(raw) != txid:
        raise RuntimeError("Parent raw transaction does not match the requested TXID.")

    parsed = parse_legacy_transaction(raw)
    size = len(raw)
    remote_size = payload.get("size")
    if not isinstance(remote_size, int) or remote_size != size:
        raise RuntimeError("BlockCypher returned an unexpected parent transaction size.")

    fee = payload.get("fees")
    if not isinstance(fee, int) or fee < 0:
        raise RuntimeError("BlockCypher returned an invalid parent transaction fee.")

    outputs_meta = payload.get("outputs")
    if not isinstance(outputs_meta, list) or len(outputs_meta) != len(parsed.outputs):
        raise RuntimeError(
            "BlockCypher returned a partial parent output list; automatic CPFP selection is disabled for safety."
        )

    source_script = p2pkh_script_pubkey(source_address)
    candidates: list[ParsedOutput] = []
    for output, meta in zip(parsed.outputs, outputs_meta):
        if not isinstance(meta, dict):
            raise RuntimeError("BlockCypher returned an invalid parent output.")
        remote_value = meta.get("value")
        if not isinstance(remote_value, int) or remote_value != output.value:
            raise RuntimeError("BlockCypher parent output value does not match raw transaction bytes.")
        remote_script = meta.get("script")
        if isinstance(remote_script, str) and remote_script.lower() != output.script.hex():
            raise RuntimeError("BlockCypher parent output script does not match raw transaction bytes.")

        if output.script != source_script or output.value <= 0:
            continue
        spent_by = meta.get("spent_by")
        if isinstance(spent_by, str) and spent_by.strip():
            continue
        candidates.append(output)

    if not candidates:
        raise ValueError(
            "The parent transaction has no unspent output controlled by the source wallet."
        )

    # Any unspent output from the parent creates the CPFP dependency. Prefer the
    # largest one so the requested package fee has the best chance of fitting.
    selected = max(candidates, key=lambda item: (item.value, -item.vout))

    inputs_meta = payload.get("inputs")
    if isinstance(inputs_meta, list) and len(inputs_meta) == parsed.input_count:
        input_values: list[int] = []
        for item in inputs_meta:
            if not isinstance(item, dict) or not isinstance(item.get("output_value"), int):
                input_values = []
                break
            input_values.append(item["output_value"])
        if input_values:
            computed_fee = sum(input_values) - sum(output.value for output in parsed.outputs)
            if computed_fee < 0 or computed_fee != fee:
                raise RuntimeError("BlockCypher parent fee does not match its inputs and outputs.")

    return CpfpParent(
        txid=txid,
        vout=selected.vout,
        output_value=selected.value,
        fee=fee,
        size=size,
    )


def fetch_cpfp_parent(
    txid: str,
    source_address: str,
    token: str | None = None,
) -> CpfpParent:
    normalized_txid = _normalize_txid(txid)
    # Validate the source address locally before contacting the provider.
    p2pkh_script_pubkey(source_address)

    params: dict[str, str | int] = {
        "includeHex": "true",
        "limit": 2000,
    }
    if token:
        params["token"] = token

    endpoint = ENDPOINT.format(txid=urllib.parse.quote(normalized_txid, safe=""))
    endpoint += "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(
        endpoint,
        headers={
            "Accept": "application/json",
            "User-Agent": "doge-wallet-generator/0.4",
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

    return parse_cpfp_parent_response(payload, normalized_txid, source_address)


def self_test() -> None:
    raw = (
        bytes.fromhex("01000000")
        + b"\x01"
        + bytes(32)
        + (0).to_bytes(4, "little")
        + b"\x00"
        + bytes.fromhex("ffffffff")
        + b"\x02"
        + (125_000_000).to_bytes(8, "little")
        + b"\x01\x51"
        + (75_000_000).to_bytes(8, "little")
        + b"\x01\x6a"
        + bytes(4)
    )
    parsed = parse_legacy_transaction(raw)
    assert parsed.input_count == 1
    assert len(parsed.outputs) == 2
    assert parsed.outputs[0].value == 125_000_000
    assert parsed.outputs[0].script == b"\x51"
    assert parsed.outputs[1].vout == 1
    assert parsed.outputs[1].value == 75_000_000
    assert parsed.outputs[1].script == b"\x6a"
    print("BlockCypher transaction parser self-test passed.")


if __name__ == "__main__":
    self_test()
