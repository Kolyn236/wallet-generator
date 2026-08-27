# ADR-001: Symfony modular monolith

## Status
Accepted for migration.

## Context
The repository is a working educational Dogecoin wallet laboratory in Python. The target is a multi-chain wallet platform that can later run in production, support multiple wallets/assets, expose balance and transaction APIs, and scale to at least 300 RPS without coupling every request to a third-party blockchain API.

The Python implementation remains the reference implementation during migration and must keep working until equivalent behavior is covered by tests in the new backend.

## Decision
Use a modular monolith with:

- PHP 8.4;
- Symfony 7.4 LTS;
- PostgreSQL as system of record;
- Redis for cache, rate limiting and distributed locks;
- RabbitMQ through Symfony Messenger;
- React + TypeScript + Vite for the web UI;
- Nginx + PHP-FPM for HTTP;
- one repository and one backend deployable artifact;
- separate runtime processes for HTTP and Messenger workers.

A monolith is not a single process. The same Symfony codebase may run as PHP-FPM, transaction consumers, blockchain consumers and notification consumers.

## Module boundaries
Initial backend modules:

- `Wallet` — wallets, addresses and ownership metadata;
- `Asset` — chains, networks, native assets and tokens;
- `Transaction` — lifecycle, idempotency and transaction orchestration;
- `Blockchain` — chain-neutral ports and concrete chain adapters;
- `Signer` — signing boundary and key references;
- `Indexer` — chain synchronization, UTXO/nonce state and confirmations.

Modules use `Domain`, `Application`, `Infrastructure` and `Presentation` layers where needed. Domain code must not depend on Symfony, Doctrine, RabbitMQ, Redis, HTTP clients or provider SDKs.

## Chain model
Do not force all currencies into one `CryptoWallet::create/balance/send` abstraction. UTXO chains and account-based chains have different transaction semantics.

Examples:

- UTXO: Dogecoin, Bitcoin, Litecoin;
- account-based: Ethereum/EVM.

Use capabilities and chain adapters. Dogecoin is the first adapter.

## Async processing
Symfony Messenger is the application message bus. RabbitMQ is the initial asynchronous transport.

Initial transports:

- `transactions`;
- `blockchain`;
- `notifications`.

Workers are separate processes but use the same repository, Symfony container, domain model and PostgreSQL database.

Normal read endpoints are synchronous and read Redis/PostgreSQL. Chain refresh, broadcasting/retries, block synchronization and confirmation checks may be asynchronous.

## Consistency rules
Financial writes require:

- idempotency keys;
- PostgreSQL transactions;
- UTXO reservation to prevent double selection;
- nonce management for account-based chains;
- transactional outbox before relying on RabbitMQ delivery;
- explicit transaction state transitions.

Initial transaction states:

`CREATED -> PREPARING -> PREPARED -> SIGNED -> BROADCASTING -> MEMPOOL -> CONFIRMED`

Additional states may include `FAILED`, `DROPPED`, `REPLACED`, `CANCELLED`.

## Security boundary
No production database column may contain plaintext WIF/private keys/seed phrases.

Prefer non-custodial signing where practical. If server-side custody is introduced later, private material must be delegated to a dedicated signing boundary backed by KMS/Vault/HSM-style infrastructure and referenced by key identifier.

The existing Python crypto implementation remains educational/reference code until a production signing design is explicitly approved.

## Migration rule
No big-bang rewrite.

1. Preserve current Python behavior.
2. Introduce Symfony beside it.
3. Add PostgreSQL/Redis/RabbitMQ infrastructure.
4. Add module boundaries and chain-neutral contracts.
5. Migrate DOGE behavior with deterministic parity tests.
6. Move the UI to React after APIs stabilize.
7. Retire Python runtime paths only after parity is demonstrated.

## Consequences
This keeps development familiar, allows HTTP and workers to scale independently, preserves the existing working implementation during migration, and leaves clear extraction points if a future indexer or signer truly needs to become a separate service.