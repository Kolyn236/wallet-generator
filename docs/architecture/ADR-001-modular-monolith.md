# ADR-001: Symfony modular monolith

## Status

Accepted. This ADR describes the supported Symfony modular-monolith architecture and its extension boundaries.

## Context

The project is a multi-chain non-custodial wallet platform with a React/TypeScript browser runtime and a Symfony backend.

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

PostgreSQL, Redis, RabbitMQ and Messenger are optional infrastructure rather than mandatory runtime dependencies. Add them only for concrete persistence, indexing, caching, rate-limiting or asynchronous-processing requirements.

## Module boundaries

Backend modules:

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

Use chain-family-aware capabilities and exact chain/network adapter identity. Current registered backend keys are:

```text
dogecoin:mainnet
bitcoin:mainnet
litecoin:mainnet
ethereum:mainnet
tron:mainnet
```

Unknown keys and unsupported capabilities fail closed.

## Non-custodial signing boundary

Wallet creation and transaction signing are browser responsibilities.

Symfony may receive:

- public addresses;
- public balance/UTXO/transaction-preparation requests;
- unsigned public transaction intent and status queries.

Symfony must not receive or persist plaintext WIF/private keys/seed phrases. It also does not accept signed transactions for publication or expose a broadcast API. Browser-side direct/custom providers or explicit signed-payload export keep publication under user control; no mandatory relay is introduced. See `../SECURITY_MODEL.md` for trust assumptions.

If server-side custody is ever proposed, it requires a separate architecture/security decision and a dedicated KMS/Vault/HSM-style signing boundary. It must not be introduced as an incremental shortcut.

## Provider boundary

External explorers/providers are Infrastructure implementations, not sources of wallet authority. Application code depends on capabilities/ports. Provider responses are validated, and transaction identity is validated locally where the browser signer supports it.

A node/RPC provider can replace a third-party provider without changing browser signing behavior or public API contracts.

## Supported runtime boundary

The repository has one supported React/Symfony runtime.

Current platform invariants include:

1. DOGE browser wallet creation/signing is implemented;
2. BTC browser wallet creation/signing is implemented;
3. deterministic frontend signer vectors protect both live UTXO integrations;
4. Symfony exposes the supported blockchain gateway APIs;
5. Ethereum Mainnet backend state/preparation capabilities are registered at `ethereum:mainnet`, without broadcast;
6. frontend/backend adapter registries have fail-closed architecture tests;
7. Docker and CI validate the supported platform directly.

Do not introduce a parallel application runtime or restore retired implementation paths as supported alternatives.

## Consequences

The repository has one clear supported architecture while retaining explicit module and provider extraction points. Browser-local signing preserves the non-custodial trust boundary, capability adapters keep chain differences visible, and optional infrastructure can be added later without requiring a premature microservice split.
