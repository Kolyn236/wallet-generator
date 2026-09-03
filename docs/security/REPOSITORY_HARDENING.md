# Repository hardening

This document defines the repository-level security controls expected for ChainCourier.

ChainCourier is non-custodial, but the frontend dependency and CI supply chain is still a security boundary: code shipped to the browser can access seed phrases, WIFs and private keys while an unlocked wallet session exists in memory.

## Dependency audit policy

The Quality Gate runs explicit dependency vulnerability checks after deterministic lock-file installs.

### Backend

```bash
composer audit --locked --no-dev --abandoned=report
```

The audit is evaluated against production packages from `composer.lock`. Security advisories are blocking. Abandoned-package information is reported but is not, by itself, treated as a vulnerability gate in this PR.

### Frontend

```bash
npm audit --omit=dev --audit-level=high
```

The frontend gate audits production dependencies only and fails on **high** or **critical** advisories. Low/moderate advisories and development-only advisories do not block the Quality Gate, avoiding permanent CI noise from tooling that is not shipped to users. They should still be reviewed when Dependabot reports an applicable update.

Do not replace these named audit steps with install-time audit output. `npm ci --no-audit` remains intentional because the explicit audit command is the quality gate.

No advisory is silently ignored in repository configuration. If a future advisory must be temporarily accepted, document the package, advisory identifier, affected version/range, applicability analysis, compensating control, owner and removal condition in the pull request that introduces the exception.

## Dependabot policy

`.github/dependabot.yml` checks npm, Composer and GitHub Actions weekly.

Routine minor/patch updates may be grouped to reduce PR noise. Major updates remain separate. Frontend cryptographic packages matching `@noble/*` and `@scure/*` are excluded from the routine production group so they receive focused review even for apparently small version changes.

Dependabot PRs are **not** auto-merged. They must pass the normal Quality Gate and Integration Smoke checks before merge. Updates touching cryptographic primitives require the same deterministic wallet-vector review as any other crypto-sensitive change.

## GitHub Actions integrity

Every remote `uses:` reference in `.github/workflows/*.yml` and `.github/workflows/*.yaml` is pinned to a full 40-character commit SHA. A human-readable major-version comment is kept beside the pin where useful.

`scripts/check-repository-security.py` enforces immutable remote Action references so a future workflow cannot silently regress to a mutable tag such as `@v4`. Local repository actions using `./...` are allowed.

Dependabot maintains the GitHub Actions pins. Do not add a third-party Action when an existing tool or a small shell/Python step is sufficient.

CI workflows in this repository use `permissions: contents: read`. New write permissions require a narrowly scoped, documented need and should be job-specific rather than broad workflow permissions.

## Pull-request integration smoke

`Integration Smoke` runs for every pull request. Pushes to `main` retain path filtering to avoid unnecessary post-merge Docker work.

The all-PR trigger is deliberate: it makes `Integration Smoke` safe to configure as a required check because GitHub will not leave it permanently "expected" merely because a pull request changed a path outside a filter.

The smoke test remains deterministic and uses local/default provider configuration. Normal CI must not require live blockchain provider credentials or a live mainnet transaction.

## Repository security regression guardrails

The Quality Gate runs `scripts/check-repository-security.py`. The script intentionally protects concrete repository invariants rather than attempting generic secret detection.

It checks that:

- production Compose fixes `APP_ENV=prod` and `APP_DEBUG=0`;
- production Compose requires `APP_SECRET` instead of providing a default;
- `start-prod.sh` still rejects known development/test `APP_SECRET` placeholders and enforces the minimum secret length;
- production env examples do not contain a real `APP_SECRET` or credential-bearing provider URL;
- known deployment env files are not tracked in Git;
- Nginx CSP keeps every `script-src` restricted exactly to `'self'`;
- every remote GitHub Action is pinned to a full immutable commit SHA.

Integration Smoke separately verifies the resolved production Compose model, production image/runtime, and rejection of a known placeholder `APP_SECRET`.

This is not a homemade arbitrary-secret scanner. Real secret scanning should use a maintained security product if/when it is enabled at repository/account level.

## Secret management

| Value | Git / examples | GitHub Actions secrets or variables | Deployment host environment |
| --- | --- | --- | --- |
| Public blockchain address / TXID / transaction hash | Allowed when useful | Usually unnecessary | Allowed |
| Non-secret defaults such as documented fee rates | Allowed in `.env.example` | Variable if operationally useful | Allowed |
| `APP_SECRET` | Never commit a real value; deployment example must remain blank | Only if a future workflow genuinely needs to inject it | Preferred production location |
| Provider URL containing API credentials | Never commit; example value must remain blank | Secret only when CI/deploy genuinely needs it | Preferred production location |
| Seed phrase / private key / WIF | **Never** | **Never** | **Never** |

Wallet signing material has no legitimate backend, CI or deployment use. Seed phrases, private keys and WIFs must stay browser-local and must never be placed in GitHub Actions secrets.

`.env.example` files document names and non-secret defaults only. Production secrets belong in an operator-controlled environment file outside the Git checkout, such as the deployment host runtime file described in `deploy/README.md`.

## Desired protection for `main`

Configure the repository so `main` has the following rules:

- changes enter through pull requests;
- **Quality Gate** is required;
- **Integration Smoke** is required;
- required checks/branches must be up to date before merge where practical;
- force pushes are disabled;
- branch deletion is disabled;
- administrators do not routinely bypass these rules.

At the time this document was added, the connected automation had repository admin-level code access but could not read or change the effective protection/ruleset configuration: the branch-protection endpoint returned `403 Resource not accessible by integration`, and the repository-rulesets endpoint returned a private-repository plan restriction. No repository governance setting was changed by this PR.

### Manual post-merge configuration

After this PR and its stack base are merged:

1. Open repository **Settings → Rules → Rulesets** (or **Branches → Branch protection rules** if that is what the current plan exposes).
2. Target the `main` branch.
3. Require changes through a pull request.
4. Require the checks named **Quality Gate** and **Integration Smoke**.
5. Require the branch to be up to date before merge if that setting is compatible with the team's merge flow.
6. Keep force pushes and branch deletion disabled.
7. Avoid routine administrator bypass.

If the repository plan does not expose the required private-repository rules, treat that as an unresolved governance limitation rather than assuming the code-level CI configuration provides equivalent protection.
