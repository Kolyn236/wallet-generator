# AGENTS.md

## Project overview

`doge-wallet-generator` is a small educational Dogecoin wallet laboratory written in Python.

The project intentionally exposes the mechanics that normal wallet software hides:

- secp256k1 key generation;
- Dogecoin P2PKH addresses and WIF;
- UTXO-based transaction construction;
- transaction serialization;
- local ECDSA signing;
- fee and change calculation;
- CPFP rescue transactions;
- explicit raw-transaction broadcast;
- a local browser UI on `127.0.0.1`.

The primary goal is **understandability and correctness**, not production-wallet feature completeness.

This repository currently targets Dogecoin **mainnet legacy P2PKH (`D...`)** transactions.

## Target architecture and migration

The repository is now being migrated incrementally toward a production-oriented multi-chain wallet platform implemented as a Symfony modular monolith.

Before making migration-related changes, read:

- `docs/architecture/ADR-001-modular-monolith.md`;
- `docs/architecture/MIGRATION_PLAN.md`;
- the relevant prompt under `docs/agent-prompts/`.

Target stack:

- PHP 8.4;
- Symfony 7.4 LTS;
- PostgreSQL;
- Redis;
- RabbitMQ through Symfony Messenger;
- React + TypeScript + Vite;
- Nginx + PHP-FPM.

Migration rules are mandatory:

1. **No big-bang rewrite.** Keep the working Python implementation until equivalent Symfony behavior is covered by parity tests.
2. **Do not delete Python reference code as part of bootstrap/refactoring work.** Runtime retirement requires an explicit migration step.
3. **One monolith may have multiple processes.** PHP-FPM and Messenger consumers use the same Symfony codebase and deployable image; separate worker processes do not imply microservices.
4. **Keep module boundaries explicit.** Initial modules are `Wallet`, `Asset`, `Transaction`, `Blockchain`, `Signer`, and `Indexer`.
5. **Domain code is framework-agnostic.** It must not depend directly on Symfony, Doctrine, Redis, RabbitMQ, HTTP clients, or provider SDKs.
6. **PostgreSQL is authoritative for financial workflow state.** RabbitMQ is transport, not the source of truth.
7. **Use explicit concurrency controls.** UTXO reservation, idempotency, transaction state transitions, and later nonce management must be designed for multiple concurrent workers.
8. **Do not store plaintext WIF/private keys/seed phrases in production persistence.** Any future custodial signing model requires a dedicated signing boundary and an explicit architecture/security decision.
9. **Do not blindly port educational custom cryptography into the production path.** Preserve it as reference/test material until trusted cryptographic dependencies and signing boundaries are deliberately selected.
10. **Normal reads stay synchronous.** Do not route ordinary wallet/balance reads through RabbitMQ; use Redis/PostgreSQL read models and asynchronous synchronization behind them.

## Important files

- `doge_wallet.py` — crypto primitives, wallet generation, transaction building/signing.
- `build_cpfp.py` — Child-Pays-For-Parent transaction builder.
- `broadcast_blockcypher.py` — BlockCypher raw transaction broadcaster.
- `broadcast_blockchair.py` — alternative broadcaster.
- `balance_page.py` — public-address balance checker page.
- `web_app.py` — local browser UI and local HTTP API.
- `README.md` — CLI/project documentation.
- `WEB_UI.md` — web UI documentation.

## Security invariants

These rules are mandatory.

1. **Never transmit a WIF or private key to an external service.**
   Private keys may move only between the user's browser and the local Python process on `127.0.0.1`.

2. **Never log private keys or WIF values.**
   Do not include them in HTTP logs, exceptions, debug output, telemetry, screenshots, fixtures, examples, or test vectors intended for real funds.

3. **Never persist secrets automatically.**
   The web app must not save WIF/private keys to cookies, `localStorage`, `sessionStorage`, databases, analytics, or application files.

4. **Broadcast only signed public transaction bytes.**
   External relay APIs may receive raw signed transactions, never signing material.

5. **Keep the web server local by default.**
   `web_app.py` must bind to `127.0.0.1`, not `0.0.0.0`, unless a future change explicitly introduces and documents a secure remote-access model.

6. **Broadcast must remain explicit and separate from signing.**
   Building/signing a transaction must never automatically publish it. The broadcast action may live in the same human-readable transaction result card, but it must remain a distinct irreversible user action with explicit confirmation.

7. **Do not weaken browser protections casually.**
   Preserve the local request token, `Cache-Control: no-store`, frame denial, restrictive CSP, and absence of permissive CORS.

8. **Treat the software as educational.**
   Do not market or document it as audited, production-grade, or suitable for large balances.

## Cryptocurrency correctness rules

- Dogecoin fees are not serialized in a dedicated `fee` field. Fee is `sum(inputs) - sum(outputs)`.
- Amounts must use integer koinu internally (`100,000,000` koinu = `1 DOGE`). Avoid floating-point arithmetic for money.
- Never silently alter a destination address, amount, input outpoint, or change address.
- Always show the user source, destination, amount, change, fee, serialized size, and locally calculated TXID before broadcast.
- Prefer deriving values from canonical data instead of asking the user to type them manually. Example: derive a parent TXID from raw transaction bytes rather than accepting a manually copied TXID when possible.
- When adding RBF, use an explicit sequence value that signals opt-in RBF and document the behavior. Do not change sequence semantics implicitly.
- Do not modify secp256k1, Base58Check, RIPEMD-160, RFC6979, DER, sighash, or transaction serialization code as part of unrelated UI/refactoring work.
- Changes to cryptographic or serialization primitives require dedicated tests and a dedicated commit.

## UI and product rules

The web UI is bilingual:

- English (`en`)
- Russian (`ru`)

All user-facing UI strings should go through the translation layer. Do not introduce new hard-coded English or Russian labels in feature code when an i18n key should be used.

Language preference may be stored in `localStorage`; **secrets may not**.

Design direction:

- modern, clean fintech-style interface;
- lighter than the original dark terminal-like UI;
- clear visual hierarchy and generous spacing;
- Dogecoin gold may be used as an accent, not as the entire palette;
- the main workflow is a swipeable/scrollable three-step flow: `Wallet -> Send -> Rescue`;
- Send and Rescue result cards contain their own explicit broadcast action after human-readable transaction review;
- do not introduce a separate raw-hex Broadcast screen as the primary review flow;
- serialized signed transaction bytes may remain internal application data, but the user-facing review surface must be human-readable;
- successful or failed broadcast status belongs in the same transaction result card that initiated it;
- the separate `/balance` page remains a public-address read-only flow and must never ask for WIF/private key;
- mobile layouts must remain usable without horizontal form overflow;
- security warnings must remain visible and understandable after visual redesigns.

Do not sacrifice transaction review information for visual simplicity.

## Change discipline

Keep commits narrowly scoped. Do not mix unrelated concerns.

Good examples:

- `feat(i18n): add Russian and English UI translations`
- `style(web): modernize wallet UI and workflow carousel`
- `docs: add project rules for coding agents`
- `fix(tx): correct fee calculation for exact serialized size`
- `feat(tx): add opt-in RBF support`

Bad example:

- one commit that changes cryptography, redesigns the UI, adds a dependency, and rewrites documentation.

When working on a requested task:

1. inspect the current implementation first;
2. make the smallest coherent change;
3. preserve compatibility unless the task explicitly changes behavior;
4. update documentation when user-visible behavior changes;
5. run the relevant tests before considering the change finished.

## Dependencies

The current Python reference implementation aims to work with Python 3.10+ and the standard library only.

Do not introduce a new Python runtime dependency unless it provides a clear benefit that cannot reasonably be achieved with the current architecture. If adding one:

- explain why it is needed;
- pin/document it;
- update setup instructions;
- keep security-sensitive signing code local.

The new Symfony backend has its own dependency policy defined by ADR-001 and migration prompts.

Do not replace educational crypto code with a library merely to shorten the reference source unless the project direction explicitly changes.

## Testing requirements

At minimum after changes to wallet/transaction code run:

```bash
python3 doge_wallet.py --self-test
```

For web UI changes also verify:

```bash
python3 web_app.py --open
```

and manually check:

- English and Russian language switching;
- page reload preserves only non-secret preferences;
- wallet generation still works;
- `/balance` still works without WIF/private key;
- WIF remains visually protected where appropriate;
- transaction build remains separate from the explicit broadcast button;
- Send and CPFP show human-readable summaries before broadcast is possible;
- successful/failed broadcast state renders inside the originating transaction result card;
- no separate user-facing raw-hex Broadcast screen is introduced;
- mobile-width layout is usable.

For cryptographic changes, add or extend deterministic test vectors instead of relying only on a live mainnet transaction.

When Symfony is introduced, its PHPUnit/static-analysis checks must be added to CI without removing the Python self-test until migration parity is complete.

## Secret/file hygiene

Keep secret and generated transaction files out of Git. Existing ignore rules for `*.wif` and `*.tx` must not be removed without a strong reason.

Never commit:

- a real WIF/private key;
- seed phrases;
- exchange credentials/API tokens;
- private wallet backups;
- `.env` files containing secrets.

Public addresses, TXIDs, public keys, and signed raw transactions are not private keys, but use real mainnet examples sparingly and clearly label them as public examples.

## Network providers

External explorers and broadcasters are infrastructure conveniences, not sources of wallet authority.

- A transaction should not depend conceptually on one explorer/provider.
- Provider failures must not trigger re-signing or secret disclosure.
- Locally calculated TXID must be compared with a provider-returned TXID when available.
- Prefer adding provider adapters over scattering provider-specific HTTP logic throughout wallet code.

Longer term, a local Dogecoin Core JSON-RPC backend is preferred for independent broadcast and chain inspection.

## Current roadmap

The active migration roadmap is `docs/architecture/MIGRATION_PLAN.md`.

Near-term order:

1. Symfony bootstrap beside Python;
2. modular boundaries;
3. PostgreSQL/Redis/RabbitMQ foundations;
4. Dogecoin adapter;
5. transaction engine and concurrency guarantees;
6. React UI migration;
7. Dogecoin Core/indexer;
8. load testing and production hardening;
9. Bitcoin, then Ethereum/EVM.

Roadmap items are guidance, not permission to bundle unrelated work into the current task.
