# USDT TRC-20 on TRON Mainnet

USDT TRC-20 is a distinct route: `usdt-tron-mainnet-trc20` on `tron-mainnet`, backed by the `tron:mainnet` chain adapter. It must never fall back to the Ethereum ERC-20 route. TRON and Ethereum wallet sessions, addresses, balances and transfer adapters are separate.

## Non-custodial flow

Mnemonic recovery, TRON address derivation and transaction signing happen in browser memory. Symfony is a blockchain API gateway: it receives public intent and public chain state, and may broadcast already-signed bytes. Symfony never receives or signs seed phrases or private keys. Preparation and signing are separate from the explicit broadcast action, with human-readable review between them.

The fixed mainnet token contract is `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` (raw address `41a614f803b6fd780986a42c78ec9c7f77e6ded13c`), with 6 decimals. Token amounts are integer base units; browser arithmetic uses `bigint`.

## Route-specific semantics

- Wallet derivation uses BIP44 `m/44'/195'/0'/0/0` and TRON Base58Check addresses.
- USDT is transferred through one `TriggerSmartContract`; native TRX is not a transfer route.
- TRX is required for bandwidth, energy and the fee limit. Recipient account activation is surfaced explicitly.
- Preparation expires within the frozen ten-minute window and includes TAPOS/resource data.
- The browser rebuilds and validates the exact intent, calculates the raw-data transaction identity, signs locally, and reviews it before broadcast.
- Broadcast `accepted-for-broadcast` is not execution success. Statuses distinguish observed, solidified inclusion, executed success/failure, and expired/unknown.
- A timeout may retry only the identical signed bytes/transaction identity or perform status lookup; no automatic replacement or re-signing is performed.

## Verification fixtures

Deterministic vectors use the public unfunded synthetic fixture from the Tron implementation specification. They cover address/Base58 and ABI boundaries, deterministic protobuf/transaction identity, signature recovery, malformed input, stale/expiry, resource/activation failures and idempotent broadcast/confirmation behavior. The synthetic transaction is never broadcast and no funded live send is part of verification. A public observation transaction may be queried read-only as evidence only.

Provider responses are treated as untrusted and validated against the requested route, contract, owner, recipient, amount and transaction identity. Unknown chain/network/asset values fail closed.
