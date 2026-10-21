# Broadcast boundary reconnaissance

## Baseline

Implementation starts from `origin/main` at `5784481cd5aaf7841c99b90888ceb4300452f6a1`, not from the stale TRON PR. PR #58 (`2393dedf66fa32b4bc9a4d6c174e5336f8183e42`) adds a project-state analysis only. PR #48 (`d6b79eb928d82f5d40caf6040db9499225811d14`) is reference material, not a merge source or security authority.

Observed existing runtime:

- DOGE, BTC, LTC, ETH and Ethereum USDT have registered browser wallet/asset adapters.
- LTC implementation and its deterministic vector exist despite omissions in README, AGENTS and explicit CI/local verification steps.
- Wallets and signing stay in the browser; existing signers check key/address correspondence and calculate transaction identity locally.
- Every existing transfer panel sends signed bytes through `frontend/src/api.ts` to a Symfony broadcast controller.
- Backend broadcast use cases/capabilities/providers are enabled in the default runtime, including Litecoin's combined HTTP controller.
- Browser storage accesses inspected in frontend source concern language preferences. This is reconnaissance, not proof of an exhaustive secrets audit.
- The latest observed GitHub Actions run on the baseline reports `startup_failure`, not a successful quality gate.
- Host Node 18/PHP 8.2 are not the supported verification environment; repository verification uses Node 24/PHP 8.4 through Docker.

## TRON reference findings

PR #48 contributes the intended separate `tron-mainnet` identity, BIP44 path `m/44'/195'/0'/0/0`, fixed USDT contract identity, route registration ideas and EN/RU copy. It is not a completed secure transfer flow:

- its frontend signs opaque provider bytes without comparing the full intended transfer;
- its freshness check measures time since receiving preparation instead of the serialized expiration;
- its protobuf layout and Any envelope require independent protocol verification;
- its vectors mostly test internal consistency rather than independently known wire bytes;
- its module-level key map is an unnecessary second key lifetime;
- its status mapping confuses missing data with expiration and inclusion with solidity;
- its Symfony broadcast design is superseded by the boundary below.

Issues #54–#57 remain design/history material. In particular, #55's Symfony broadcast acceptance criteria are superseded, not pending implementation work.

## Required architecture decision

Default Symfony is a public-data/preparation/status gateway only. Remove its transaction broadcast HTTP surface and provider capability implementations. It must not receive signing material or signed transactions for publication.

Use existing route/network registries and browser signers. Add a frontend transport boundary for explicitly selected user-controlled endpoints. Keep UTXO, EVM and TRON payloads distinct; do not introduce a universal transaction model. Validate returned transaction identity against locally calculated identity. Custom endpoints and signed-transaction export are the fallback when browser CORS/authentication prevents direct publication. No mandatory relay or new distributed subsystem is needed.

Preparation and signing must not publish. Failed/ambiguous publication retains the exact signed payload for explicit retry; it must not trigger replacement signing. A browser-selected endpoint is not independently trustworthy merely because it is user-selected. Validate network and response data; do not silently fallback to another endpoint/route.

TRON preparation uses public inputs only and exposes explicit intent, resource and TAPOS fields. The browser reconstructs deterministic bytes and verifies the snapshot before signing. Accepted submission, observation, inclusion, solidification and execution result are different facts. Missing provider data must remain unknown unless expiration can actually be established.

Ethereum and TRON USDT routes remain separate wallet identities and balances. The USDT chooser selects where existing tokens reside; it does not exchange, swap or bridge assets.

## Delivery gates

Run all existing deterministic vectors including Litecoin, new TRON and broadcast tests, architecture tests, PHP 8.4 PHPUnit/static analysis/style, supported-Node build, Docker runtime checks and `git diff --check`. Audit tracked files and release configuration without printing real credentials. No funded transactions are needed. Preserve issue discussion history, document superseded broadcast requirements and create one final PR without automatically merging or changing repository visibility.
