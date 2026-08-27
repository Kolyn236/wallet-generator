# Deploy-time runtime environment

The repository-root `.env` is generated during deployment. Do not commit it.

Base values live in `.env.example`. Operator-controlled fee values live in a separate env file outside Git, for example:

```dotenv
DOGE_RECOMMENDED_FEE_RATE=0.02
```

A tracked template is available at `deploy/.env.rates.example`. The real file may be kept as `deploy/.env.rates` on a deployment host or, preferably, outside the checkout such as `/etc/wallet-platform/rates.env`.

Build the runtime env before starting/recreating the stack:

```bash
sh scripts/build-deploy-env.sh /etc/wallet-platform/rates.env .env
docker compose up -d --build
```

The builder removes base assignments for keys present in the operator file and then appends the operator values, so each overridden key appears only once in the generated `.env`.

Changing only a fee rate does not require rebuilding the React bundle. Rebuild/regenerate `.env` and recreate the PHP runtime:

```bash
sh scripts/build-deploy-env.sh /etc/wallet-platform/rates.env .env
docker compose up -d --force-recreate php
```

The generated `.env` is created with restrictive permissions (`umask 077`).
