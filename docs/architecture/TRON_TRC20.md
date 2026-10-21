# USDT TRC-20 / TRON mainnet

## Identity and scope

- Wallet network: `tron-mainnet`, separate from `ethereum-mainnet`.
- Asset route: `usdt-tron-mainnet-trc20`, never resolved through ERC-20.
- BIP39 English / BIP44 path: `m/44'/195'/0'/0/0`.
- Address: Base58Check of `0x41 || last20(keccak256(uncompressedPublicKeyWithoutPrefix))`.
- Fixed USDT contract: `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` / `41a614f803b6fd780986a42c78ec9c7f77e6ded13c`.
- Token precision: 6; token amounts are canonical decimal integer strings and browser `bigint`, never floats.
- Fees/resources are paid in TRX (sun, 6 decimals), independently from the USDT balance.

TRON addresses alone do not prove the network. The read/preparation provider must report the pinned full mainnet genesis block identity (`00000000000000001ebf88508a03865c71d452e25f4d51194196a1d22b6653dc`, documented in TIP-474). A provider can still lie; this check is not a light client or proof of consensus.

## Public backend contract

Configure `TRON_RPC_URL` at runtime to a trusted TRON HTTP API node/provider supporting `/wallet` and `/walletsolidity`. It may contain operator authentication; do not commit/log it or copy it into the frontend bundle. The empty default fails explicitly with `provider_not_configured`.

```
GET  /api/chains/tron/mainnet/tokens/usdt/addresses/{address}/balance
POST /api/chains/tron/mainnet/transactions/prepare
GET  /api/chains/tron/mainnet/transactions/{txId}
```

Prepare accepts only:

```
{ assetRouteId, from, to, amountBaseUnits }
```

No signing key, signed bytes, signature, arbitrary contract or arbitrary node method is accepted. There is no TRON Symfony broadcast endpoint. The old PR #48 and issue #55 broadcast contract is superseded.

Balance validates the fixed contract's one-word `balanceOf(address)` result. Preparation returns a public snapshot:

```
chain, network, networkId, assetRouteId
from, to, amountBaseUnits, contractAddress, decimals
refBlockBytesHex, refBlockHashHex, refBlockNumber, refBlockId
timestampMs, expirationMs, feeLimitSun
energyEstimate, energyPriceSun, bandwidthPriceSun
senderTrxSun, senderTokenBalanceBaseUnits, recipientActive
```

The provider boundary validates full Base58Check address input, block ID/height correspondence, canonical integers, account identities, resource shapes, chain parameters and successful constant-call transfer estimation. No opaque provider transaction is signed.

## Browser preparation, review and signing

The browser verifies the complete snapshot against the exact selected route, sender, recipient, token amount and fixed contract. It locally encodes `transfer(address,uint256)` and serializes only one `TriggerSmartContract`, with zero native value, no token-value/permission override and the correct protobuf `Any` type URL.

Authoritative wire schema: `tronprotocol/protocol`, `core/Tron.proto`, `Transaction.raw` fields `ref_block_bytes=1`, `ref_block_hash=4`, `expiration=8`, `contract=11`, `timestamp=14`, `fee_limit=18`. `Any` contains `type.googleapis.com/protocol.TriggerSmartContract` and the encoded trigger value. TXID is SHA-256 of raw data, not of the signed outer envelope. The browser uses deterministic low-S secp256k1 signatures, verifies them locally and appends the recovery byte in TRON wire order.

Wallet policy (not protocol constants): reference timestamp at most 120 seconds old / 15 seconds ahead, maximum lifetime 600 seconds, more than 15 seconds left when signing, fee limit at most 100 TRX. TAPOS low height bytes and block hash bytes must match the exposed full reference ID/number. This validates consistency, not independent block inclusion. A stale snapshot requires explicit new preparation/review; there is no automatic replacement signing.

Backend fee policy adds 20% to estimated energy burn and checks TRX capacity conservatively with a 1,000-byte bandwidth reserve. The browser independently checks token capacity and fee limit plus its signed-wire bandwidth estimate (including a 64-byte result reserve). Available staked/free resources are not assumed to remain usable. These conservative checks can reject an otherwise affordable transaction when staking/resource delegation would cover fees; resource-aware optimization is not silently inferred. Fee estimates are not a guarantee of successful execution or of the final fee.

Review exposes route/network, sender, recipient, amount, fixed contract, TAPOS/reference block, timestamp/expiry, energy and fee information, TRX capacity and recipient activation warning. Signing is an explicit local action; signed review additionally shows local TXID. Watch-only sessions can load balances but cannot sign.

## Publication and retry

A separate explicit action publishes through the browser's `tron-http` adapter to a user-selected external HTTPS node's `/wallet/broadcasthex`, with `{transaction: signedTransactionHex}`. The destination must allow browser CORS and have an appropriate authentication policy. There is no bundled provider key or implicit default provider. The browser checks `result === true` and compares any returned TXID to the locally calculated identity. It rejects redirects and does not send browser cookies/referrer.

If a provider cannot be reached from the browser, explicitly export the signed payload for external publication. The default ChainCourier gateway is never a fallback relay. No optional relay is introduced.

An ambiguous response retains identical signed bytes and local identity for manual status lookup/retry; no hidden rebuild, nonce/TAPOS replacement or re-signing occurs. Do not submit expired bytes; prepare and sign a replacement only through another deliberate user flow. Exported bytes authorize that one transfer and may be published by anyone holding them.

## Status and confirmation

Provider acceptance is submission only, not execution success. Backend status reads both full-node and solidity APIs, verifies returned raw-data hash/TXID and receipt identity, and rejects contradictory receipts/results:

- `unknown`: neither endpoint supplies an observation; not proof of expiry or rejection.
- `observed`: a full node knows the transaction, without inclusion evidence.
- `included`: full-node receipt has block inclusion; not yet proof of solidity.
- `included-solidified`: solidity evidence exists, but execution outcome is not yet available.
- `executed-success` / `executed-failure`: a solidity receipt contains the execution result.

Missing data alone never becomes `expired`. The browser can display an expired/unknown warning only from its locally known signed expiration, without claiming that a transaction could not have executed before expiry. Status queries are explicit; rendering the chooser does not contact a provider.

## Deterministic verification

TRON fixtures use a clearly public, never-funded BIP39 mnemonic and fixed timestamps/reference blocks. Wallet derivation, protobuf bytes, TXID and signature were independently cross-checked with test-only TronWeb 6.0.4; TronWeb is not a production dependency. Tests cover exact bytes/identity/signature, wrong keys, malformed public snapshots, contract/recipient/amount mismatch, TAPOS/time/fee/resource policies, route isolation, backend public input validation and status distinctions. No funded mainnet send is required.

See `../SECURITY_MODEL.md` for hosted frontend trust and browser-memory limitations.
