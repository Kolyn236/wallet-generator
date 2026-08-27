# Migration plan: Python Doge Wallet Lab -> Symfony Wallet Platform

## Goal
Evolve the repository incrementally into a production-oriented modular monolith while keeping the existing Python Dogecoin flow usable as a reference implementation during the migration.

## Target stack

- PHP 8.4
- Symfony 7.4 LTS
- PostgreSQL
- Redis
- RabbitMQ + Symfony Messenger
- React + TypeScript + Vite
- Nginx + PHP-FPM
- Docker Compose locally
- GitHub Actions CI
- Prometheus/Grafana, OpenTelemetry and Sentry later in the production-readiness phase

## Phase 1 — Symfony bootstrap

Create `backend/` with a minimal Symfony application. Add health endpoint, PHPUnit, static analysis, coding standards and Docker development environment. Keep all Python files untouched.

Acceptance criteria:

- `docker compose up` starts PHP, Nginx, PostgreSQL, Redis and RabbitMQ;
- `GET /api/health` returns success;
- PHPUnit and static analysis run in CI;
- no DOGE behavior has been removed or changed.

## Phase 2 — Modular boundaries

Create empty module skeletons for `Wallet`, `Asset`, `Transaction`, `Blockchain`, `Signer`, `Indexer`. Establish dependency rules and architecture tests.

Acceptance criteria:

- Domain code has no framework/infrastructure dependencies;
- controllers contain transport concerns only;
- application handlers orchestrate use cases;
- provider-specific code lives under Infrastructure.

## Phase 3 — Persistence and read model

Introduce Doctrine DBAL/ORM where appropriate and migrations for wallets, addresses, assets, balances, transactions, UTXOs, idempotency keys, outbox messages and provider health.

Do not persist plaintext private keys, WIFs or seed phrases.

## Phase 4 — Messenger + RabbitMQ

Configure transports `transactions`, `blockchain`, `notifications` and failed-message handling. Add worker containers using the same backend image.

Start with infrastructure only; do not make every request asynchronous.

## Phase 5 — Dogecoin adapter

Implement chain-neutral ports and a Dogecoin adapter. First migrate read-only behavior: address validation, balance/UTXO lookup and provider abstraction. Then migrate transaction construction/broadcast with deterministic parity tests against the Python reference.

The production path must not blindly copy custom educational cryptography without an explicit review of trusted cryptographic dependencies and signing boundaries.

## Phase 6 — Transaction engine

Add:

- multi-input UTXO selection;
- UTXO reservation;
- transaction state machine;
- idempotent send API;
- transactional outbox;
- broadcast retries;
- confirmation tracking.

## Phase 7 — React UI

Move the current bilingual UI to React/TypeScript against stable Symfony APIs. Preserve human-readable review-before-broadcast behavior and RU/EN localization.

## Phase 8 — Own Dogecoin node and indexer

Add Dogecoin Core JSON-RPC provider and make third-party providers fallbacks. Implement synchronization/read models so balance requests do not fan out to external providers.

## Phase 9 — Load and production readiness

Load-test read/write scenarios at 300 RPS and above. Add rate limiting, observability, backups, secrets management, deployment runbooks, recovery procedures and security review.

## Phase 10 — Additional chains

Add Bitcoin next to validate the shared UTXO abstractions, then Ethereum/EVM to validate that the architecture does not assume UTXO semantics everywhere.