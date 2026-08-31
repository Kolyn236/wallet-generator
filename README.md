# Wallet Platform

A multi-chain non-custodial wallet platform built with a **Symfony 7.4 modular monolith + React/TypeScript frontend**.

The supported V1 backend is intentionally stateless: private keys and seed phrases stay in browser memory, while Symfony acts as a blockchain API gateway. The repository has one supported application runtime; the original educational Python wallet has been retired and remains available only through Git history.

> [!WARNING]
> This project is under active development and has not been professionally audited. Do not use it for substantial funds. Never put real WIF/private keys/seed phrases into issues, logs, screenshots or external services.

## Current status

The application entry point is the React/Symfony stack:

```text
Browser
   |
   |  wallet/session state + local DOGE/BTC signers
   v
Nginx :8080
   |---- / ----------> React + TypeScript
   |
   +---- /api/* -----> Symfony / PHP-FPM
                         |
                         +--> chain/network adapters
                                |
                                +--> blockchain nodes/providers
```

The frontend is multi-asset and network-aware:

- DOGE / Dogecoin mainnet — live;
- BTC / Bitcoin mainnet — live for legacy P2PKH (`1...`) addresses;
- ETH / Ethereum mainnet — frontend planned; backend Ethereum Mainnet RPC/capability adapter implemented;
- USDT with ERC-20 and TRC-20 routes — planned.

DOGE and BTC can both create wallets locally in browser memory, attach existing public addresses in watch-only mode, load confirmed balance/UTXOs, build and sign legacy P2PKH transactions locally, review fee/change/TXID and explicitly broadcast the already-signed raw transaction through Symfony.

The Ethereum backend can now validate Ethereum addresses, read native ETH balances, obtain a pending nonce, estimate gas for a public transaction intent, produce an EIP-1559 fee quote and broadcast an already-signed raw Ethereum transaction. It never creates or receives an Ethereum private key and does not make ETH live in the frontend yet.

Bitcoin wallet creation uses BIP39 + BIP44 with derivation path `m/44'/0'/0'/0/0`. Dogecoin uses `m/44'/3'/0'/0/0`. The first BTC integration intentionally supports mainnet legacy P2PKH only; SegWit (`bc1...`) is a separate follow-up because it changes address/script and transaction-signing rules.

## Quick start

Requirements:

- Docker with Compose support.

Start the local platform:

```bash
git clone https://github.com/Kolyn236/wallet-generator.git
cd wallet-generator
cp .env.example .env
docker compose up --build
```

Open `http://localhost:8080`.

Symfony health endpoint: `http://localhost:8080/api/health`.

Stop the stack:

```bash
docker compose down
```

## Runtime configuration

Operator defaults are read by Symfony from runtime environment variables, so changing them does not require rebuilding the React bundle.

```dotenv
DOGE_RECOMMENDED_FEE_RATE=0.01
BTC_RECOMMENDED_FEE_RATE=0.00010000
ETHEREUM_RPC_URL=
```

`ETHEREUM_RPC_URL` is required only when Ethereum endpoints are used. Configure it with an Ethereum Mainnet JSON-RPC endpoint through deployment secrets/runtime environment. Do not commit a real provider key. The backend verifies `eth_chainId == 1` before Ethereum state/broadcast operations and fails closed on another EVM network.

The BTC default is expressed as `BTC/kB`; `0.00010000 BTC/kB` equals `10,000 sat/kB`, or about `10 sat/vB` for legacy transactions. This is currently an operator-controlled default, **not a live mempool fee estimator**. The user can override the rate in the review flow.

For Docker Compose, put overrides in the repository-root `.env` and recreate/restart PHP:

```bash
# .env
DOGE_RECOMMENDED_FEE_RATE=0.02
BTC_RECOMMENDED_FEE_RATE=0.00020000
ETHEREUM_RPC_URL=https://your-mainnet-provider.example/secret

docker compose up -d --force-recreate php
```

React fetches the current UTXO fee policies from Symfony with `cache: no-store`.

## Stack

- PHP 8.4 with GMP for exact EVM integer arithmetic;
- Symfony 7.4 LTS;
- React 19 + TypeScript;
- Vite;
- Nginx + PHP-FPM;
- Docker Compose;
- PHPUnit, PHPStan, PHP-CS-Fixer and GitHub Actions.

PostgreSQL, Redis and RabbitMQ are **not required by the V1 runtime**. They may be introduced later for concrete infrastructure needs such as a public blockchain indexer, cache/rate limiting or asynchronous background processing.

## V1 security model

The application is non-custodial.

```text
seed/private key/WIF
      |
      v
browser memory / transfer form only
      |
      +--> address derivation / key-address verification
      |
      +--> transaction build + signing
      |
      v
signed raw transaction
      |
      v
Symfony blockchain gateway
      |
      v
node/provider
```

Rules:

- Symfony never receives WIF/private keys/seed phrases;
- plaintext signing material is not persisted in localStorage, sessionStorage, IndexedDB, cookies, PostgreSQL or Redis;
- locally created wallets keep unlocked secrets in browser RAM only, so F5 or closing the tab clears that wallet session;
- existing DOGE/BTC senders may be used by entering the matching WIF directly in the transfer form; that WIF remains browser-local;
- external providers receive public addresses/transaction data or already-signed raw transaction bytes only;
- signing and broadcast are explicit separate operations;
- DOGE/BTC amounts use integer smallest units internally (`koinu` / `satoshi`);
- Ethereum wei/nonce/gas/fee quantities cross Application/HTTP boundaries as canonical decimal strings and are never converted through PHP float or signed integer arithmetic;
- DOGE and BTC transfers spend only confirmed UTXOs and validate that each selected UTXO script belongs to the specified source address before signing;
- DOGE/BTC TXIDs are calculated locally and compared with the provider-returned TXID after broadcast;
- Ethereum broadcast accepts only the signed raw transaction; the future browser signer will calculate its local Ethereum transaction hash independently.

## UTXO transfer flow

DOGE and BTC currently share the same product flow while keeping chain-specific address/WIF constants and signing implementations isolated.

```text
Sender address + matching WIF
    |
    v
Recipient + amount + fee rate
    |
    v
Symfony: confirmed UTXO lookup for sender
    |
    v
Browser: verify WIF <-> sender
    |
    v
Browser: validate UTXO scripts
    |
    v
Browser: coin selection
    |
    v
Browser: build + sign P2PKH transaction
    |
    v
Review amount / fee rate / actual fee / change / local TXID
    |
    v
Explicit Broadcast button
    |
    v
Symfony: signed raw transaction only
    |
    v
Blockchain provider
```

### DOGE network fee policy

`DOGE_RECOMMENDED_FEE_RATE` uses `DOGE/kB`. The signer calculates the actual network fee from final signed transaction byte size. Outputs below `0.01 DOGE` are avoided in the first DOGE implementation as a conservative dust/safety convention.

### BTC network fee policy

`BTC_RECOMMENDED_FEE_RATE` uses `BTC/kB`. Internally the browser signer converts the decimal BTC value to integer satoshis and calculates the actual fee from the final signed legacy transaction byte size. P2PKH outputs below `546 sat` are treated as dust and are not created as destination/change outputs.

A custom fee rate is explicitly shown as a user override. Too-low rates may delay or prevent relay; too-high rates may overpay.

## Ethereum backend flow

The Ethereum backend is a public-state gateway for a future browser-local EIP-1559 signer.

```text
Browser public intent
(from / to / valueWei / data)
    |
    v
Symfony -> Ethereum Mainnet JSON-RPC
    |
    +--> verify chainId = 1
    +--> sender ETH balance
    +--> pending nonce
    +--> eth_estimateGas
    +--> eth_feeHistory
    |
    v
Public preparation snapshot
    |
    v
future browser-local signing
    |
    v
signed raw Type-2 transaction
    |
    v
Symfony -> eth_sendRawTransaction
```

The EIP-1559 quote currently uses a deterministic wallet policy based on `eth_feeHistory`:

```text
maxFeePerGas = 2 * baseFeePerGas + maxPriorityFeePerGas
```

This formula is a wallet fee-selection policy, not an Ethereum protocol constant. If required EIP-1559 data or gas estimation is unavailable, preparation fails explicitly instead of falling back to a legacy `gasPrice` transaction model.

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

Ethereum Mainnet backend:

```text
GET  /api/chains/ethereum/mainnet/addresses/{address}/balance
POST /api/chains/ethereum/mainnet/transactions/prepare
POST /api/chains/ethereum/mainnet/transactions/broadcast
```

The Ethereum prepare endpoint accepts only public `from`, `to`, `valueWei` and `data` fields. The broadcast endpoint accepts only `rawTransaction`. Neither accepts mnemonic/private-key/WIF fields and Symfony never signs Ethereum transactions.

DOGE/BTC balance/UTXO endpoints accept public addresses only. Broadcast endpoints accept only signed raw transactions. Provider-specific HTTP/RPC logic stays behind application capabilities so providers can be replaced without changing browser signing rules.

## Frontend flow

The main UI is a multi-wallet dashboard. DOGE and BTC maintain independent in-memory wallet sessions, so switching between assets does not overwrite the other wallet.

```text
Select asset
    |
    v
Select transfer network
    |
    v
Wallet workspace
    |
    v
Create local wallet or connect watch-only address
    |
    v
Load runtime fee policy + UTXOs
    |
    v
Local sign/review
    |
    v
Explicit broadcast
```

For token assets the network is a first-class choice. For example USDT already exposes both `ERC-20` and `TRC-20` in the UI model even though those adapters are not implemented yet. Ethereum backend availability does not make the ETH frontend route live by itself.

## Adapter registries

Runtime behavior is selected explicitly and fails closed:

- frontend wallet behavior is registered by network through `WalletNetworkAdapter`;
- frontend transfer behavior is registered by asset route through `AssetRouteAdapter`;
- backend blockchain behavior is registered by exact `chain:network` key through capability-based `ChainAdapter` implementations;
- backend `ethereum:mainnet` exposes EVM capabilities and intentionally does not expose UTXO capabilities;
- unknown, planned or unimplemented routes do not fall back to DOGE, BTC or another asset.

See `docs/architecture/ADAPTER_REGISTRY.md`.

## Backend architecture

The Symfony backend is one modular monolith with explicit business boundaries:

```text
backend/src/
  Wallet/
  Asset/
  Transaction/
  Blockchain/
  Signer/
  Indexer/
```

Business layers follow this direction:

```text
Presentation -> Application -> Domain
                    ^            ^
                    |            |
                 Infrastructure--+
```

Domain code remains independent from Symfony, Doctrine, Redis, RabbitMQ, HTTP clients and provider SDKs. Cross-module code must not reach into another module's `Infrastructure` or `Presentation` layer.

Architecture decisions:

- `docs/architecture/ADR-001-modular-monolith.md`
- `docs/architecture/MODULE_BOUNDARIES.md`
- `docs/architecture/ADAPTER_REGISTRY.md`
- `docs/architecture/MIGRATION_PLAN.md`

## Development

### Symfony backend

The PHP runtime/test environment needs the GMP extension for exact EVM integer arithmetic.

```bash
cd backend
composer install
composer test
composer analyse
composer cs:check
```

Ethereum tests use deterministic fake transports/fixtures; CI does not call a public Ethereum RPC endpoint and never requires funded accounts.

### React frontend

```bash
cd frontend
npm ci
npm run test:adapter-invariants
npm run test:dogecoin-vector
npm run test:bitcoin-vector
npm run build
npm run dev
```

Vite runs on `http://localhost:5173` and proxies `/api` calls to the integrated platform on `http://localhost:8080`.

Production-like local build:

```bash
docker compose up --build
```

The Nginx image builds React from the committed npm lock file, serves the static frontend and forwards `/api/*` to Symfony.

## Platform evolution

The project originally started as an educational Python Dogecoin wallet lab. That implementation has passed its runtime-retirement milestone; Git history preserves it for archaeology without keeping a second supported application path.

Completed platform milestones include:

1. Symfony modular boundaries and architecture tests;
2. React multi-wallet / multi-network application shell;
3. client-side DOGE wallet creation/signing + blockchain gateway;
4. client-side BTC legacy P2PKH wallet creation/signing + blockchain gateway;
5. frontend/backend adapter registries with fail-closed invariant tests;
6. deterministic DOGE and BTC browser derivation/signing vectors;
7. Ethereum Mainnet backend RPC/capability adapter for public state, EIP-1559 preparation and signed-raw broadcast.

Next roadmap items include the browser-local Ethereum wallet/signing flow, USDT ERC-20, Bitcoin SegWit and fee-estimation improvements, optional cache/indexer infrastructure when load requires it, an encrypted local browser vault, and production hardening/observability/load testing.
