# Prompt 003 — Add persistence, Redis and Messenger transports

Read ADR-001 and the migration plan.

Task: introduce persistence and asynchronous infrastructure without yet moving DOGE transaction behavior.

Requirements:

- PostgreSQL through Doctrine;
- Redis connection/cache/lock infrastructure;
- Symfony Messenger with RabbitMQ transports: `transactions`, `blockchain`, `notifications`;
- failed transport and retry policy;
- worker containers/process definitions using the same Symfony image as HTTP;
- initial persistence model for wallets, addresses, assets, transactions, UTXOs, idempotency keys and outbox messages;
- migrations and integration tests.

Security:

- never add plaintext WIF/private-key/seed columns;
- secrets belong in environment/secret management, not source control.

Consistency:

- design UTXO status so `AVAILABLE`, `RESERVED`, `SPENT` can be represented;
- transaction status must be explicit;
- add uniqueness/indexes required for idempotency and outpoints.

Do not route normal GET endpoints through RabbitMQ.

Suggested commit: `feat(infra): add postgres redis and messenger foundations`.