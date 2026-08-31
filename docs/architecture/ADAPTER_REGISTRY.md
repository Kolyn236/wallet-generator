# Adapter registry architecture

This document defines the registry model and the invariants that keep cryptocurrency runtime behavior explicit and fail-closed.

The current live runtime support is limited to Dogecoin mainnet and Bitcoin mainnet. Ethereum, ERC-20, TRON and TRC-20 appear only as architecture/catalog concepts where noted below; this document does not claim that those runtimes are implemented.

## Core concepts

### Chain

A **Chain** is the blockchain/protocol identity, for example Dogecoin, Bitcoin, Ethereum or Tron.

A chain is not an asset. A chain can carry one native asset and, for some chain families, additional token assets.

### Chain Family

A **Chain Family** groups chains by transaction/account semantics rather than by marketing category.

Current catalog families are:

- `utxo` — Dogecoin and Bitcoin;
- `evm` — Ethereum-family account-based semantics;
- `tron` — TRON-family semantics.

Chain family is intentionally not a universal transaction interface. UTXO, EVM and TRON signing, fee and state models differ.

### Network

A **Network** is a concrete environment of one chain, such as `dogecoin-mainnet` or `bitcoin-mainnet`.

Wallet identity and session state are network-scoped. A network key must not silently fall back to another network or chain.

### Asset

An **Asset** is the economic unit shown to the user, for example DOGE, BTC, ETH or USDT.

An asset does not necessarily own a blockchain. In particular, USDT can exist on multiple chains.

### Asset Route

An **Asset Route** joins one asset to one network and records how that asset exists on that network.

Examples in the catalog:

| Asset route | Asset | Network | Kind | Runtime status |
| --- | --- | --- | --- | --- |
| `doge-dogecoin-mainnet-native` | DOGE | Dogecoin mainnet | native | live |
| `btc-bitcoin-mainnet-native` | BTC | Bitcoin mainnet | native | live |
| `eth-ethereum-mainnet-native` | ETH | Ethereum mainnet | native | planned metadata only |
| `usdt-ethereum-mainnet-erc20` | USDT | Ethereum mainnet | token / ERC-20 | planned metadata only |
| `usdt-tron-mainnet-trc20` | USDT | Tron mainnet | token / TRC-20 | planned metadata only |

A route is the correct runtime selection key because `USDT on Ethereum` and `USDT on Tron` are different execution paths even though the displayed asset symbol is the same.

## Frontend runtime adapters

The frontend separates wallet/network behavior from asset-route behavior.

### `WalletNetworkAdapter`

`WalletNetworkAdapter` owns behavior that belongs to a wallet on one network:

- network identity;
- local wallet creation when supported;
- public-address validation;
- balance loading;
- wallet/network capability metadata.

Wallet sessions are keyed by `networkId`, not by asset symbol. This prevents an asset selection from accidentally reusing a wallet session from another network.

Secrets such as mnemonic/WIF/private key remain in browser memory only. Registry/session guardrails reject persistence through browser storage APIs. The existing language preference is the only intentional `localStorage` write.

### `AssetRouteAdapter`

`AssetRouteAdapter` owns behavior for one concrete asset route:

- `routeId`;
- `assetId`;
- `networkId`;
- route-specific capability metadata;
- route-specific transfer runtime/UI entry point.

A route adapter may only register when its catalog asset/network identity matches and the required wallet-network adapter is registered.

### Why ETH and ERC-20 share an Ethereum wallet

When Ethereum support is implemented in the future, native ETH and ERC-20 assets on Ethereum should use the same Ethereum wallet/network identity because they use the same Ethereum account/address space.

That does **not** mean their asset routes are the same. Native ETH transfer behavior and an ERC-20 token transfer are different route-level operations.

### Why USDT ERC-20 and USDT TRC-20 are separate routes

USDT is an asset, not a blockchain.

`USDT ERC-20` is carried by Ethereum and would use an Ethereum wallet/network adapter. `USDT TRC-20` is carried by Tron and would use a Tron wallet/network adapter. They therefore require separate asset routes and separate route runtime behavior.

Neither route is implemented today.

## Frontend fail-closed lookup

`AdapterRegistry` registers wallet-network adapters by `networkId` and asset-route adapters by `routeId`.

The registry rules are:

1. duplicate wallet-network keys throw;
2. duplicate asset-route keys throw;
3. an asset-route adapter must match the catalog route identity;
4. an asset-route adapter requires its wallet-network adapter;
5. unknown network lookup returns `null`;
6. unknown asset-route lookup returns `null`;
7. planned routes remain unregistered until their runtime is genuinely implemented;
8. every route marked live by the current availability catalog must resolve to its own registered runtime adapter.

There is deliberately no default adapter and no `else -> Dogecoin` path.

## Backend capability adapters

### `ChainAdapter`

The backend `ChainAdapter` contract contains chain/network identity only.

It must not become a fat universal blockchain interface.

### Capability interfaces

Implemented behavior is exposed through separate capabilities, currently including:

- `AddressBalanceCapability`;
- `UtxoLookupCapability`;
- `UtxoFeeRateCapability`;
- `RawTransactionBroadcastCapability`.

A future non-UTXO adapter should implement only capabilities that make sense for that chain family rather than fake UTXO methods.

### `ChainAdapterRegistry`

`ChainAdapterRegistry` uses the exact key:

```text
chain:network
```

Current registered runtime keys are:

```text
dogecoin:mainnet
bitcoin:mainnet
```

Registry behavior is fail-closed:

- duplicate keys throw `DuplicateChainAdapter`;
- unknown chain/network lookup throws `ChainAdapterNotFound`;
- requesting a capability the selected adapter does not implement throws `UnsupportedChainCapability`;
- no lookup falls back to another chain adapter.

Dogecoin application use cases resolve the Dogecoin adapter. Bitcoin application use cases resolve the Bitcoin adapter. Tests intentionally exercise the real registry boundary rather than mocking it away.

## Module boundaries

The registry architecture must preserve the modular-monolith dependency direction:

```text
Presentation -> Application <- Infrastructure
                    |
                    v
                  Domain
```

Important rules:

- Presentation must not import Blockchain Infrastructure directly;
- Blockchain Application must not import concrete Blockchain Infrastructure adapters;
- concrete adapters live in Infrastructure and implement Application-owned contracts/capabilities;
- modules must not import another module's Infrastructure or Presentation layer.

These rules are enforced by architecture tests.

## Automated guardrails

Frontend invariant tests verify that:

- every currently live route has a registered route adapter and wallet-network adapter;
- planned routes do not resolve to another runtime;
- built-in registry keys are unique and duplicate registration throws;
- unknown route/network keys fail closed;
- DOGE resolves only to the Dogecoin runtime objects;
- BTC resolves only to the Bitcoin runtime objects;
- wallet sessions remain network-scoped;
- wallet secrets are not persisted in browser storage.

Backend tests verify that:

- chain/network keys remain exact and unique;
- unknown chains and networks throw explicitly even when known adapters are present;
- unsupported capabilities throw explicitly;
- Dogecoin and Bitcoin resolve and delegate only to their own adapters;
- a Dogecoin use case cannot silently use the Bitcoin adapter and vice versa;
- Presentation/Application dependency direction does not bypass Infrastructure boundaries.

CI runs these guardrails explicitly in addition to the existing full PHPUnit suite, PHPStan, PHP-CS-Fixer, frontend TypeScript build, Bitcoin deterministic vector, Docker smoke tests and the Python Dogecoin reference self-test.

## Adding a future live route

Making a new route live is intentionally incomplete until all required runtime pieces are registered.

At minimum:

1. define the chain/network/asset/route catalog metadata;
2. implement/register the required `WalletNetworkAdapter`;
3. implement/register the required `AssetRouteAdapter`;
4. implement/register the backend chain adapter and only the capabilities that chain supports;
5. add deterministic/runtime regression coverage appropriate to that chain;
6. change availability to live only after the adapters exist.

If availability is changed first, the invariant tests should fail rather than expose a broken or incorrectly routed UI path.
