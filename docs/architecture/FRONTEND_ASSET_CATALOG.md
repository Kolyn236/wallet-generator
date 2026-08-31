# Frontend chain, network, asset and route catalog

The React frontend keeps protocol topology separate from wallet runtime support in `frontend/src/assets.ts`.

The runtime adapter model, fail-closed lookup rules and automated guardrails are documented in `docs/architecture/ADAPTER_REGISTRY.md`.

## Concepts

- `ChainDefinition` describes a blockchain and its `ChainFamily` (`utxo`, `evm`, or `tron`).
- `NetworkDefinition` describes a concrete network and points to exactly one chain.
- `AssetDefinition` describes a native asset or token independently from the chain that can carry it.
- `AssetRouteDefinition` joins an asset to a network and records whether that route is native or token-based plus the user-facing standard label.

The initial relationships are:

```text
dogecoin-mainnet -> Dogecoin -> UTXO
bitcoin-mainnet  -> Bitcoin  -> UTXO
ethereum-mainnet -> Ethereum -> EVM
tron-mainnet     -> Tron     -> TRON

DOGE -> dogecoin-mainnet -> native
BTC  -> bitcoin-mainnet  -> native
ETH  -> ethereum-mainnet -> native
USDT -> ethereum-mainnet -> token / ERC-20
USDT -> tron-mainnet     -> token / TRC-20
```

USDT therefore does not define or own a blockchain. Its ERC-20 and TRC-20 choices reuse the Ethereum and Tron network definitions.

## Runtime support

Protocol metadata does not imply that a route is implemented. The current frontend availability catalog keeps DOGE and BTC available and ETH/USDT planned, preserving the existing product behavior.

A route that is available must have its own registered `AssetRouteAdapter` and a registered `WalletNetworkAdapter` for its network. Planned routes remain unregistered and fail closed instead of resolving to another asset's runtime.

This catalog is not a transaction abstraction. UTXO, EVM and TRON transaction construction, signing and fee semantics remain chain-family-specific and must not be forced into one universal transaction or fee model.
