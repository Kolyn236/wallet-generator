# AGENTS.md

## Project overview

`doge-wallet-generator` is a multi-chain non-custodial wallet platform.

The supported application architecture is:

- Symfony 7.4 backend / blockchain API gateway;
- React + TypeScript + Vite frontend;
- browser-local wallet creation and transaction signing;
- DOGE mainnet and BTC mainnet runtime adapters;
- Nginx + PHP-FPM;
- Docker Compose;
- GitHub Actions.

The original educational implementation has been retired from the application runtime. Do not introduce a parallel wallet implementation or an alternate signing path outside the supported React/Symfony architecture.

Before architecture work, read:

- `README.md`;
- `docs/architecture/ADR-001-modular-monolith.md`;
- `docs/architecture/MODULE_BOUNDARIES.md`;
- `docs/architecture/ADAPTER_REGISTRY.md`;
- `docs/architecture/MIGRATION_PLAN.md`.

## Core architecture rules

1. **Keep the platform non-custodial.** Wallet creation, key derivation and transaction signing stay in the browser.
2. **Symfony is a blockchain API gateway, not a signer.** It may receive public addresses, public transaction data and already-signed raw transactions, never wallet secrets.
3. **Keep module boundaries explicit.** Backend modules are `Wallet`, `Asset`, `Transaction`, `Blockchain`, `Signer`, and `Indexer`; only create layers/directories that have a concrete role.
4. **Domain code is framework-agnostic.** It must not depend directly on Symfony, Doctrine, Redis, RabbitMQ, HTTP clients or provider SDKs.
5. **Presentation does not import Infrastructure.** Application owns ports/capabilities; Infrastructure implements them.
6. **Do not force every chain into one universal wallet/blockchain interface.** UTXO, EVM and TRON semantics differ. Model concrete capabilities.
7. **Runtime lookup fails closed.** Unknown or unimplemented chain/network/asset routes must not resolve to another asset's adapter.
8. **Do not add persistence or asynchronous infrastructure without a concrete runtime requirement.** PostgreSQL, Redis, RabbitMQ and Messenger are not required by the current V1 runtime.

## Security invariants

These rules are mandatory.

1. **Seed phrases, private keys and WIF never reach Symfony.**
   They remain browser-local and may exist only in active in-memory wallet/transfer state.

2. **Do not persist plaintext signing material.**
   Never write seed/private key/WIF to `localStorage`, `sessionStorage`, IndexedDB, cookies, databases, analytics, application files or telemetry.

3. **Do not log signing material.**
   Do not include secrets in HTTP logs, exceptions, debug output, screenshots, fixtures tied to real funds or support examples.

4. **Broadcast only signed public transaction bytes.**
   Provider/node APIs may receive raw signed transactions, never signing material.

5. **Signing and broadcast remain separate operations.**
   Building/signing a transaction must never automatically publish it. Broadcast is a distinct irreversible user action after human-readable review.

6. **Keep secret-bearing sessions ephemeral.**
   Refreshing or closing the tab may clear an unlocked wallet session. Only explicitly non-secret preferences such as language may be persisted.

7. **Provider data is untrusted input.**
   Validate addresses, UTXOs, scripts, amounts, transaction identities and response shapes before using provider metadata.

8. **Validate TXID locally.**
   Calculate the transaction ID from locally signed raw bytes and compare it with the provider-returned identity after broadcast. Mismatches fail closed.

Fixed public test vectors may use well-known deterministic mnemonics/WIFs only when they are clearly test-only and must never receive funds. Never commit real wallet secrets.

## Cryptocurrency correctness rules

- Amounts use integer smallest units internally: `koinu` for DOGE and `satoshi` for BTC. Never use floating-point arithmetic for money.
- Network fee is derived from transaction inputs/outputs and serialized size; it is not a standalone field serialized into a UTXO transaction.
- Never silently alter destination address, amount, input outpoint, change address, network or asset route.
- DOGE and BTC currently spend confirmed UTXOs only.
- Validate that selected UTXO scripts belong to the source address before signing.
- Verify that the supplied WIF derives the selected source address before signing.
- Human-readable review must expose source, destination, amount, fee rate, actual fee, change, serialized size and local TXID before broadcast.
- Do not change secp256k1 signing options, Base58Check constants, derivation paths, DER encoding, sighash rules or transaction serialization as part of unrelated work.
- Cryptographic/serialization changes require deterministic regression vectors and a narrowly scoped commit/PR.

Current derivation paths:

- DOGE mainnet legacy P2PKH: `m/44'/3'/0'/0/0`;
- BTC mainnet legacy P2PKH: `m/44'/0'/0'/0/0`.

## Adapter registry invariants

Frontend:

- every route marked live has its own registered `AssetRouteAdapter`;
- every live route has the required `WalletNetworkAdapter`;
- registry keys are unique;
- DOGE resolves only to the Dogecoin runtime;
- BTC resolves only to the Bitcoin runtime;
- planned routes remain unregistered until implemented;
- unknown route/network lookup fails closed;
- wallet sessions are network-scoped;
- secrets remain browser-memory-only.

Backend:

- `ChainAdapter` carries chain/network identity only;
- behavior is exposed through capability interfaces such as balance, UTXO lookup, fee policy and raw-transaction broadcast;
- registry keys are exact `chain:network` pairs and unique;
- unknown chain/network lookup throws explicitly;
- unsupported capabilities throw explicitly;
- Application code must not import concrete Blockchain Infrastructure adapters.

Do not bypass a registry with asset-symbol conditionals or fallback behavior.

## UI and product rules

The UI is bilingual:

- English (`en`);
- Russian (`ru`).

All user-facing strings should use the translation layer. Language preference may be stored in `localStorage`; signing secrets may not.

Preserve the current product principles:

- modern, clear fintech-style interface;
- wallet creation and watch-only connection are distinct;
- transaction review is human-readable;
- raw signed transaction bytes are application data, not the primary review UI;
- successful/failed broadcast status stays tied to the originating transfer flow;
- mobile layouts remain usable;
- security warnings remain visible.

Do not redesign the UI while performing unrelated backend, registry or cleanup work.

## Change discipline

When working on a task:

1. inspect the current implementation and architecture docs first;
2. make the smallest coherent change;
3. preserve public API and wallet behavior unless the task explicitly changes them;
4. keep signing, provider, UI and infrastructure concerns separate;
5. update documentation when supported behavior or architecture changes;
6. add regression coverage before removing an old safety net;
7. run the relevant deterministic, architecture, build and backend checks before considering the change finished.

Avoid generic `Service/`, `Helper/` or `Utils/` dumping grounds. Prefer explicit domain/application concepts and capability contracts.

## Dependencies

Frontend cryptographic behavior uses pinned audited/open-source primitives already present in `frontend/package.json`. Do not add or replace crypto dependencies casually.

Backend provider logic belongs behind Application capabilities/ports. Do not scatter provider-specific HTTP calls across controllers or domain code.

New dependencies must have a concrete reason, be pinned through the appropriate lock file and stay within the module/security boundaries.

## Testing requirements

For frontend wallet/runtime changes run:

```bash
cd frontend
npm ci
npm run test:adapter-invariants
npm run test:dogecoin-vector
npm run test:bitcoin-vector
npm run build
```

For backend/adapter changes run:

```bash
cd backend
composer install
composer test
composer analyse
composer cs:check
```

For integrated platform changes also run from the repository root:

```bash
docker compose config --quiet
docker compose up -d --build
```

Then verify at minimum:

- React application loads;
- `GET /api/health` succeeds;
- DOGE wallet creation works;
- BTC wallet creation works;
- DOGE build/sign/review remains separate from broadcast;
- BTC build/sign/review remains separate from broadcast.

Use deterministic local vectors for cryptographic regression coverage. Do not depend on live mainnet transactions as the only test oracle.

## Secret/file hygiene

Keep secret and generated transaction files out of Git. Preserve repository ignore rules for `*.wif` and `*.tx`.

Never commit:

- a real WIF/private key;
- a real seed phrase;
- exchange credentials/API tokens;
- private wallet backups;
- `.env` files containing secrets.

Public addresses, TXIDs, public keys and already-signed raw transactions are public data, but use real mainnet examples sparingly.

## Network providers

External explorers/providers are infrastructure conveniences, not wallet authority.

- Provider failures must not trigger re-signing or secret disclosure.
- Validate provider response shapes and values.
- Locally calculated TXID must be compared with provider-returned TXID when available.
- Prefer provider adapters behind capabilities instead of direct provider calls from Application/Presentation.
- A future own-node/RPC adapter should be swappable without changing browser signing behavior.

## Current roadmap

Current supported live assets are DOGE mainnet and BTC mainnet legacy P2PKH.

Near-term evolution may include:

1. Bitcoin SegWit/Taproot support with separate deterministic vectors;
2. dynamic fee estimation;
3. EVM/token adapters;
4. optional indexer/cache/queue infrastructure when load or provider independence requires it;
5. encrypted local browser vault;
6. production hardening, observability and load testing.

Roadmap items do not authorize bundling unrelated changes into the current task.
