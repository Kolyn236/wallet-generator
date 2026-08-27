# Wallet Platform

A multi-chain non-custodial wallet platform being migrated from the original educational Dogecoin Python wallet lab.

The target application is a **Symfony 7.4 modular monolith + React/TypeScript frontend**. The V1 backend is intentionally stateless: private keys and seed phrases stay in the browser, while Symfony acts as a blockchain API gateway.

> [!WARNING]
> This project is under active development and has not been professionally audited. Do not use it for substantial funds. Never put WIF/private keys/seed phrases into issues, logs, screenshots or external services.

## Current status

The primary application entry point is now the React/Symfony stack:

```text
Browser
   |
   |  wallet/session state + local DOGE signer
   v
Nginx :8080
   |---- / ----------> React + TypeScript
   |
   +---- /api/* -----> Symfony / PHP-FPM
                         |
                         +--> blockchain nodes/providers
```

The frontend is multi-asset and network-aware:

- DOGE / Dogecoin mainnet;
- BTC / Bitcoin mainnet;
- ETH / Ethereum mainnet;
- USDT with ERC-20 and TRC-20 routes.

DOGE is the first live integration. The application can create a Dogecoin wallet locally in browser memory, attach an existing public address in watch-only mode, load confirmed balance/UTXOs, build and sign a legacy P2PKH transaction locally, review the resulting fee/change/TXID and explicitly broadcast the already-signed raw transaction through Symfony.

BTC, ETH and USDT are present in the multi-wallet UI but their chain adapters are not connected yet.

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

Open:

```text
http://localhost:8080
```

Symfony health endpoint:

```text
http://localhost:8080/api/health
```

Stop the stack:

```bash
docker compose down
```

## Runtime configuration

Operator defaults that must be changeable without rebuilding the React bundle are read by Symfony from runtime environment variables.

Current DOGE fee default:

```dotenv
DOGE_RECOMMENDED_FEE_RATE=0.01
```

For Docker Compose, put the override in the repository-root `.env` file and recreate/restart the PHP runtime:

```bash
# .env
DOGE_RECOMMENDED_FEE_RATE=0.02

docker compose up -d --force-recreate php
```

No frontend rebuild is required. React fetches the current policy from Symfony with `cache: no-store`.

## Stack

- PHP 8.4;
- Symfony 7.4 LTS;
- React 19 + TypeScript;
- Vite;
- Nginx + PHP-FPM;
- Docker Compose;
- PHPUnit, PHPStan, PHP-CS-Fixer and GitHub Actions.

PostgreSQL, Redis and RabbitMQ are **not required by the V1 runtime**. They may be introduced later only for concrete infrastructure needs such as a public blockchain indexer, cache/rate limiting or asynchronous background processing.

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
- an arbitrary existing DOGE sender may be used by entering its matching WIF directly in the transfer form; that WIF remains browser-local;
- external providers receive public addresses/transaction data or already-signed raw transaction bytes only;
- signing and broadcast are explicit separate operations;
- amounts use integer smallest units internally;
- the DOGE transfer implementation spends only confirmed UTXOs and validates that every selected UTXO script belongs to the specified source address before signing.

## DOGE transfer flow

The transfer form is independent from the wallet tile. A selected/created wallet can prefill the sender, but any valid DOGE P2PKH sender address can be used if the matching WIF is supplied locally.

```text
Sender DOGE address + matching WIF
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

The operator-recommended fee rate is supplied by Symfony at runtime from:

```dotenv
DOGE_RECOMMENDED_FEE_RATE=0.01
```

The default unit is `DOGE/kB`. The signer calculates the actual network fee from the final signed transaction byte size.

The user may override the recommended positive rate in the transfer form. A custom value is explicitly marked as a user override because a rate that is too low may delay or prevent relay and a rate that is too high may overpay. The final actual fee is always shown before broadcast.

Outputs below `0.01 DOGE` are avoided in this first implementation, matching the safety convention already used by the Python reference tool.

## Backend API used by DOGE

```text
GET  /api/chains/dogecoin/mainnet/fee-policy
GET  /api/chains/dogecoin/mainnet/addresses/{address}/balance
GET  /api/chains/dogecoin/mainnet/addresses/{address}/utxos
POST /api/chains/dogecoin/mainnet/transactions/broadcast
```

The fee-policy endpoint is public, read-only and non-cacheable. The broadcast endpoint accepts only a signed raw transaction. It recomputes the local TXID and requires the provider response to return the same transaction identity.

## Frontend flow

The main UI is a multi-wallet dashboard.

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
Transfer form
    |
    v
Load runtime fee policy
    |
    v
Local sign/review when the selected chain supports it
    |
    v
Explicit broadcast
```

For token assets the network is a first-class choice. For example USDT currently exposes both `ERC-20` and `TRC-20`, so the frontend is not built around the incorrect assumption that one asset always belongs to one blockchain.

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

1. Symfony modular boundaries and architecture tests;
2. React multi-wallet / multi-network application shell;
3. client-side DOGE wallet creation and signing boundary (RAM only);
4. Dogecoin balance / UTXO / signed broadcast gateway APIs;
5. DOGE local build / sign / review / broadcast flow;
6. deterministic parity tests between the browser signer and Python reference vectors;
7. optional cache/indexer infrastructure only when load requires it;
8. Bitcoin adapter;
9. EVM + token adapters;
10. encrypted local browser vault;
11. production hardening, observability and load testing.

The existing Python runtime is removed only after feature parity is demonstrated.
