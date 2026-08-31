# Blockchain module

Owns chain-neutral blockchain identity plus capability-specific chain adapters.

UTXO and account-based chains are intentionally not forced into one universal wallet abstraction. The application layer exposes a small `ChainAdapter` identity contract and separate capabilities selected by each chain family.

Current registrations:

- `dogecoin:mainnet` -> `DogecoinMainnetAdapter`;
- `bitcoin:mainnet` -> `BitcoinMainnetAdapter`;
- `ethereum:mainnet` -> `EthereumMainnetAdapter`.

DOGE/BTC keep the existing UTXO capabilities. Ethereum Mainnet implements EVM-specific capabilities for native balance, pending nonce, gas estimation and EIP-1559 fee quotes, plus the existing raw signed transaction broadcast capability. Ethereum deliberately does **not** implement UTXO lookup or UTXO fee-rate capabilities.

## Ethereum Mainnet

Ethereum backend access is configured with:

```text
ETHEREUM_RPC_URL
```

The URL may contain an operator API key but must never be committed or logged. Leaving it empty keeps DOGE/BTC startup working; an attempted Ethereum operation then fails explicitly with `provider_not_configured`.

The focused JSON-RPC client uses only the methods needed by the current backend feature:

- `eth_chainId`;
- `eth_getBalance`;
- `eth_getTransactionCount` with `pending`;
- `eth_estimateGas`;
- `eth_feeHistory`;
- `eth_sendRawTransaction`.

Every Ethereum operation verifies that the configured provider reports chain ID `1`. Another EVM chain fails closed with `provider_wrong_chain`.

Provider responses are treated as untrusted: JSON-RPC shape/id/error fields, canonical hex quantities and broadcast transaction hashes are validated before use. EVM quantities are converted exactly with GMP and are exposed through Application/HTTP boundaries as canonical decimal strings; they are never cast to PHP `int` or float.

The EIP-1559 wallet policy uses the next base fee from `eth_feeHistory`, the provider's 50th-percentile priority-fee reward from the latest returned block, and computes:

```text
maxFeePerGas = 2 * baseFeePerGas + maxPriorityFeePerGas
```

This is a deterministic wallet fee-selection policy, not an Ethereum protocol constant. If required EIP-1559 data is unavailable, fee preparation fails explicitly instead of falling back to legacy `gasPrice`.

The prepare endpoint accepts only public transaction intent (`from`, `to`, `valueWei`, `data`). Symfony never generates or receives mnemonic/private-key material and never signs a transaction. Broadcast accepts only a signed raw transaction and does not log it.

The frontend ETH route remains unavailable until the separate browser-wallet/signing PR is complete.
