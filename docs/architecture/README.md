# Architecture

[Project overview](../../README.md)

## Runtime overview

```text
Browser
   |
   |  network-scoped wallet sessions
   |  local DOGE / BTC / LTC / Ethereum / TRON signers
   v
Nginx :8080
   |---- / ----------> React + TypeScript
   |
   +---- /api/* -----> Symfony / PHP-FPM
                         |
                         +--> chain/network capability adapters
                                |
                                +--> blockchain nodes/providers
```


## Stack

- PHP 8.4;
- Symfony 7.4 LTS;
- React 19 + TypeScript;
- Vite;
- Nginx + PHP-FPM;
- Docker Compose;
- PHPUnit, PHPStan, PHP-CS-Fixer;
- GitHub Actions.

PostgreSQL, Redis and RabbitMQ are not required by the current runtime. Add persistence, cache, queues or indexing only for concrete product/load requirements.


## Architecture documents

- [Architecture decision](ADR-001-modular-monolith.md) — supported Symfony modular monolith.
- [Module boundaries](MODULE_BOUNDARIES.md) — backend dependency rules and enforcement.
- [Adapter registry](ADAPTER_REGISTRY.md) — wallet derivation, network identity, asset routes and fail-closed lookup.
- [Frontend asset catalog](FRONTEND_ASSET_CATALOG.md) — catalog model and route metadata.
- [UTXO runtime and extension guide](UTXO_EXTENSION_GUIDE.md) — DOGE/BTC transfer flow and legacy P2PKH profiles.
- [Ethereum backend](ETHEREUM_BACKEND.md) — public preparation, canonical quantities and fee policy.
- [Ethereum frontend](ETHEREUM_FRONTEND.md) — local Type-2 signing and transaction review.
- [USDT ERC-20](USDT_ERC20.md) — fixed token contract, calldata, balance and shared Ethereum wallet.
- [TRON TRC-20](TRON_TRC20.md) — separate wallet, local signing, public preparation and status.
- [Security model](../SECURITY_MODEL.md) — publication boundary and self-hosting assumptions.
- [Public-release audit](../PUBLIC_RELEASE_AUDIT.md) — release audit scope, findings and limitations.
