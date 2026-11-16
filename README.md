<div align="center">

<h1>ChainCourier</h1>
<p><strong>Multi-chain transfers. Browser-local signing. Explicit publication.</strong></p>
<p>A non-custodial wallet built with React, TypeScript and Symfony.<br>
Create or connect a wallet, review a transfer, and choose when to publish.</p>

<p>
  <img alt="React + TypeScript" src="https://img.shields.io/badge/React-TypeScript-3178C6?style=flat-square">
  <img alt="Symfony 7.4" src="https://img.shields.io/badge/Symfony-7.4-181825?style=flat-square">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-2F855A?style=flat-square"></a>
</p>

<p>
  <a href="#why-chaincourier">Overview</a> ·
  <a href="#supported-routes">Routes</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#how-it-works">Architecture</a> ·
  <a href="#security-boundaries">Security</a> ·
  <a href="#documentation">Docs</a>
</p>

</div>

> **Before using real funds:** browser memory is not a hardware wallet or a secure enclave.
> A compromised hosted frontend can steal secrets even when signing is local.
> Read the [security model](docs/SECURITY_MODEL.md); the bundled Compose stack is for development, not production hardening.

## Why ChainCourier

- **Keep signing local.** Wallet creation, key derivation and transaction signing happen in the browser; seed phrases, private keys and WIF are not sent to Symfony or persisted in browser storage.
- **Review before publishing.** Human-readable transaction review and locally calculated transaction identity keep signing separate from broadcast or export.
- **Use distinct chain routes.** UTXO, Ethereum and TRON flows retain their own fee, validation and signing rules instead of sharing a one-size-fits-all transaction model.
- **Choose how to connect.** Wallet creation and watch-only connection are distinct; the interface supports English and Russian.

## Supported routes

All six routes target **mainnet**. Network selection does not bridge, swap or convert assets.

| Asset route | Network | Scope and fee notes |
| --- | --- | --- |
| DOGE | Dogecoin | Legacy P2PKH wallets and transfers. |
| BTC | Bitcoin | Legacy P2PKH wallets; P2PKH and native SegWit P2WPKH recipients. |
| LTC | Litecoin | Legacy P2PKH wallets and transfers. |
| ETH | Ethereum | Native ETH; EIP-1559 Type-2 transactions. |
| USDT ERC-20 | Ethereum | Shares the ETH wallet identity; separate token balance; gas paid in ETH. |
| USDT TRC-20 | TRON | Separate TRON wallet identity; fees/resources paid in TRX. |

ETH/ERC-20 and TRON public-state operations require configured mainnet RPC providers.
Browser publication also depends on the selected provider's CORS, authentication and rate limits; signed-payload export is available when direct publication is unavailable.
See [setup](docs/SETUP.md) and [publication](docs/PUBLICATION.md) for configuration and limitations.

## Quick start

Requires **Docker with Compose support**. From a fresh checkout:

```bash
git clone https://github.com/Kolyn236/wallet-generator.git
cd wallet-generator
cp .env.example .env
docker compose up --build
```

- **App:** [localhost:8080](http://localhost:8080)
- **Health:** [localhost:8080/api/health](http://localhost:8080/api/health)
- **Stop:** `docker compose down` (from another terminal).

Set `ETHEREUM_RPC_URL` for ETH/ERC-20 and `TRON_RPC_URL` for TRON operations in your runtime configuration.
These are backend public-state providers, **not browser broadcast credentials**. Never embed secret provider keys in the frontend bundle.
For configuration and deployment overrides, follow the [setup guide](docs/SETUP.md).

## How it works

```text
Browser: React + TypeScript
  ├─ Public addresses / unsigned intent → Symfony → chain nodes/providers
  │                                      public data + preparation only
  └─ Local wallet → review → sign
                              ├─ Explicit broadcast → user-selected provider
                              └─ Explicit export    → external publication
```

Nginx serves the frontend and routes `/api/*` to Symfony 7.4 / PHP-FPM.
The backend is a modular monolith with chain/network capability adapters; unknown or unsupported routes fail closed.
The current runtime does not require PostgreSQL, Redis or RabbitMQ.

**Symfony never signs or broadcasts transactions.** Signed bytes are not sent to it for publication.
See the [architecture overview](docs/architecture/README.md) for module boundaries, adapter registries and chain-specific flows.

## Security boundaries

- **Ephemeral, not invulnerable.** Unlocked signing material lives in active browser memory; refresh or closing the tab may clear it. JavaScript memory cannot be reliably zeroed, and extensions, clipboard access or a compromised device can expose secrets.
- **The delivered frontend is a trust boundary.** Browser-local signing does not protect against malicious JavaScript served by a compromised host. Self-host and verify the source/build if that threat matters.
- **Signing is not publication.** Broadcasting to a selected direct provider and exporting a signed payload are separate, explicit actions. Anyone holding valid signed bytes may publish them; protect exports until publication is intended.
- **Treat providers as untrusted.** A timeout does not prove rejection, and provider acceptance does not prove execution. Check transaction status before explicitly retrying the same signed payload.
- **Use caution with real funds.** Never fund public deterministic test vectors or put wallet secrets in logs, screenshots, support reports or Git. Review dependencies and deployment settings before exposing the app publicly.

The [security model](docs/SECURITY_MODEL.md) documents the full threat model and operating assumptions.

## Documentation

| Guide | What you will find |
| --- | --- |
| [Setup and configuration](docs/SETUP.md) | Docker startup, RPC requirements and fee defaults. |
| [Development and checks](docs/DEVELOPMENT.md) | Dependencies, deterministic tests, builds and CI. |
| [Architecture](docs/architecture/README.md) | Runtime, modules, registries, derivation and chain-specific flows. |
| [Backend API](docs/API.md) | Public balance, preparation and transaction-status endpoints. |
| [Publication and migration](docs/PUBLICATION.md) | Direct providers, export, retries and removed broadcast endpoints. |
| [Security model](docs/SECURITY_MODEL.md) | Trust boundaries, browser-memory limits and self-hosting. |
| [Deployment](deploy/README.md) | Operator environment overrides. |

## Roadmap

Fee-estimation and transaction-review improvements, followed by production observability, load testing and operational hardening.
Additional chains, token routes, persistence, queues, indexers or browser vault features require a concrete product or load requirement.

## License

[MIT](LICENSE) — third-party dependencies retain their own licenses.
