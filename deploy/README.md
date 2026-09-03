# Development and production runtime

ChainCourier has two explicit Docker Compose entry points. They are intentionally separate so development defaults cannot silently become the production runtime.

## Local development

Use `compose.yaml` only for local development. It bind-mounts the checkout, sets `APP_ENV=dev`, enables debug, uses the local development secret and starts PHP through `docker/php/start-dev.sh`.

```bash
cp .env.example .env
docker compose up --build
```

Do not use this topology as the server production runtime.

For direct Symfony commands outside Docker, create a local ignored backend env file first:

```bash
cp backend/.env.example backend/.env
cd backend
composer install
```

`backend/.env` is intentionally not tracked. The tracked `backend/.env.example` contains local-development defaults only.

## Production configuration

Production uses the standalone `compose.prod.yaml` topology. It builds source code and production Composer dependencies into the PHP image, does not bind-mount the repository, does not run `start-dev.sh`, and starts PHP-FPM through a production entrypoint.

The PHP entrypoint requires all of the following and exits before PHP-FPM starts if they are invalid:

- `APP_ENV=prod`;
- `APP_DEBUG=0`;
- a non-empty, non-development-placeholder `APP_SECRET` of at least 32 characters.

Do not commit the production secret. Generate one, for example:

```bash
openssl rand -hex 32
```

Keep the real values in an operator-controlled file outside Git, preferably readable only by the deployment account/root, for example `/etc/chain-courier/runtime.env`:

```dotenv
APP_SECRET=<generated-random-secret>
DEFAULT_URI=https://wallet.example.com
DOGE_RECOMMENDED_FEE_RATE=0.01
BTC_RECOMMENDED_FEE_RATE=0.00010000
ETHEREUM_RPC_URL=https://your-ethereum-provider.example/your-secret-key
```

`ETHEREUM_RPC_URL` remains operator-controlled and may contain provider credentials. Leave it empty only when Ethereum endpoints are intentionally unavailable. A safe blank template is tracked as `deploy/.env.production.example`.

Build the root runtime env with restrictive permissions:

```bash
sh scripts/build-deploy-env.sh /etc/chain-courier/runtime.env .env
```

The builder combines the safe non-secret `.env.example` defaults with operator values and creates `.env` under `umask 077`.

## Production build and start

Validate configuration before changing the running containers:

```bash
docker compose -f compose.prod.yaml config --quiet
```

A missing `APP_SECRET` makes Compose configuration fail immediately. The container entrypoint independently rejects missing/short/development placeholder secrets.

Build and start:

```bash
docker compose -f compose.prod.yaml build --pull
docker compose -f compose.prod.yaml up -d
```

Check the application before considering the deployment healthy:

```bash
curl --fail --silent --show-error http://127.0.0.1:8080/api/health
```

The production PHP image installs only required Composer packages with authoritative classmaps. OPcache is enabled with timestamp validation disabled because application source is immutable inside the image.

## Safe restart/update

For an application update:

```bash
git fetch --prune
# Check out the reviewed release/commit here.
sh scripts/build-deploy-env.sh /etc/chain-courier/runtime.env .env
docker compose -f compose.prod.yaml config --quiet
docker compose -f compose.prod.yaml build --pull
docker compose -f compose.prod.yaml up -d --remove-orphans
curl --fail --silent --show-error http://127.0.0.1:8080/api/health
```

For configuration-only changes, rebuild is unnecessary; regenerate `.env` and recreate the PHP container:

```bash
sh scripts/build-deploy-env.sh /etc/chain-courier/runtime.env .env
docker compose -f compose.prod.yaml config --quiet
docker compose -f compose.prod.yaml up -d --force-recreate php
```

## HTTP perimeter defaults

The bundled Nginx layer is deliberately a cheap first line of defense, not a fraud engine or WAF:

- request bodies are capped at 256 KiB;
- client body/header timeouts are 10 seconds;
- FastCGI connect/send/read timeouts are 5/15/30 seconds;
- Nginx server tokens are disabled;
- general `/api/` traffic is limited per source IP to 20 requests/second with a burst of 40;
- transaction prepare/broadcast paths are limited separately to 3 requests/second with a burst of 6;
- rate-limit rejections return HTTP 429.

These limits are comfortably above normal interactive wallet UI traffic while rejecting obvious floods before PHP-FPM/provider work. The 256 KiB body ceiling is far above the current JSON transaction intents/raw signed transactions, including normal Ethereum calldata, while preventing multi-megabyte request bodies.

The existing Content-Security-Policy is preserved. No third-party scripts, CAPTCHA or browser challenge code is introduced; seed phrases/private keys remain browser-memory-only.

## TLS and proxy assumptions

The bundled Nginx container listens on plain HTTP and is not assumed to be the public TLS terminator. Therefore HSTS is intentionally not emitted here.

Terminate HTTPS at the hosting/load-balancer/reverse-proxy edge, redirect HTTP to HTTPS there, and configure HSTS on that TLS edge once HTTPS is guaranteed for the public hostname. Do not expose the container's plain HTTP port directly to the public Internet unless the hosting architecture explicitly provides equivalent TLS protection in front of it.

Rate limiting uses the source IP as seen by this Nginx instance. If another reverse proxy sits in front, configure trusted real-IP forwarding at the hosting layer; do not blindly trust arbitrary `X-Forwarded-For` headers from the Internet.
