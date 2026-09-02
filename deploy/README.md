# Deploy-time runtime environment

The repository-root `.env` is generated during deployment. Do not commit it.

Base values live in `.env.example`. Operator-controlled values live in a separate env file outside Git, for example:

```dotenv
DOGE_RECOMMENDED_FEE_RATE=0.02
BTC_RECOMMENDED_FEE_RATE=0.00020000
ETHEREUM_RPC_URL=https://your-ethereum-provider.example/your-secret-key
```

`ETHEREUM_RPC_URL` is required only when the Ethereum backend endpoints are used. Provider credentials/API keys must stay in deployment secrets or operator-controlled environment files and must never be committed to Git.

A tracked template is available at `deploy/.env.rates.example` for the fee-rate values. A real operator file may be kept outside the checkout, for example `/etc/chain-courier/runtime.env`, and can also contain `ETHEREUM_RPC_URL` when Ethereum is enabled.

Build the runtime env before starting/recreating the stack:

```bash
sh scripts/build-deploy-env.sh /etc/chain-courier/runtime.env .env
docker compose up -d --build
```

The builder removes base assignments for keys present in the operator file and then appends the operator values, so each overridden key appears only once in the generated `.env`.

Changing only runtime configuration does not require rebuilding the React bundle. Rebuild/regenerate `.env` and recreate the PHP runtime:

```bash
sh scripts/build-deploy-env.sh /etc/chain-courier/runtime.env .env
docker compose up -d --force-recreate php
```

The generated `.env` is created with restrictive permissions (`umask 077`).

The Ethereum JSON-RPC URL is treated as sensitive infrastructure configuration: application/provider logs must not include the URL, embedded credentials, or raw signed Ethereum transactions.
