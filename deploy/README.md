# Production deployment

Production releases are deployed by GitHub Actions without SSH-based release commands.

The supported production path is:

1. GitHub-hosted Actions runner resolves a `main` commit SHA.
2. It builds immutable PHP and Nginx/frontend images.
3. It starts those exact images with `compose.prod.yaml` and requires `/api/health` to become healthy.
4. Only after the smoke test passes are the SHA-tagged images pushed to GitHub Container Registry (GHCR).
5. A dedicated self-hosted GitHub Actions runner on the production server pulls those images.
6. `scripts/deploy-production.sh` validates the production Compose configuration, recreates the stack and waits for the end-to-end Nginx -> PHP -> Symfony health check.
7. The last healthy SHA is recorded in `/var/lib/wallet-generator/current-release`.
8. If the new release does not become healthy, the deployment script automatically attempts to restore the previous SHA.

The normal `compose.yaml` remains a development/integration runtime. It bind-mounts the repository, runs with `APP_ENV=dev` / `APP_DEBUG=1` and installs Composer dependencies during container startup. Do not use it as the production deployment topology.

## Why a self-hosted runner instead of SSH

The production job runs locally on the server through a dedicated GitHub Actions runner. GitHub does not need an SSH private key and the release workflow does not execute `ssh`, `scp` or `rsync`.

This is still privileged infrastructure. A runner user that can control Docker can effectively obtain root-equivalent access to the host. Therefore:

- use a dedicated runner for this repository/production host;
- give it the custom labels `production` and `wallet-generator`;
- never target this runner from `pull_request` workflows or arbitrary branches;
- keep normal CI on GitHub-hosted `ubuntu-latest` runners;
- deploy only commits reachable from `main`;
- use the GitHub `production` Environment for the deployment job;
- do not install unrelated build tools or run untrusted repositories on the production runner.

## One-time server bootstrap

A one-time server-console/bootstrap operation is still required. Future application releases do not require SSH.

Production host assumptions for the current workflow:

- Linux x86-64 (`x64` runner label);
- Docker Engine;
- Docker Compose v2 plugin (`docker compose`);
- outbound HTTPS access to GitHub/GHCR;
- enough free disk for at least the current and previous release images;
- a dedicated GitHub Actions runner service user with access to Docker.

Create production configuration/state directories and make them accessible to the runner service user (replace `github-runner` with the real runner account):

```bash
sudo install -d -m 0750 -o github-runner -g github-runner /etc/wallet-generator
sudo install -d -m 0750 -o github-runner -g github-runner /var/lib/wallet-generator
```

Create `/etc/wallet-generator/runtime.env` from `deploy/runtime.env.example` and restrict it to the runner account:

```bash
sudo install -m 0600 -o github-runner -g github-runner deploy/runtime.env.example /etc/wallet-generator/runtime.env
```

Then replace all example values, especially `APP_SECRET`, `DEFAULT_URI` and provider credentials.

Do not copy the real production env back into the Git checkout.

### Install the GitHub Actions runner

In GitHub open:

`Repository -> Settings -> Actions -> Runners -> New self-hosted runner`

Use GitHub's generated installation commands on the production host. Register the runner with the additional labels:

- `production`
- `wallet-generator`

Run it as a system service under the dedicated runner account. Do not reuse this runner for pull-request CI.

The workflow additionally requires the default labels `self-hosted`, `linux` and `x64`.

## Network/TLS boundary

`compose.prod.yaml` binds Nginx to `127.0.0.1:8080` by default. This intentionally avoids exposing the application directly over plain HTTP.

Put a host-level reverse proxy/load balancer with TLS in front of that address and set:

```dotenv
DEFAULT_URI=https://your-public-domain.example
APP_BIND=127.0.0.1:8080
```

DNS, TLS certificate issuance and the external reverse proxy are host/infrastructure responsibilities. The internal deployment health check verifies the application stack, not public DNS or certificate validity.

## GitHub settings

The workflow is `.github/workflows/production-deploy.yml`.

Recommended repository settings:

1. Create/use the GitHub Environment named `production`.
2. Restrict deployment branches to `main` where your GitHub plan/settings allow it.
3. Keep `PRODUCTION_AUTO_DEPLOY` unset initially.
4. After the first successful rollout, optionally create repository variable `PRODUCTION_AUTO_DEPLOY=true` to deploy automatically after each push to `main`.

With auto-deploy disabled, pushes to `main` still build and smoke-test SHA-tagged release images, but the production server is changed only by an explicit manual deployment.

## Deploy a new version

Open:

`Actions -> Production Deploy -> Run workflow`

Select `main` and leave `release_sha` empty.

The workflow will build and smoke-test the current `main` SHA, publish:

```text
ghcr.io/<owner>/<repo>-php:<commit-sha>
ghcr.io/<owner>/<repo>-nginx:<commit-sha>
```

and then deploy those exact tags on the production runner.

A successful deployment is complete only after the production Nginx container reports healthy and the deployment script records the SHA as the current release.

## Roll back without SSH

Open the same `Production Deploy` workflow manually and enter a previous healthy `main` commit in `release_sha`.

The workflow verifies that the requested commit is an ancestor of `main`, skips rebuilding it, pulls the existing immutable SHA images and deploys them.

This only works for commits whose production images were previously published. If those GHCR tags were deleted, the rollback pull fails before replacing the current healthy release.

There is also automatic rollback during a failed rollout: when a new release starts but fails the health check, `scripts/deploy-production.sh` attempts to restore `/var/lib/wallet-generator/current-release`.

## What can break during deployment

### Image build or dependency failure

Examples: invalid Dockerfile, Composer install failure, npm build failure, registry/network failure during the build.

Protection: the release images are smoke-tested before they are pushed or deployed. Production is not touched when the build job fails.

### Missing or invalid runtime configuration

Examples: missing `/etc/wallet-generator/runtime.env`, missing `APP_SECRET`, invalid `DEFAULT_URI`, missing Ethereum RPC credentials when Ethereum features are expected.

Protection: the production runner checks that the env file exists/readable and `docker compose config --quiet` runs before recreation. Required Compose variables fail closed.

### Container starts but application is broken

Examples: Symfony cannot boot in `prod`, frontend/API mismatch, Nginx cannot reach PHP-FPM, route/config regression.

Protection: the release must pass the same end-to-end `/api/health` path in CI and on the production host. A failed production health check triggers rollback to the previous recorded SHA.

### Registry pull failure

Examples: GHCR outage, expired/insufficient package permission, network/DNS failure.

Protection: `docker compose pull` happens before `up`. A pull failure exits before intentionally replacing the running release.

### Port conflict or broken host reverse proxy

Examples: another service owns port 8080, host Nginx/Caddy configuration is invalid, TLS certificate expired.

Protection: a container port conflict fails deployment, but the internal health check cannot validate public DNS/TLS. Monitor the public URL separately after the host ingress is configured.

### Disk exhaustion

Docker image pulls/builds can fail when the host disk is full. Keep enough space for at least current + previous release images and Docker metadata. Do not automatically prune the previous release image because it is the immediate rollback target.

### Server architecture mismatch

The workflow currently targets an `x64` production runner. An ARM server needs a deliberate multi-architecture image build change before deployment.

### Future database migrations

The current runtime does not require a database migration step. If persistence/Doctrine migrations are introduced later, do not simply insert `doctrine:migrations:migrate` into this workflow. First define a backward-compatible migration and rollback/roll-forward strategy so old and new application versions can coexist during a failed deployment.

### Runtime configuration changed outside Git

Application image rollback does not version operator-managed secrets/configuration. If `/etc/wallet-generator/runtime.env` is edited incompatibly, rolling back the image alone may not restore service. Treat production configuration changes as separate reviewed operations and keep a secure operator-side backup/versioning procedure.

## CI rules for deployment changes

Changes to any of these files are production/deployment changes:

- `.github/workflows/production-deploy.yml`;
- `compose.prod.yaml`;
- `docker/php/Dockerfile.prod`;
- `docker/php/start-prod.sh`;
- `docker/nginx/**` when it changes the production image/runtime;
- `scripts/deploy-production.sh`;
- `deploy/runtime.env.example`.

For such changes CI must at minimum:

1. syntax-check deployment shell scripts;
2. build both production images from scratch or a valid Docker cache;
3. validate `compose.prod.yaml` with production-like required variables;
4. start the production topology on an isolated CI port;
5. wait for container health;
6. call `/api/health` through Nginx;
7. print Compose status/logs on failure;
8. never use the production self-hosted runner for PR validation.

The integration smoke workflow covers these checks on GitHub-hosted runners.

## Existing deploy-time fee/provider environment helper

The repository-root `.env` helper remains useful for the development/local Compose topology. It is generated during deployment-style local testing and must not be committed.

Base values live in `.env.example`. Operator-controlled values can live in a separate env file outside Git, for example:

```dotenv
DOGE_RECOMMENDED_FEE_RATE=0.02
BTC_RECOMMENDED_FEE_RATE=0.00020000
ETHEREUM_RPC_URL=https://your-ethereum-provider.example/your-secret-key
```

Build the local/runtime env with:

```bash
sh scripts/build-deploy-env.sh /etc/wallet-platform/runtime.env .env
```

The builder removes base assignments for keys present in the operator file and appends operator values once. The generated `.env` is created with restrictive permissions (`umask 077`).

Provider credentials/API keys must stay in deployment secrets or operator-controlled environment files and must never be committed to Git. Application/provider logs must not include the Ethereum RPC URL, embedded credentials, signing material or raw signed Ethereum transactions.
