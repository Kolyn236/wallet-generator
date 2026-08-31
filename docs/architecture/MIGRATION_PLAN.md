# Migration plan: Wallet Platform

## Status

The runtime migration is complete.

The project originally began as an educational Dogecoin wallet lab. The supported application is now the Symfony + React/TypeScript platform, and the legacy runtime has passed its retirement milestone. Historical source remains available through Git history rather than as a second runnable implementation.

## Supported platform

- PHP 8.4;
- Symfony 7.4 LTS;
- React + TypeScript + Vite;
- Nginx + PHP-FPM;
- Docker Compose;
- GitHub Actions;
- browser-local DOGE/BTC wallet creation and signing;
- Symfony blockchain API gateway;
- capability-based chain/network adapters.

PostgreSQL, Redis and RabbitMQ are not required by the current V1 runtime. They remain possible future infrastructure when persistence, indexing, rate limiting or asynchronous processing has a concrete requirement.

## Completed migration milestones

### 1. Symfony bootstrap and module boundaries

The repository has a Symfony backend with health endpoint, tests, static analysis, coding standards, Docker integration and architecture boundary tests.

### 2. React application shell

The browser UI is implemented in React/TypeScript and served through the integrated Nginx platform.

### 3. Browser-local Dogecoin runtime

DOGE wallet creation, address validation, UTXO transaction construction/signing and review happen in browser memory. Symfony handles public chain data and signed-transaction broadcast only.

### 4. Browser-local Bitcoin runtime

BTC mainnet legacy P2PKH wallet creation/signing follows the same non-custodial boundary while keeping Bitcoin-specific constants and serialization isolated.

### 5. Normalized asset catalog and adapter registries

Frontend routes and wallet-network behavior are registry-driven. Backend chain behavior is exposed through capability-based adapters keyed by exact chain/network identity. Unknown and planned routes fail closed.

### 6. Deterministic regression coverage

DOGE and BTC derivation/signing are protected by deterministic TypeScript vectors. Adapter invariants are enforced in both frontend and backend CI.

### 7. Legacy runtime retirement

The obsolete application source, alternate local UI/documentation and CI runtime have been removed. The supported development and CI workflows no longer require a second language runtime.

## Post-retirement rules

- React/TypeScript is authoritative for browser wallet creation and signing.
- Symfony is authoritative for the supported blockchain gateway/API layer.
- Seed/private key/WIF stays browser-local and never enters Symfony.
- Signing and broadcast remain separate explicit operations.
- Deterministic TypeScript vectors are the regression oracle for current DOGE/BTC signers.
- Runtime integrations go through the frontend/backend adapter registries.
- Unknown or unimplemented routes fail closed.
- Historical implementation details should be recovered from Git history when needed rather than restored as a parallel runtime.

## Next platform phases

Future work may include:

1. Bitcoin SegWit/Taproot and dynamic fee estimation;
2. EVM and token routes with chain-family-specific capabilities;
3. optional own-node/indexer infrastructure;
4. persistence/cache/queue components only when product/load requirements justify them;
5. encrypted browser-local vault UX;
6. observability, security review, recovery runbooks and load testing at production targets.
