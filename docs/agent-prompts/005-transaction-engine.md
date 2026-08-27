# Prompt 005 — Build the transaction engine

Task: implement the first production-oriented transaction workflow for UTXO chains, starting with Dogecoin.

Required concepts:

- idempotency key on create/send requests;
- explicit transaction state machine;
- PostgreSQL transaction boundaries;
- UTXO selection and reservation;
- protection against two concurrent requests selecting the same outpoint;
- transactional outbox;
- Messenger processing for prepare/broadcast/retry/confirmation work;
- deterministic failure states and retry semantics;
- human-readable review data before irreversible broadcast.

Use database locking appropriate for concurrent workers; design for multiple Messenger consumers.

Do not store plaintext private keys/WIF/seed phrases.

Do not treat RabbitMQ delivery as the source of truth; PostgreSQL is authoritative.

Add concurrency/integration tests for duplicate requests and UTXO races.

Suggested commit: `feat(transaction): add idempotent utxo transaction workflow`.