# Architecture

Current architecture documents:

- `ADR-001-modular-monolith.md` — supported Symfony modular-monolith architecture;
- `MODULE_BOUNDARIES.md` — backend module dependency rules and enforcement;
- `ADAPTER_REGISTRY.md` — chain/network/asset-route registry model and fail-closed invariants;
- `ETHEREUM_BACKEND.md` — Ethereum Mainnet public-state/preparation backend contract, without broadcast;
- `ETHEREUM_FRONTEND.md` — browser-local Ethereum wallet and EIP-1559 Type-2 signing contract;
- `USDT_ERC20.md` — USDT ERC-20 balance, calldata and shared Ethereum wallet runtime.
- `TRON_TRC20.md` — separate TRON wallet, deterministic TRC-20 signing and public preparation/status;
- `../SECURITY_MODEL.md` — user-controlled publication, trust boundaries and self-hosting assumptions;
- `../PUBLIC_RELEASE_AUDIT.md` — release audit scope, findings and limitations.
