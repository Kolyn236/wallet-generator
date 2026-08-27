# Prompt 002 — Establish module boundaries

Read the repository architecture ADR and migration plan first.

Task: create the initial Symfony modular-monolith boundaries without implementing business behavior.

Create modules:

- Wallet
- Asset
- Transaction
- Blockchain
- Signer
- Indexer

Within modules use `Domain`, `Application`, `Infrastructure`, `Presentation` only where needed.

Rules:

- Domain must be framework-agnostic.
- Domain must not depend on Doctrine, Symfony, Redis, RabbitMQ or HTTP clients.
- Presentation may call Application, never Infrastructure directly.
- Infrastructure implements ports owned by Domain/Application.
- Avoid generic `Service/`, `Helper/` or `Utils/` dumping grounds.
- Do not create fake abstractions just to fill directories.
- Add architecture/dependency tests where practical.
- Do not migrate DOGE code yet.

Deliver a short dependency diagram in docs and keep the commit structural only.

Suggested commit: `refactor(architecture): establish wallet platform module boundaries`.