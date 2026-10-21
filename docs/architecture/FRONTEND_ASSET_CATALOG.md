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
litecoin-mainnet -> Litecoin -> UTXO
ethereum-mainnet -> Ethereum -> EVM
tron-mainnet     -> Tron     -> TRON

DOGE -> dogecoin-mainnet -> native
BTC  -> bitcoin-mainnet  -> native
LTC  -> litecoin-mainnet -> native
ETH  -> ethereum-mainnet -> native
USDT -> ethereum-mainnet -> token / ERC-20
USDT -> tron-mainnet     -> token / TRC-20
```

USDT therefore does not define or own a blockchain. Its ERC-20 and TRC-20 choices reuse the Ethereum and Tron network definitions.

## Runtime availability belongs to a route

Protocol metadata does not imply that a route is implemented. Runtime availability is recorded per `AssetRouteId`, not per asset.

Current state:

```text
doge-dogecoin-mainnet-native -> live
btc-bitcoin-mainnet-native   -> live
ltc-litecoin-mainnet-native  -> live
eth-ethereum-mainnet-native  -> live
usdt-ethereum-mainnet-erc20  -> live
usdt-tron-mainnet-trc20      -> live
```

The asset-level badge is derived from route status; each live route requires its own complete runtime. The USDT chooser reads existing route/session/balance state without render-time provider requests. Ethereum/ERC-20 uses ETH gas; TRON/TRC-20 uses TRX resources/fees. Selection is not conversion, swap or bridge.

`getDefaultAssetRoute(assetId)` chooses a live route when one exists. If none is live it uses the deterministic first catalog route. This decision is based on catalog availability only and does not inspect the runtime adapter registry.

A route that is available must have its own registered `AssetRouteAdapter` and a registered `WalletNetworkAdapter` for its network. Planned routes remain unregistered and fail closed instead of resolving to another asset's runtime.

## Wallet identity versus asset state

Wallet identity is network-scoped while balances are asset-route-scoped.

For current UTXO assets this distinction is mostly invisible because DOGE and BTC each have one supported native asset route. It becomes necessary for shared-account chains such as Ethereum:

```text
ethereum-mainnet wallet session
0xABC...
    |
    +-- ETH native balance
    +-- USDT ERC-20 balance
    +-- future ERC-20 balances
```

All of those routes reuse the same Ethereum address/private-key identity, but each balance is stored independently by route. Balance state records the address it belongs to so the UI cannot display a stale value after the network wallet changes.

Changing a wallet identity invalidates every route balance for that network.

## Signing material

The generic browser-created wallet type does not assume WIF. Signing material is explicitly discriminated as `wif` or `private-key`.

DOGE and BTC continue to generate and use WIF exactly as before, but expose it through the generic `wif` variant. Future EVM wallet code can use the `private-key` variant without adding an optional generic WIF field or weakening type safety.

This catalog is not a transaction abstraction. UTXO, EVM and TRON transaction construction, signing and fee semantics remain chain-family-specific and must not be forced into one universal transaction or fee model.
