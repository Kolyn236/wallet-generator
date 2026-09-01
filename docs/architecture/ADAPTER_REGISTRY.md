# Adapter registry architecture

This document defines the registry model and the invariants that keep cryptocurrency runtime behavior explicit and fail-closed.

Current live frontend routes are:

```text
doge-dogecoin-mainnet-native
btc-bitcoin-mainnet-native
eth-ethereum-mainnet-native
usdt-ethereum-mainnet-erc20
```

USDT TRC-20 remains planned. It must never resolve through the Ethereum ERC-20 runtime.

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

A **Network** is a concrete environment of one chain:

```text
dogecoin-mainnet
bitcoin-mainnet
ethereum-mainnet
tron-mainnet
```

Browser wallet identity is network-scoped. One Ethereum account can own native ETH and multiple ERC-20 assets without creating separate wallet identities.

### Asset and asset route

An **Asset** is the economic unit shown to the user, for example DOGE, BTC, ETH or USDT. USDT is an asset, not a blockchain.

An **Asset Route** joins one asset to one network and identifies how that asset executes on that network.

| Asset route | Asset | Network | Kind | Frontend status |
| --- | --- | --- | --- | --- |
| `doge-dogecoin-mainnet-native` | DOGE | Dogecoin mainnet | native | live |
| `btc-bitcoin-mainnet-native` | BTC | Bitcoin mainnet | native | live |
| `eth-ethereum-mainnet-native` | ETH | Ethereum mainnet | native | live |
| `usdt-ethereum-mainnet-erc20` | USDT | Ethereum mainnet | ERC-20 token | live |
| `usdt-tron-mainnet-trc20` | USDT | Tron mainnet | TRC-20 token | planned |

The route, not the asset symbol alone, is the runtime selection and balance key.

## Frontend wallet-network adapters

`WalletNetworkAdapter` owns behavior belonging to one wallet identity/network:

- `networkId`;
- wallet identity metadata;
- local wallet creation when supported;
- BIP39 mnemonic recovery when supported;
- public-address validation;
- wallet/network capability metadata.

It does not own an asset balance.

Current live wallet-network adapters:

```text
dogecoin-mainnet
bitcoin-mainnet
ethereum-mainnet
```

All three live wallet-network adapters support English BIP39 mnemonic recovery using their fixed current derivation path. Import is an explicit network operation: selecting Bitcoin derives the Bitcoin identity, selecting Dogecoin derives the Dogecoin identity, and selecting either ETH or USDT ERC-20 derives the shared `ethereum-mainnet` identity.

Wallet sessions are keyed by `networkId` and contain public identity/session state only. They deliberately contain no balance and no mnemonic/private signing material.

Session modes are:

```text
none
local-signing
watch-only
```

`local-signing` intentionally covers both locally generated wallets and wallets recovered from a mnemonic. Signing capability, rather than how the key was obtained, is the session-level distinction.

## Browser signing material

The generic `BrowserSigningWallet` contract discriminates signing material explicitly:

```text
wif
private-key
```

and records its in-memory origin:

```text
generated
mnemonic
```

A generated wallet temporarily carries `generatedMnemonic` so the backup UI can show the newly created seed. A wallet recovered from an entered mnemonic does **not** carry that mnemonic after derivation. The recovery form clears its mnemonic state after successful import or cancellation; only the derived signing material remains in the active browser-memory signing wallet.

DOGE/BTC use `kind = wif` for legacy P2PKH. Ethereum uses `kind = private-key` with derivation path:

```text
m/44'/60'/0'/0/0
```

Native ETH and USDT ERC-20 consume the same Ethereum signing material through separate asset-route adapters. Supplying the wrong signing-material kind fails closed.

Seed phrases, WIFs and private keys remain browser-memory-only. Registry guardrails reject secret persistence through browser storage APIs.

## Frontend asset-route adapters

`AssetRouteAdapter` owns behavior for one concrete asset route:

- `routeId`;
- `assetId`;
- `networkId`;
- route-specific capabilities;
- asset balance loading;
- route-specific transfer runtime/UI.

A route adapter may register only when its catalog asset/network identity matches and its required wallet-network adapter is already registered.

Native ETH and USDT ERC-20 are different route adapter objects even though both depend on `ethereumMainnetWalletAdapter`.

## Shared Ethereum identity, separate balances

Frontend balances are keyed by `routeId`, not by network:

```text
ethereum-mainnet wallet session
address: 0xABC...

eth-ethereum-mainnet-native balance       1.25 ETH
usdt-ethereum-mainnet-erc20 balance       500 USDT
```

Changing or recovering the Ethereum wallet identity invalidates every asset-route balance on `ethereum-mainnet`, so ETH and USDT are cleared together before new reads complete.

## Native ETH route

The native ETH route owns:

- Ethereum address validation;
- BIP39/BIP44 local wallet creation and recovery;
- browser-local secp256k1 private-key signing;
- native ETH balance loading;
- public transaction preparation through Symfony;
- EIP-1559 Type-2 serialization/signing;
- local transaction-hash calculation;
- explicit signed-raw broadcast.

Native transfer intent uses the recipient as `to`, the ETH amount as `valueWei` and empty calldata.

## USDT ERC-20 route

USDT ERC-20 reuses the Ethereum wallet identity but owns token-specific behavior:

- fixed Ethereum Mainnet USDT contract;
- 6-decimal amount parsing/formatting;
- token balance loading through `eth_call balanceOf(address)`;
- local ABI encoding of `transfer(address,uint256)`;
- EIP-1559 preparation with `to = token contract`, `valueWei = 0` and transfer calldata;
- token-balance validation plus native ETH gas-balance validation;
- browser-local Type-2 signing and explicit broadcast.

Recovering the Ethereum identity from a seed therefore unlocks both native ETH and USDT ERC-20 signing for that one `ethereum-mainnet` wallet session. There is no separate USDT seed or derivation path.

The fixed contract and route details are documented in `USDT_ERC20.md`.

## Why USDT ERC-20 and USDT TRC-20 are separate routes

`USDT ERC-20` is carried by Ethereum and uses the Ethereum account/address space.

`USDT TRC-20` is carried by Tron and requires a Tron wallet/network runtime. It remains planned and unregistered.

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
8. every route marked live resolves to its own runtime adapter;
9. no default adapter or chain fallback exists.

## Backend capability adapters

Backend `ChainAdapter` contains chain/network identity only. Behavior is exposed through capabilities rather than a fat universal blockchain interface.

UTXO capabilities include:

- `AddressBalanceCapability`;
- `UtxoLookupCapability`;
- `UtxoFeeRateCapability`;
- `RawTransactionBroadcastCapability`.

Ethereum capabilities include:

- `EvmNativeBalanceCapability`;
- `Erc20BalanceCapability`;
- `EvmPendingNonceCapability`;
- `EvmGasEstimateCapability`;
- `Eip1559FeeQuoteCapability`;
- `RawTransactionBroadcastCapability`.

Ethereum deliberately does not implement UTXO capabilities.

The USDT HTTP balance use case chooses the fixed USDT contract itself. The public API does not accept an arbitrary contract address and then pass it blindly to the capability.

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

Ethereum verifies the provider reports `eth_chainId == 1` before state/broadcast operations.

## Automated guardrails

Frontend invariant tests verify that:

- all live DOGE/BTC/ETH/USDT-ERC20 routes have exact route and wallet-network adapters;
- every live wallet-network adapter exposes mnemonic recovery;
- fixed public BIP39 vectors recover the expected DOGE/BTC/Ethereum identity;
- recovered signing wallets do not retain the entered mnemonic;
- invalid BIP39 mnemonics fail closed;
- TRC-20 remains unregistered while planned;
- ETH and USDT resolve to different route adapters but the same Ethereum wallet-network adapter;
- built-in registry keys are unique;
- unknown route/network keys fail closed;
- wallet sessions remain network-scoped and balance-free;
- balances remain asset-route-scoped;
- changing an Ethereum wallet invalidates ETH and USDT balances together;
- DOGE/BTC reject private-key signing material;
- Ethereum routes reject WIF signing material;
- wallet secrets are not persisted in browser storage.

Deterministic frontend vectors cover:

- DOGE derivation/signing;
- BTC derivation/signing;
- ETH BIP39/BIP44 derivation and Type-2 serialization/hash;
- USDT 6-decimal conversion, ERC-20 calldata and deterministic Type-2 signing.

Backend tests verify exact registry/capability resolution, Ethereum mainnet checks, ERC-20 `eth_call` encoding/result validation, quantity safety and provider-response validation without a live RPC provider.

`Quality Gate` runs deterministic vectors, frontend registry invariants, frontend build and backend quality checks. `Integration Smoke` owns Docker/Compose runtime verification separately.

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
