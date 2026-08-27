# Wallet Platform

A multi-chain non-custodial wallet platform in active migration from the original educational Dogecoin Python wallet lab.

The target application is a **Symfony 7.4 modular monolith + React/TypeScript frontend** with PostgreSQL, Redis and RabbitMQ. Dogecoin is the first chain; Bitcoin and EVM-family support are planned after the chain boundaries are proven.

> [!WARNING]
> This project is still under active migration and has not been professionally audited. Do not use it for substantial funds. Never put WIF/private keys/seed phrases into issues, logs, screenshots or external services.

## Current status

The new platform shell is now the primary application entry point:

```text
Browser
   |
   v
Nginx :8080
   |---- / ----------> React + TypeScript
   |
   +---- /api/* -----> Symfony / PHP-FPM
                         |
              +----------+----------+
              |          |          |
          PostgreSQL   Redis     RabbitMQ
```

The React UI currently verifies that the Symfony backend is online and shows the migration state. Wallet creation, balance, send, CPFP and broadcast are still being moved from the Python reference implementation into Symfony APIs. The new UI intentionally does **not** request WIF/private keys/seeds yet.

## Quick start

Requirements:

- Docker with Compose support.

Start the complete local platform:

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

RabbitMQ management UI is available locally at:

```text
http://localhost:15672
```

Default local RabbitMQ credentials come from the development container (`guest` / `guest`) and must not be reused as production credentials.

Stop the stack:

```bash
docker compose down
```

Remove the local PostgreSQL volume too:

```bash
docker compose down -v
```

## Stack

- PHP 8.4;
- Symfony 7.4 LTS;
- React 19 + TypeScript;
- Vite;
- Nginx + PHP-FPM;
- PostgreSQL 18;
- Redis 8;
- RabbitMQ 4;
- Docker Compose;
- PHPUnit, PHPStan, PHP-CS-Fixer and GitHub Actions.

## Backend architecture

The Symfony backend is one modular monolith with separate business boundaries:

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

The Nginx container builds the React frontend from the committed npm lock file and serves it as static assets while forwarding `/api/*` to Symfony.

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

## Security invariants

- never transmit or log WIF/private keys/seed phrases;
- never persist plaintext signing material in PostgreSQL, Redis, browser storage or analytics;
- external providers receive public addresses/transaction data or already-signed raw transaction bytes only;
- signing and broadcast remain explicit separate operations;
- amounts use integer smallest units internally;
- production custody, if ever introduced, requires a dedicated signer backed by a KMS/Vault/HSM-style boundary;
- the hand-written Python crypto remains educational/reference code until a production signing design is explicitly approved.

## Migration roadmap

1. Symfony modular boundaries and architecture tests;
2. PostgreSQL persistence, Redis and Messenger/RabbitMQ wiring;
3. Dogecoin chain adapter with parity tests against Python;
4. transaction engine with idempotency, UTXO reservation and transactional outbox;
5. React wallet/balance/send flows backed by Symfony APIs;
6. own Dogecoin Core/indexer path and confirmation tracking;
7. Bitcoin adapter;
8. EVM adapter;
9. production hardening, observability and load testing.

The existing Python runtime is removed only after feature parity is demonstrated.
