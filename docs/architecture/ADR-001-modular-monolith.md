# ADR-001: Symfony modular monolith

## Status

Accepted. The initial runtime migration is complete; this ADR describes the supported Symfony modular-monolith architecture and its extension boundaries.

## Context

The project originated as an educational Dogecoin wallet lab and has evolved into a multi-chain non-custodial wallet platform. The supported runtime is now React/TypeScript in the browser plus a Symfony backend. Historical implementation code is retained by Git history, not as a parallel application runtime.

The platform must support multiple chains/assets without forcing UTXO, EVM and other chain families into one misleading transaction abstraction. Wallet secrets must remain outside the Symfony trust boundary.

## Decision

Use a modular monolith with:

- PHP 8.4;
- Symfony 7.4 LTS;
- React + TypeScript + Vite for the web UI;
- Nginx + PHP-FPM for HTTP;
- Docker Compose for the integrated local runtime;
- one repository and one backend deployable artifact;
- explicit chain/network adapters and capability interfaces;
- GitHub Actions for deterministic, architecture, backend and integration checks.

PostgreSQL, Redis, RabbitMQ and Messenger are optional future infrastructure rather than mandatory V1 runtime dependencies. Add them only for concrete persistence, indexing, caching, rate-limiting or asynchronous-processing requirements.

## Module boundaries

Initial backend modules:

- `Wallet` — wallet/address concepts and ownership metadata when needed;
- `Asset` — chains, networks, native assets and tokens;
- `Transaction` — transaction lifecycle/orchestration when server-side workflow state is introduced;
- `Blockchain` — application capabilities and concrete chain adapters;
- `Signer` — reserved signing-boundary concepts; current non-custodial signing stays in the browser;
- `Indexer` — chain synchronization/read models when introduced.

Modules use `Domain`, `Application`, `Infrastructure` and `Presentation` layers where needed. Domain code must not depend on Symfony, Doctrine, RabbitMQ, Redis, HTTP clients or provider SDKs.

Dependency direction:

```text
Presentation -> Application <- Infrastructure
                    |
                    v
                  Domain
```

Presentation must not import Infrastructure directly. Application owns capabilities/ports; Infrastructure implements them.

## Chain model

Do not force all currencies into one `CryptoWallet::create/balance/send` abstraction. UTXO and account-based chains have different transaction, fee and state semantics.

Use chain-family-aware capabilities and exact chain/network adapter identity. Current live backend keys are:

```text
dogecoin:mainnet
bitcoin:mainnet
```

Unknown keys and unsupported capabilities fail closed.

## Non-custodial signing boundary

Wallet creation and transaction signing are browser responsibilities.

Symfony may receive:

- public addresses;
- public balance/UTXO requests;
- already-signed raw transactions.

Symfony must not receive or persist plaintext WIF/private keys/seed phrases.

If server-side custody is ever proposed, it requires a separate architecture/security decision and a dedicated KMS/Vault/HSM-style signing boundary. It must not be introduced as an incremental shortcut.

## Provider boundary

External explorers/providers are Infrastructure implementations, not sources of wallet authority. Application code depends on capabilities/ports. Provider responses are validated, and locally calculated transaction identity is checked against the provider response after broadcast.

A future node/RPC provider can replace third-party HTTP providers without changing browser signing behavior or public API contracts.

## Runtime-retirement checkpoint

The migration checkpoint for retiring the original educational runtime has been satisfied:

1. DOGE browser wallet creation/signing is implemented;
2. BTC browser wallet creation/signing is implemented;
3. deterministic frontend signer vectors protect both live UTXO integrations;
4. Symfony exposes the supported blockchain gateway APIs;
5. frontend/backend adapter registries have fail-closed architecture tests;
6. Docker and CI validate the supported platform directly.

The retired implementation should not be restored as a required runtime, CI dependency or supported alternative. Historical code remains accessible through repository history.

## Consequences

The repository has one clear supported architecture while retaining explicit module and provider extraction points. Browser-local signing preserves the non-custodial trust boundary, capability adapters keep chain differences visible, and optional infrastructure can be added later without requiring a premature microservice split.
