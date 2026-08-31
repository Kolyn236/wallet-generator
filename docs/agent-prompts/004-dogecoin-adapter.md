# Historical prompt 004 — First Dogecoin adapter

## Status

Completed and superseded. This file is retained only as migration history; it is not a current instruction for coding agents.

This milestone introduced Dogecoin behind chain-neutral Application ports, validated provider responses and kept BlockCypher-specific HTTP behavior in Infrastructure. It preceded the current capability-based `ChainAdapterRegistry` and browser-local TypeScript signer.

Current Dogecoin work must follow `AGENTS.md` and `docs/architecture/ADAPTER_REGISTRY.md`: wallet creation/signing stays browser-local, Symfony receives no signing secrets, runtime lookup is exact/fail-closed, and deterministic TypeScript vectors protect derivation and transaction serialization.

Original outcome commit scope: `feat(dogecoin): add chain adapter and balance provider`.
