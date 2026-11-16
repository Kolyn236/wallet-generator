# Development and checks

[Project overview](../README.md)

## Development

Backend:

```bash
cd backend
composer install
composer test
composer analyse
composer cs:check
```

Frontend:

```bash
cd frontend
npm ci
npm run test:adapter-invariants
npm run test:dogecoin-vector
npm run test:bitcoin-vector
npm run test:litecoin-vector
npm run test:ethereum-vector
npm run test:usdt-erc20-vector
npm run test:tron-vector
npm run test:tron-flow
npm run test:broadcast
npm run test:usdt-route-chooser
npm run test:transfer-review
npm run test:public-runtime
npm run build
npm run dev
```

Deterministic frontend coverage includes DOGE/BTC transaction vectors, Ethereum wallet/Type-2 serialization vectors and USDT ERC-20 amount/calldata/signing vectors. Tests do not require funded accounts or a live Ethereum RPC provider.

Production-like local build:

```bash
docker compose up --build
```


## CI

`Quality Gate` runs source checks, backend tests/static analysis/style, frontend adapter invariants, deterministic DOGE/BTC/LTC/ETH/USDT/TRON vectors and publication/UI regressions and the TypeScript/Vite build.

`Integration Smoke` owns Docker/Compose runtime checks and is restricted to deploy/runtime-sensitive changes on `main` or manual execution.

