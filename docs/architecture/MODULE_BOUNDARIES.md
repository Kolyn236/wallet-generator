# Symfony module boundaries

This document makes ADR-001 executable. The backend is one Symfony modular monolith, but business modules own their model and expose dependencies through Domain/Application contracts.

## Modules

- `Wallet` — wallet identity, addresses and ownership metadata.
- `Asset` — chains, networks, native assets and tokens.
- `Transaction` — transaction lifecycle, idempotency and orchestration.
- `Blockchain` — chain-neutral capabilities and concrete chain adapters.
- `Signer` — signing boundary and key references; never plaintext secret persistence.
- `Indexer` — blockchain synchronization, spendable state and confirmations.

Each module starts with a README instead of empty layer directories. `Domain`, `Application`, `Infrastructure` and `Presentation` are added only when real code needs them.

## Dependency direction

```text
HTTP / Console / Worker entry points
              |
              v
        Presentation
              |
              v
        Application <--------- Infrastructure
              |                       |
              v                       |
            Domain <------------------+
```

Rules:

1. `Domain` is framework-agnostic. It must not import Symfony, Doctrine, Redis clients, RabbitMQ clients, provider SDKs or HTTP clients.
2. `Presentation` may call Application contracts. It never calls Infrastructure directly.
3. `Infrastructure` implements ports owned by Domain/Application; it is not a public API for other modules.
4. Cross-module dependencies may target another module's Domain/Application public contracts only. Never import another module's Infrastructure or Presentation.
5. Avoid generic `Service`, `Helper`, `Utils` dumping grounds. Name code after the capability it implements.
6. The current platform-level health endpoint remains outside business modules because it is an application-shell concern.

## Initial dependency graph

```text
Asset
  ^
  |
Wallet
  ^
  |
Transaction -----> Blockchain
     |                 ^
     +-----> Signer    |
                       |
Indexer ---------------+
```

This graph is guidance, not permission to import concrete implementations. For example, `Transaction` may depend on a signing or chain capability contract, but must not instantiate `DogecoinAdapter`, a RabbitMQ producer or a BlockCypher client directly.

`Indexer` may publish state/confirmation changes through Application contracts/events; it must not mutate another module's persistence implementation directly.

## Enforcement

`tests/Architecture/ModuleBoundariesTest.php` enforces the rules that are practical to check without introducing an architecture-test dependency:

- all six module roots exist;
- Domain code cannot reference forbidden infrastructure/framework namespaces;
- no module may import another module's `Infrastructure` or `Presentation` namespace;
- Presentation cannot import its own Infrastructure directly;
- generic dumping-ground directories are rejected.

The tests intentionally do not invent domain interfaces before real behavior exists. New ports are introduced together with the first use case that needs them.
