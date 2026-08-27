# Transaction module

Owns transaction lifecycle, idempotency, orchestration and explicit state transitions.

It coordinates capabilities from Wallet, Asset, Blockchain and Signer through contracts. It must not depend directly on provider clients, RabbitMQ transports or another module's Infrastructure.
