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
   |  wallet/session state + future local signer
   v
Nginx :8080
   |---- / ----------> React + TypeScript
   |
   +---- /api/* -----> Symfony / PHP-FPM
                         |
                         +--> blockchain nodes/providers
```

The frontend is already multi-asset and network-aware:

- DOGE / Dogecoin mainnet;
- BTC / Bitcoin mainnet;
- ETH / Ethereum mainnet;
- USDT with ERC-20 and TRC-20 routes.

Selecting an asset changes the wallet workspace and transfer form. The transfer form currently creates a local preview only; signing and broadcast are intentionally not enabled until the client-side signing boundary and Dogecoin adapter are implemented.

## Quick start

Requirements:

- Docker with Compose support.

Start the local platform:

```bash
git clone https://github.com/Kolyn236/doge-wallet-generator.git
cd doge-wallet-generator
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
seed/private key
      |
      v
browser memory only
      |
      +--> address derivation / signing (next step)
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
- the first wallet version keeps unlocked secrets in browser RAM only, so F5 or closing the tab clears the wallet session;
- external providers receive public addresses/transaction data or already-signed raw transaction bytes only;
- signing and broadcast remain explicit separate operations;
- amounts use integer smallest units internally.

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
Local preview
    |
    v
local signing + broadcast (next implementation step)
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

Domain code must remain independent from Symfony, Doctrine, Redis, RabbitMQ, HTTP clients and provider SDKs. Cross-module code must not reach into another module's `Infrastructure` or `Presentation` layer.

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
3. client-side temporary wallet + signing boundary (RAM only);
4. Dogecoin gateway APIs and parity tests against Python;
5. DOGE balance / build / sign locally / broadcast flow;
6. optional cache/indexer infrastructure only when load requires it;
7. Bitcoin adapter;
8. EVM + token adapters;
9. encrypted local browser vault;
10. production hardening, observability and load testing.

The existing Python runtime is removed only after feature parity is demonstrated.
