# UTXO extension guide

The platform treats UTXO as a chain family, not as one universal blockchain implementation. New Bitcoin-like legacy P2PKH networks reuse cryptographic/serialization primitives through explicit network profiles while keeping chain/network adapters separate and fail-closed.

## DOGE / BTC transfer flow

DOGE and BTC are UTXO integrations and keep chain-specific address/WIF/serialization rules isolated.

```text
Sender + matching WIF
        |
        v
Recipient + amount + fee rate
        |
        v
Symfony -> confirmed UTXOs
        |
        v
Browser -> verify key/address + UTXO scripts
        |
        v
Browser -> coin selection + local P2PKH signing
        |
        v
Review amount / fee / change / local TXID
        |
        v
Explicit broadcast
        |
        v
Browser -> user-selected provider, or signed-payload export
```

Amounts use integer smallest units internally (`koinu` / `satoshi`). DOGE/BTC spend confirmed UTXOs only. The browser calculates the local TXID and verifies the provider-returned TXID.

Bitcoin source and change outputs remain legacy P2PKH in the current runtime. BTC recipient outputs accept legacy P2PKH and native SegWit P2WPKH (`bc1q...`) addresses. P2WPKH source wallets/signing are not implemented yet.


## Browser profile

A new legacy P2PKH network defines a `UtxoP2pkhProfile` with:

- symbol;
- BIP44 derivation path / coin type;
- Base58Check P2PKH version;
- compressed WIF version;
- dust threshold in smallest units.

`utxoP2pkh.ts` owns BIP39/BIP32 derivation, Base58Check address generation, WIF encoding and address validation. `utxoP2pkhTransaction.ts` owns confirmed-UTXO selection, legacy P2PKH scripts, SIGHASH_ALL signing, serialization and local txid calculation.

A chain must still expose a thin wallet adapter and asset-route adapter. There is no fallback from one UTXO chain to another.

## Backend profile

Provider access is infrastructure. `BlockCypherUtxoMainnetClient` contains reusable BlockCypher request/response handling for supported UTXO mainnets. A concrete `ChainAdapter` supplies the provider slug, exact chain/network identity, P2PKH validation version and fee policy.

The reusable `LegacyP2pkhAddress` validates Base58Check checksums and network versions. `LegacyUtxo` is provider-neutral confirmed UTXO metadata.

A future own-node adapter can replace BlockCypher without changing browser signing.

## Adding another legacy P2PKH currency

1. Add chain/network/asset/route catalog entries.
2. Define a `UtxoP2pkhProfile` from authoritative chain parameters.
3. Add the wallet-network and asset-route adapters; register both explicitly.
4. Add backend `ChainAdapter` capabilities and provider configuration.
5. Expose public balance, confirmed UTXO and fee-policy endpoints only. Publication uses frontend direct/custom provider transport or signed-payload export; never introduce a Symfony broadcast endpoint.
6. Add a deterministic BIP39 derivation vector and transaction regression vector before marking the route live.
7. Extend adapter-registry invariants so unknown/cross-chain routes continue to fail closed.
8. Keep seed/WIF/private key material browser-memory-only.

Do not reuse this profile for SegWit, Taproot, EVM, TRON, Solana or other transaction families. Those require their own explicit capability/serialization models.

## Litecoin mainnet profile

The first consumer added through this model is Litecoin legacy P2PKH:

- chain: `litecoin`;
- network: `litecoin-mainnet`;
- route: `ltc-litecoin-mainnet-native`;
- derivation path: `m/44'/2'/0'/0/0`;
- P2PKH version: `0x30`;
- WIF version: `0xb0`;
- fee unit: `LTC/kB`;
- BlockCypher slug: `ltc/main`.

Litecoin SegWit (`ltc1...`) is intentionally out of scope for this first integration.
