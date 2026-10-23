# ChainCourier

Multi-chain non-custodial crypto transfers built with Symfony 7.4 and React/TypeScript.

Wallet creation and signing happen in browser memory. Secrets are not persisted or sent to Symfony. The backend provides public chain data and unsigned transaction preparation, never signing or broadcast. Publication is a separate, explicit action through a user-selected provider or signed-payload export.

## Supported routes

- DOGE — Dogecoin mainnet, legacy P2PKH.
- BTC — Bitcoin mainnet, legacy P2PKH wallets; P2PKH and native SegWit P2WPKH recipients.
- LTC — Litecoin mainnet, legacy P2PKH.
- ETH — Ethereum mainnet, EIP-1559 Type-2 transactions.
- USDT ERC-20 — Ethereum mainnet; shares the ETH wallet identity, with a separate token balance. Gas is paid in ETH.
- USDT TRC-20 — TRON mainnet; a separate wallet identity. Fees/resources are paid in TRX.

## Quick start

Requires Docker with Compose support.

```bash
git clone https://github.com/Kolyn236/wallet-generator.git
cd wallet-generator
cp .env.example .env
docker compose up --build
```

Open http://localhost:8080. Health: http://localhost:8080/api/health.
Stop with `docker compose down`.

ETH/ERC-20 operations require `ETHEREUM_RPC_URL`; TRON operations require `TRON_RPC_URL`. See [setup and configuration](docs/SETUP.md).

The Compose stack is for development. Read the [security model](docs/SECURITY_MODEL.md) before public deployment or using real funds. A compromised hosted frontend can steal secrets despite browser-local signing.

## Documentation

- [Setup and configuration](docs/SETUP.md) — local startup, RPC requirements and fee defaults.
- [Development and checks](docs/DEVELOPMENT.md) — dependencies, test/build commands and CI.
- [Architecture](docs/architecture/README.md) — runtime diagram, modules, adapters, derivation and chain-specific flows.
- [Backend API](docs/API.md) — public balance, UTXO, preparation and status endpoints.
- [Publication and migration](docs/PUBLICATION.md) — direct providers, export, retries and removed broadcast endpoints.
- [Security model](docs/SECURITY_MODEL.md) — trust boundaries, browser-memory limitations and self-hosting.
- [Deployment](deploy/README.md) — operator environment overrides.

## Roadmap

1. Fee estimation and transaction-review improvements.
2. Production observability, load testing and operational hardening.

Additional chains, token routes, persistence, queues, indexers or browser vault features require a concrete product or load requirement.

## License

[MIT](LICENSE). Third-party dependencies retain their own licenses. Repository visibility and release publication remain operator decisions.
