# Public-release audit

This audit prepares the repository for a later public release. It does not change visibility or publish a release. Repeat the final scans on the exact release commit and built assets.

## Scope and tooling

- Inspected tracked `.env` files and examples, Compose/deployment settings, Nginx/frontend build configuration and GitHub Actions secret references.
- Gitleaks `8.30.1` release archive verified against the upstream release SHA-256 checksums before execution.
- Ran a redacted scan of reachable Git history (485 commits at reconnaissance) and a copied candidate source tree, excluding ignored dependencies/build output. Findings were reviewed without printing candidate secret values.
- A secret scanner is heuristic: an absence of real findings does not prove that no credential ever existed, and public addresses/hashes/test vectors are not credentials merely because they have high entropy.

## Initial findings and classification

The history scan reported five generic-key candidates:

1. Historical `frontend/scripts/tron-vector-test.ts`: explicitly deterministic BIP39/BIP44 test fixture.
2. Historical `backend/tests/Blockchain/ProviderProtectionTest.php`: provider-cache test input, not a deployed provider credential.
3. `frontend/scripts/usdt-erc20-vector-test.ts`: public deterministic Ethereum signing fixture.
4. `frontend/scripts/ethereum-vector-test.ts`: standard public Hardhat mnemonic/key vector.
5. Historical `README.md`: public compressed key from the documented private-key-1 test vector, not a secret.

The first candidate-tree scan reported only three signing-fixture candidates (Ethereum, ERC-20 and new TRON tests). These must remain clearly marked public, test-only and never funded. No broad test-directory exclusion is used to hide future findings.

Tracked `backend/.env` is an intentional Symfony development-default file, not operator configuration: its application-secret value is a change-me placeholder, default URI is localhost, and RPC URL is empty in the baseline. Other tracked environment examples contain fee defaults/placeholders and empty RPC configuration. Operator `.env` files and local overrides are ignored; keep real endpoints/credentials outside Git.

Neither existing GitHub Actions workflow references an application/provider secret. The frontend Docker build has no provider-key build argument. Backend RPC runtime settings must not become Vite build variables or responses to the browser.

## Runtime/deployment considerations

The bundled Compose stack is for local development and enables debug with a public development placeholder secret. Do not expose it as a production recipe. Configure production debug/HTTPS/logging/rate/resource controls explicitly. Backend provider URLs may embed authentication and must never be logged. Browser broadcast destinations are separately selected by the user; backend credentials are not forwarded to the frontend.

The Nginx CSP permits HTTPS direct providers and loopback endpoints while keeping scripts same-origin, no inline/eval allowance, frame denial and no-referrer policy. Locations setting cache headers must explicitly retain the shared security headers because Nginx header inheritance otherwise drops them.

## Final verification record

The implementation verification executed all 20 phases from `.hermes/verify.yaml` in Docker (PHP 8.4.26 and Node 24 Alpine): PHP syntax, Composer metadata/install, PHPUnit (149 tests / 1,580 assertions), PHPStan, style, npm clean install, registry invariants, six deterministic chain/token vectors, TRON API/review/signing flow, browser broadcast, explicit signing-stage regressions, EN/RU chooser, public-runtime CSP checks and production build. `git diff --check` passed. The final PR records the exact head and any later rerun.

The candidate source scan reported three generic-key findings, all classified public Ethereum/ERC-20/TRON deterministic signing fixtures. The rebuilt frontend scan reported zero findings. No real tracked credential was identified in the inspected candidate source, reachable-history findings, configuration or built assets. The final release still requires an exact-head rerun; this is not an absolute guarantee of secret absence.

Dependency audits initially identified Vite/source-map-js and Symfony HTTP Foundation/YAML advisories. The implementation pins Vite 8.3.4 and updates the two affected Symfony packages to 7.4.21 in their lockfiles, without changing the cryptographic dependency pins. Subsequent `npm audit` and `composer audit` returned no advisories.

Docker Compose built and started the integrated runtime. The actual HTML response retained CSP/referrer/frame/nosniff headers; Nginx configuration validated. Actual HTTP probes returned 404 for all five removed chain broadcast URLs. Deploy-env builder probes verified unique DOGE/BTC/TRON overrides and file mode 0600 without creating operator files in the checkout.

A headless Chrome mobile-width smoke exercised TRON public preparation, unsigned review, local signing, an intentionally failed direct submission and byte-identical explicit retry, followed by solidified execution status and EN/RU switching. Provider responses were explicitly simulated; no funded or real mainnet transaction was submitted. The browser check confirmed no horizontal overflow and no secret persistence (only language in localStorage, empty sessionStorage). Source/network tests cover the public-only gateway payload boundary; a hostile frontend/device remains outside these guarantees.

MIT licensing was selected explicitly by the repository owner; `LICENSE` and package metadata reflect that choice. Repository visibility was not changed. Default development Compose settings remain unsuitable for unmodified production exposure, and external provider CORS/authentication/availability remain operator/user responsibilities.

Independent review found a React lifecycle regression in compatibility-wallet object dependencies. It was reproduced in mounted Chrome before the fix; primitive identity/material dependencies now preserve unsigned review, signed bytes, pending submission and originating results during language/balance rerenders. A 20-case dependency/effect regression suite and mounted browser smoke passed after the fix, followed by a complete 20-phase verification rerun.
