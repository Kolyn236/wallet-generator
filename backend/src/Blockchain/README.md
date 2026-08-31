# Blockchain module

Owns chain-neutral blockchain capabilities and concrete chain adapters.

UTXO and account-based chains are intentionally not forced into one universal wallet abstraction. The application layer exposes a small `ChainAdapter` identity contract plus separate capabilities for balance lookup, UTXO lookup, UTXO fee rates and raw-transaction broadcast. Concrete adapters are registered by `chain:network` through Symfony DI.

Current registrations:

- `dogecoin:mainnet` -> `DogecoinMainnetAdapter`;
- `bitcoin:mainnet` -> `BitcoinMainnetAdapter`.

Adapters delegate to the existing typed application ports and BlockCypher infrastructure. Adding a future EVM adapter must not require UTXO capabilities or central chain switch statements.
