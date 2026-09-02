# GitHub Actions rules

These rules apply to workflow changes under `.github/`.

## CI runner boundary

- Pull-request and ordinary verification jobs run on GitHub-hosted runners such as `ubuntu-latest`.
- Never run `pull_request` code on the production self-hosted runner.
- The production runner is dedicated to the production deployment job and is selected by all of these labels: `self-hosted`, `linux`, `x64`, `production`, `wallet-generator`.
- Do not broaden production runner triggers to arbitrary branches, forks, issue events or user-controlled code paths.
- Production deployment is restricted to commits reachable from `main`.

A user with Docker access on the production runner is effectively highly privileged on that host. Treat workflow code that targets the runner as production infrastructure code.

## Release invariants

- Build release artifacts/images on GitHub-hosted infrastructure, not on the production server.
- Production deploys exact commit-SHA image tags from GHCR. Do not deploy mutable `latest` tags.
- Smoke-test the exact production PHP and Nginx images before publishing/deploying them.
- Validate the production Compose file with required production-like variables before deployment.
- Production health is the end-to-end Nginx -> PHP-FPM -> Symfony `/api/health` path.
- A release is not successful until the production health check passes.
- Preserve the previous healthy SHA as the immediate rollback target.
- Registry/image pull must happen before intentionally replacing the running release.
- Do not delete/prune the previous release image as part of the deployment workflow.

## Secrets

- Never commit production runtime values or provider credentials.
- Production application configuration lives outside the checkout at `/etc/wallet-generator/runtime.env` unless the deployment architecture is explicitly redesigned.
- GHCR authentication uses the scoped GitHub Actions token; do not add long-lived registry passwords when `GITHUB_TOKEN` is sufficient.
- Never add seed phrases, WIFs, private keys or signing material to Actions secrets, workflow logs, artifacts or production configuration.

## Deployment workflow changes

Changes to `.github/workflows/production-deploy.yml`, `compose.prod.yaml`, production Dockerfiles/entrypoints or `scripts/deploy-production.sh` require GitHub-hosted integration smoke coverage before merge.

When persistence/database migrations are introduced, do not add an automatic migration command until a backward-compatible deploy and rollback/roll-forward strategy is documented and tested.

Operational details and failure modes are documented in `deploy/README.md`.
