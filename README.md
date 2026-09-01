# Wallet Platform

A multi-chain non-custodial wallet platform built with a **Symfony 7.4 modular monolith + React/TypeScript frontend**.

Wallet creation and transaction signing happen in browser memory. Symfony is the blockchain API gateway: it handles public chain data, transaction preparation where chain state is required, and broadcast of already-signed transactions.

## Current status

```text
Browser
   |
   |  network-scoped wallet sessions
   |  local DOGE / BTC / ETH signers
   v
Nginx :8080
   |---- / ----------> React + TypeScript
   |
   +---- /api/* -----> Symfony / PHP-FPM
                         |
                         +--> chain/network capability adapters
                                |
                                +--> blockchain nodes/providers
```

Live frontend routes:

- DOGE / Dogecoin mainnet — legacy P2PKH;
- BTC / Bitcoin mainnet — legacy P2PKH;
- ETH / Ethereum mainnet — native ETH with EIP-1559 Type-2 transactions.

Planned token routes:

- USDT ERC-20 on Ethereum mainnet;
- USDT TRC-20 on Tron mainnet.

USDT routes remain non-executable until their own asset-route adapters exist. Native ETH becoming live does not implicitly enable ERC-20.

## Wallet derivation

Locally created wallets use BIP39 mnemonics and BIP44 derivation:

```text
DOGE  m/44'/3'/0'/0/0
BTC   m/44'/0'/0'/0/0
ETH   m/44'/60'/0'/0/0
```

DOGE/BTC expose WIF signing material for their legacy P2PKH runtime. Ethereum exposes a browser-local secp256k1 private key. All signing material remains in the active browser session only.

## Quick start

Requirements:

- Docker with Compose support.

```bash
git clone https://github.com/Kolyn236/wallet-generator.git
cd wallet-generator
cp .env.example .env
docker compose up --build
```

Open `http://localhost:8080`.

Health endpoint:

```text
GET http://localhost:8080/api/health
```

Stop the stack:

```bash
docker compose down
```

## Runtime configuration

```dotenv
DOGE_RECOMMENDED_FEE_RATE=0.01
BTC_RECOMMENDED_FEE_RATE=0.00010000
ETHEREUM_RPC_URL=
```

`ETHEREUM_RPC_URL` is required for ETH balance/prepare/broadcast operations. Configure an Ethereum Mainnet JSON-RPC URL through deployment secrets/runtime environment. The backend checks `eth_chainId == 1` before Ethereum operations and fails closed on another EVM network.

DOGE/BTC fee-rate values remain operator-controlled defaults. Ethereum fee preparation uses live provider state through `eth_estimateGas` and `eth_feeHistory`.

For deployment-time overrides:

```bash
sh scripts/build-deploy-env.sh /etc/wallet-platform/runtime.env .env
docker compose up -d --force-recreate php
```

See `deploy/README.md`.

## Stack

- PHP 8.4;
- Symfony 7.4 LTS;
- React 19 + TypeScript;
- Vite;
- Nginx + PHP-FPM;
- Docker Compose;
- PHPUnit, PHPStan, PHP-CS-Fixer;
- GitHub Actions.

PostgreSQL, Redis and RabbitMQ are not required by the current runtime. Add persistence, cache, queues or indexing only for concrete product/load requirements.

## Security model

The application is non-custodial.

```text
seed / WIF / private key
          |
          v
     browser memory
          |
          +--> address derivation / key-address verification
          |
          +--> local transaction signing
          |
          v
 signed raw transaction
          |
          v
Symfony blockchain gateway
          |
          v
    node / provider
```

Core rules:

- Symfony never receives seed phrases, WIFs or private keys;
- plaintext signing material is not persisted in localStorage, sessionStorage, IndexedDB, cookies or backend storage;
- created wallet secrets live only in browser memory and disappear when the session is lost;
- signing and broadcast are separate explicit actions;
- external providers receive public addresses/public transaction intent or signed raw transaction bytes only;
- unknown chain/network/asset routes fail closed;
- provider data is validated before it can influence signing;
- locally calculated transaction identity is compared with the provider-returned identity after broadcast.

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
Symfony -> provider
```

Amounts use integer smallest units internally (`koinu` / `satoshi`). DOGE/BTC spend confirmed UTXOs only. The browser calculates the local TXID and verifies the provider-returned TXID.

## Ethereum transfer flow

Native ETH uses an account-based EIP-1559 flow rather than UTXO semantics.

```text
Browser
from / to / valueWei / data=0x
        |
        v
Symfony -> Ethereum Mainnet JSON-RPC
        |
        +--> verify chainId = 1
        +--> sender balance
        +--> pending nonce
        +--> eth_estimateGas
        +--> eth_feeHistory
        |
        v
public preparation snapshot
        |
        v
Browser
verify private key <-> sender
sign Type-2 transaction locally
calculate local transaction hash
        |
        v
human-readable review
        |
        v
explicit broadcast
        |
        v
Symfony -> eth_sendRawTransaction
        |
        v
compare provider hash with local hash
```

The Type-2 signer encodes:

```text
0x02 || RLP([
  chainId,
  nonce,
  maxPriorityFeePerGas,
  maxFeePerGas,
  gasLimit,
  to,
  value,
  data,
  accessList,
  yParity,
  r,
  s
])
```

Native ETH transfers currently use an empty access list and `data = 0x`.

EVM quantities cross the backend Application/HTTP boundary as canonical decimal strings. Browser arithmetic uses `bigint`; wei/gas/nonce/fee values are never routed through JavaScript `number` or PHP floating point.

The current EIP-1559 wallet policy is:

```text
maxFeePerGas = 2 * baseFeePerGas + maxPriorityFeePerGas
```

This is a wallet policy, not an Ethereum protocol constant. Missing gas/fee data fails explicitly instead of falling back to a legacy `gasPrice` transaction.

Before signing, the browser conservatively checks that the sender balance can cover:

```text
valueWei + gasLimit * maxFeePerGas
```

## Backend API

Dogecoin:

```text
GET  /api/chains/dogecoin/mainnet/fee-policy
GET  /api/chains/dogecoin/mainnet/addresses/{address}/balance
GET  /api/chains/dogecoin/mainnet/addresses/{address}/utxos
POST /api/chains/dogecoin/mainnet/transactions/broadcast
```

Bitcoin:

```text
GET  /api/chains/bitcoin/mainnet/fee-policy
GET  /api/chains/bitcoin/mainnet/addresses/{address}/balance
GET  /api/chains/bitcoin/mainnet/addresses/{address}/utxos
POST /api/chains/bitcoin/mainnet/transactions/broadcast
```

Ethereum:

```text
GET  /api/chains/ethereum/mainnet/addresses/{address}/balance
POST /api/chains/ethereum/mainnet/transactions/prepare
POST /api/chains/ethereum/mainnet/transactions/broadcast
```

Ethereum prepare accepts only:

```text
from
to
valueWei
data
```

Broadcast accepts only `rawTransaction`. Symfony never signs Ethereum transactions.

## Frontend runtime model

Wallet identity is network-scoped while balances and execution behavior are asset-route-scoped.

```text
ethereum-mainnet wallet session
address: 0x...

eth-ethereum-mainnet-native       -> live native ETH balance/transfer
usdt-ethereum-mainnet-erc20       -> planned token balance/transfer
```

This lets ETH and future ERC-20 assets share one Ethereum account identity without sharing balances or transfer implementations.

Runtime lookup is explicit:

- `WalletNetworkAdapter` selects wallet identity/creation/address validation by network;
- `AssetRouteAdapter` selects balance/transfer behavior by asset route;
- backend `ChainAdapterRegistry` selects capabilities by exact `chain:network`;
- no registry has a default/fallback asset adapter.

See `docs/architecture/ADAPTER_REGISTRY.md`.

## Development

Backend:

```bash
cd backend
composer install
composer test
composer analyse
composer cs:check
```

Frontend:

```bash
cd frontend
npm ci
npm run test:adapter-invariants
npm run test:dogecoin-vector
npm run test:bitcoin-vector
npm run test:ethereum-vector
npm run build
npm run dev
```

Ethereum deterministic coverage includes BIP39/BIP44 derivation and a public EIP-1559 Type-2 serialization/hash vector. Tests do not require funded accounts or a live Ethereum RPC provider.

Production-like local build:

```bash
docker compose up --build
```

## CI

`Quality Gate` runs source checks, backend tests/static analysis/style, frontend adapter invariants, deterministic DOGE/BTC/ETH vectors and the TypeScript/Vite build.

`Integration Smoke` owns Docker/Compose runtime checks and is restricted to deploy/runtime-sensitive changes on `main` or manual execution.

## Architecture docs

- `docs/architecture/ADR-001-modular-monolith.md`
- `docs/architecture/MODULE_BOUNDARIES.md`
- `docs/architecture/ADAPTER_REGISTRY.md`
- `docs/architecture/ETHEREUM_BACKEND.md`

## Roadmap

Near-term work is intentionally narrow:

1. USDT ERC-20 on the existing `ethereum-mainnet` wallet identity;
2. fee-estimation and transaction-review improvements;
3. production observability, load testing and operational hardening.

Additional chains, token routes, persistence, queues, indexers or browser vault features should be introduced only for a concrete product or load requirement.
