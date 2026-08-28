# Wallet Platform

A multi-chain non-custodial wallet platform being migrated from the original educational Dogecoin Python wallet lab.

The target application is a **Symfony 7.4 modular monolith + React/TypeScript frontend**. The V1 backend is intentionally stateless: private keys and seed phrases stay in the browser, while Symfony acts as a blockchain API gateway.

> [!WARNING]
> This project is under active development and has not been professionally audited. Do not use it for substantial funds. Never put WIF/private keys/seed phrases into issues, logs, screenshots or external services.

## Current status

The primary application entry point is the React/Symfony stack:

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
                         +--> blockchain nodes/providers
```

The frontend is multi-asset and network-aware:

- DOGE / Dogecoin mainnet — live;
- BTC / Bitcoin mainnet — live for legacy P2PKH (`1...`) addresses;
- ETH / Ethereum mainnet — planned;
- USDT with ERC-20 and TRC-20 routes — planned.

DOGE and BTC can both create wallets locally in browser memory, attach existing public addresses in watch-only mode, load confirmed balance/UTXOs, build and sign legacy P2PKH transactions locally, review fee/change/TXID and explicitly broadcast the already-signed raw transaction through Symfony.

Bitcoin wallet creation uses BIP39 + BIP44 with derivation path `m/44'/0'/0'/0/0`. The first BTC integration intentionally supports mainnet legacy P2PKH only; SegWit (`bc1...`) is a separate follow-up because it changes address/script and transaction-signing rules.

## Quick start

Requirements:

- Docker with Compose support.

Start the local platform:

```bash
git clone https://github.com/Kolyn236/doge-wallet-generator.git
cd doge-wallet-generator
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
```

The BTC default is expressed as `BTC/kB`; `0.00010000 BTC/kB` equals `10,000 sat/kB`, or about `10 sat/vB` for legacy transactions. This is currently an operator-controlled default, **not a live mempool fee estimator**. The user can override the rate in the review flow.

For Docker Compose, put overrides in the repository-root `.env` and recreate/restart PHP:

```bash
# .env
DOGE_RECOMMENDED_FEE_RATE=0.02
BTC_RECOMMENDED_FEE_RATE=0.00020000

docker compose up -d --force-recreate php
```

React fetches the current fee policies from Symfony with `cache: no-store`.

## Stack

- PHP 8.4;
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
- amounts use integer smallest units internally (`koinu` / `satoshi`);
- DOGE and BTC transfers spend only confirmed UTXOs and validate that each selected UTXO script belongs to the specified source address before signing;
- the TXID is calculated locally and compared with the provider-returned TXID after broadcast.

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

`DOGE_RECOMMENDED_FEE_RATE` uses `DOGE/kB`. The signer calculates the actual network fee from final signed transaction byte size. Outputs below `0.01 DOGE` are avoided in the first DOGE implementation, matching the safety convention used by the Python reference tool.

### BTC network fee policy

`BTC_RECOMMENDED_FEE_RATE` uses `BTC/kB`. Internally the browser signer converts the decimal BTC value to integer satoshis and calculates the actual fee from the final signed legacy transaction byte size. P2PKH outputs below `546 sat` are treated as dust and are not created as destination/change outputs.

A custom fee rate is explicitly shown as a user override. Too-low rates may delay or prevent relay; too-high rates may overpay.

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

Balance/UTXO endpoints accept public addresses only. Broadcast endpoints accept only signed raw transactions, recompute the local TXID and require the provider response to return the same transaction identity.

The current infrastructure adapter uses BlockCypher. Provider-specific HTTP logic stays behind application ports so a node/RPC adapter can replace it without changing browser signing rules.

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

For token assets the network is a first-class choice. For example USDT already exposes both `ERC-20` and `TRC-20` in the UI model even though those adapters are not implemented yet.

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
- `docs/architecture/MIGRATION_PLAN.md`

## Development

### Symfony backend

```bash
cd backend
composer install
composer test
composer analyse
composer cs:check
```

### React frontend

```bash
cd frontend
npm ci
npm run dev
```

Vite runs on `http://localhost:5173` and proxies `/api` calls to the integrated platform on `http://localhost:8080`.

Production-like local build:

```bash
docker compose up --build
```

The Nginx image builds React from the committed npm lock file, serves the static frontend and forwards `/api/*` to Symfony.

## Python Dogecoin wallet lab

The original pure-Python implementation is intentionally preserved as a **reference implementation** during migration. It contains the educational secp256k1/P2PKH/WIF/transaction implementation and remains useful for deterministic parity tests.

Run its self-test:

```bash
python3 doge_wallet.py --self-test
```

The old local Python UI can still be started for reference:

```bash
python3 web_app.py --open
```

It is no longer the target application architecture and will be retired only after equivalent Symfony/React behavior is covered by parity tests.

The original detailed guide is preserved in `docs/PYTHON_WALLET_LAB.md`; the older browser-flow notes remain in `WEB_UI.md` while migration is in progress.

## Migration roadmap

1. Symfony modular boundaries and architecture tests — done;
2. React multi-wallet / multi-network application shell — done;
3. client-side DOGE wallet creation/signing + blockchain gateway — done;
4. client-side BTC legacy P2PKH wallet creation/signing + blockchain gateway — done;
5. deterministic browser signer vectors/parity coverage;
6. Bitcoin SegWit (`bc1...`) and fee-estimation improvements;
7. EVM + token adapters;
8. optional cache/indexer infrastructure only when load requires it;
9. encrypted local browser vault;
10. production hardening, observability and load testing.

The existing Python runtime is removed only after feature parity is demonstrated.
