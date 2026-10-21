# Symfony backend

The backend is the supported Symfony 7.4 LTS / PHP 8.4 blockchain API gateway for ChainCourier.

Wallet creation and transaction signing stay in browser memory. Symfony receives public state queries and unsigned public intent only, never signed transactions for publication. It exposes no broadcast API; browser direct/custom endpoints or explicit signed-payload export own publication.

Current backend chain registrations:

- `dogecoin:mainnet`;
- `bitcoin:mainnet`;
- `litecoin:mainnet`;
- `ethereum:mainnet`;
- `tron:mainnet`.

Chain behavior is exposed through capability-specific adapters. UTXO and EVM behavior are intentionally not forced into one universal blockchain interface.

## Local Docker environment

From the repository root:

```bash
docker compose up --build
```

The current Compose runtime contains:

- PHP-FPM / Symfony;
- Nginx serving the React build and proxying `/api/*`.

Open the application at `http://localhost:8080`.

Health endpoint:

```text
GET http://localhost:8080/api/health
```

PostgreSQL, Redis and RabbitMQ are not part of the current runtime. Add stateful or asynchronous infrastructure only when a concrete product or load requirement needs it.

## Local PHP commands

```bash
cd backend
cp .env.example .env.local
composer install
composer test
composer analyse
composer cs:check
```

## Runtime configuration

The backend reads operator configuration from environment variables, including:

```dotenv
DOGE_RECOMMENDED_FEE_RATE=0.01
BTC_RECOMMENDED_FEE_RATE=0.00010000
ETHEREUM_RPC_URL=
TRON_RPC_URL=
```

`ETHEREUM_RPC_URL` is required only for Ethereum endpoints. Provider credentials must remain outside Git and must not be logged.

`TRON_RPC_URL` enables fixed-USDT TRC-20 balance, public preparation/resource data and full/solidity status lookup. It defaults to empty. Both RPC settings are backend public-state configuration, not browser broadcast credentials. See `../docs/architecture/TRON_TRC20.md` and `../docs/SECURITY_MODEL.md`.

## Architecture

The backend is a modular monolith. Application capabilities define provider-independent contracts; Infrastructure implements concrete provider/chain adapters; Presentation does not import Infrastructure directly.

See:

- `../docs/architecture/ADR-001-modular-monolith.md`;
- `../docs/architecture/MODULE_BOUNDARIES.md`;
- `../docs/architecture/ADAPTER_REGISTRY.md`;
- `../docs/architecture/ETHEREUM_BACKEND.md`.
