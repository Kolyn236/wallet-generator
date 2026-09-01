# Adapter registry architecture

This document defines the registry model and the invariants that keep cryptocurrency runtime behavior explicit and fail-closed.

Current live frontend routes are:

```text
doge-dogecoin-mainnet-native
btc-bitcoin-mainnet-native
eth-ethereum-mainnet-native
```

USDT ERC-20 and USDT TRC-20 remain planned routes. A live Ethereum wallet identity does not make the ERC-20 route executable by itself.

## Core concepts

### Chain

A **Chain** is the blockchain/protocol identity, for example Dogecoin, Bitcoin, Ethereum or Tron.

A chain is not an asset. One chain may carry its native asset plus token assets.

### Chain family

A **Chain Family** groups chains by transaction/account semantics:

- `utxo` — Dogecoin and Bitcoin;
- `evm` — Ethereum-family account-based semantics;
- `tron` — TRON-family semantics.

Chain family must not become one universal transaction interface. UTXO, EVM and TRON signing/state/fee semantics are different.

### Network

A **Network** is a concrete environment of one chain, such as:

```text
dogecoin-mainnet
bitcoin-mainnet
ethereum-mainnet
tron-mainnet
```

Browser wallet identity is network-scoped. This is especially important for Ethereum: one Ethereum account can own native ETH and multiple ERC-20 assets without creating separate wallet identities.

### Asset

An **Asset** is the economic unit shown to the user, for example DOGE, BTC, ETH or USDT.

USDT is an asset, not a blockchain.

### Asset route

An **Asset Route** joins one asset to one network and identifies how that asset executes on that network.

| Asset route | Asset | Network | Kind | Frontend status |
| --- | --- | --- | --- | --- |
| `doge-dogecoin-mainnet-native` | DOGE | Dogecoin mainnet | native | live |
| `btc-bitcoin-mainnet-native` | BTC | Bitcoin mainnet | native | live |
| `eth-ethereum-mainnet-native` | ETH | Ethereum mainnet | native | live |
| `usdt-ethereum-mainnet-erc20` | USDT | Ethereum mainnet | ERC-20 token | planned |
| `usdt-tron-mainnet-trc20` | USDT | Tron mainnet | TRC-20 token | planned |

The route, not the asset symbol alone, is the runtime selection and balance key.

## Frontend wallet-network adapters

`WalletNetworkAdapter` owns behavior belonging to one wallet identity/network:

- `networkId`;
- wallet identity metadata;
- local wallet creation when supported;
- public-address validation;
- wallet/network capability metadata.

It does not own an asset balance.

Current live wallet-network adapters:

```text
dogecoin-mainnet
bitcoin-mainnet
ethereum-mainnet
```

Wallet sessions are keyed by `networkId` and contain only public identity/session state:

```text
address
mode
```

They deliberately contain no balance.

## Browser signing material

The generic browser wallet contract discriminates signing material explicitly:

```text
wif
private-key
```

DOGE/BTC use `kind = wif` for their legacy P2PKH runtime.

Ethereum uses `kind = private-key` with derivation path:

```text
m/44'/60'/0'/0/0
```

Route adapters narrow the signing-material kind before passing it to chain-specific transfer code. Supplying the wrong kind fails closed.

Seed phrases, WIFs and private keys remain browser-memory-only. Registry guardrails reject secret persistence through browser storage APIs.

## Frontend asset-route adapters

`AssetRouteAdapter` owns behavior for one concrete asset route:

- `routeId`;
- `assetId`;
- `networkId`;
- route-specific capability metadata;
- asset balance loading;
- route-specific transfer runtime/UI entry point.

A route adapter may register only when its catalog asset/network identity matches and its required wallet-network adapter is already registered.

Current live route adapters are separate runtime objects for DOGE, BTC and native ETH.

## Route-scoped balances

Frontend balances are keyed by `routeId`, not by network:

```text
assetRouteBalances[routeId]
```

For Ethereum this permits:

```text
ethereum-mainnet wallet session
address: 0xABC...

eth-ethereum-mainnet-native balance       1.25 ETH
usdt-ethereum-mainnet-erc20 balance       future independent value
```

Changing the Ethereum wallet identity invalidates balances for every asset route on `ethereum-mainnet`, including the future ERC-20 route.

## Ethereum native route

The live native ETH route owns:

- Ethereum address validation;
- BIP39/BIP44 local wallet creation;
- browser-local secp256k1 private-key signing;
- native ETH balance loading;
- public transaction preparation through Symfony;
- EIP-1559 Type-2 serialization/signing;
- local transaction-hash calculation;
- explicit signed-raw broadcast.

The browser sends Symfony only public intent:

```text
from
to
valueWei
data
```

Symfony returns public preparation state:

```text
chainId
senderBalanceWei
nonce
gasLimit
baseFeePerGasWei
maxPriorityFeePerGasWei
maxFeePerGasWei
```

The browser verifies the private key belongs to the sender, signs locally and compares its local transaction hash with the provider-returned hash after broadcast.

The native ETH route always selects `ethereum-mainnet`; it does not fall back to another EVM chain.

## Why ETH and ERC-20 share one Ethereum wallet

Native ETH and ERC-20 assets use the same Ethereum account/address space, so they share the `ethereum-mainnet` wallet session.

They do **not** share asset-route balance or transfer behavior. Native ETH is live; USDT ERC-20 remains unregistered/planned until its token-specific runtime exists.

## Why USDT ERC-20 and USDT TRC-20 are separate routes

`USDT ERC-20` is carried by Ethereum and uses an Ethereum account identity.

`USDT TRC-20` is carried by Tron and will require a Tron wallet/network runtime.

The two routes must never resolve to each other.

## Frontend fail-closed registry

`AdapterRegistry` registers wallet-network adapters by `networkId` and asset-route adapters by `routeId`.

Rules:

1. duplicate wallet-network keys throw;
2. duplicate asset-route keys throw;
3. an asset-route adapter must match catalog route identity;
4. an asset-route adapter requires its wallet-network adapter;
5. unknown network lookup returns `null`;
6. unknown asset-route lookup returns `null`;
7. planned routes remain unregistered;
8. every route marked live must resolve to its own runtime adapter;
9. no default adapter or chain fallback exists.

## Backend capability adapters

Backend `ChainAdapter` contains chain/network identity only.

Implemented behavior is exposed through capability interfaces rather than a fat universal blockchain interface.

UTXO capabilities include:

- `AddressBalanceCapability`;
- `UtxoLookupCapability`;
- `UtxoFeeRateCapability`;
- `RawTransactionBroadcastCapability`.

Ethereum capabilities include:

- `EvmNativeBalanceCapability`;
- `EvmPendingNonceCapability`;
- `EvmGasEstimateCapability`;
- `Eip1559FeeQuoteCapability`;
- `RawTransactionBroadcastCapability`.

Ethereum deliberately does not implement UTXO capabilities.

## Backend chain registry

`ChainAdapterRegistry` uses exact keys:

```text
dogecoin:mainnet
bitcoin:mainnet
ethereum:mainnet
```

Rules:

- duplicate keys throw `DuplicateChainAdapter`;
- unknown chain/network throws `ChainAdapterNotFound`;
- unsupported capability throws `UnsupportedChainCapability`;
- no lookup falls back to another chain adapter.

Ethereum additionally verifies the provider reports `eth_chainId == 1` before state/broadcast operations.

## Module boundaries

Registry behavior must preserve the modular-monolith dependency direction:

```text
Presentation -> Application <- Infrastructure
                    |
                    v
                  Domain
```

Important rules:

- Presentation must not import Blockchain Infrastructure directly;
- Blockchain Application must not import concrete Infrastructure adapters;
- concrete adapters live in Infrastructure and implement Application-owned contracts/capabilities;
- modules must not import another module's Infrastructure or Presentation layer.

## Automated guardrails

Frontend invariant tests verify that:

- all live DOGE/BTC/ETH routes have exact route and wallet-network adapters;
- USDT ERC-20 and TRC-20 remain unregistered while planned;
- built-in registry keys are unique;
- unknown route/network keys fail closed;
- DOGE, BTC and ETH resolve only to their own runtime objects;
- wallet sessions remain network-scoped and balance-free;
- balances remain asset-route-scoped;
- changing an Ethereum wallet invalidates ETH and future ERC-20 balances together;
- DOGE/BTC reject private-key signing material;
- Ethereum rejects WIF signing material;
- wallet secrets are not persisted in browser storage.

Deterministic frontend vectors cover:

- DOGE derivation/signing;
- BTC derivation/signing;
- ETH BIP39/BIP44 derivation;
- EIP-1559 Type-2 serialization and transaction hashing.

Backend tests verify exact registry/capability resolution, wrong-network failure, Ethereum quantity safety and provider-response validation without requiring a live RPC provider.

`Quality Gate` runs the deterministic vectors, frontend registry invariants, frontend build and backend quality checks. `Integration Smoke` owns Docker/Compose runtime verification separately.

## Adding a future live route

A route is not live until all required runtime pieces exist.

At minimum:

1. define chain/network/asset/route metadata;
2. implement/register the required wallet-network adapter;
3. implement/register the asset-route adapter;
4. implement/register backend capabilities required by that route;
5. add deterministic/runtime regression coverage;
6. change only that route's availability to live.

If availability is changed before the runtime exists, invariant tests must fail rather than expose a fallback or partially wired path.
