# Symfony backend

The backend is the supported Symfony 7.4 LTS / PHP 8.4 blockchain API gateway for ChainCourier.

It is intentionally non-custodial: wallet creation and transaction signing stay in the browser. Symfony receives public chain data requests and already-signed raw transactions only.

Current backend chain registrations:

- `dogecoin:mainnet`;
- `bitcoin:mainnet`;
- `ethereum:mainnet`.

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
```

`ETHEREUM_RPC_URL` is required only for Ethereum endpoints. Provider credentials must remain outside Git and must not be logged.

## Architecture

The backend is a modular monolith. Application capabilities define provider-independent contracts; Infrastructure implements concrete provider/chain adapters; Presentation does not import Infrastructure directly.

See:

- `../docs/architecture/ADR-001-modular-monolith.md`;
- `../docs/architecture/MODULE_BOUNDARIES.md`;
- `../docs/architecture/ADAPTER_REGISTRY.md`;
- `../docs/architecture/ETHEREUM_BACKEND.md`.
