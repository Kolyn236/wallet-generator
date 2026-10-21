# Blockchain module

Owns chain-neutral blockchain identity plus capability-specific chain adapters.

UTXO and account-based chains are intentionally not forced into one universal wallet abstraction. The application layer exposes a small `ChainAdapter` identity contract and separate capabilities selected by each chain family.

Current registrations:

- `dogecoin:mainnet` -> `DogecoinMainnetAdapter`;
- `bitcoin:mainnet` -> `BitcoinMainnetAdapter`;
- `litecoin:mainnet` -> `LitecoinMainnetAdapter`;
- `ethereum:mainnet` -> `EthereumMainnetAdapter`.
- `tron:mainnet` -> `TronMainnetAdapter`.

DOGE/BTC/LTC expose public UTXO state/fee capabilities. Bitcoin public-address lookups accept mainnet legacy P2PKH and P2SH Base58Check addresses; browser-local signing remains P2PKH-only. Ethereum implements native/token balance, nonce, gas and EIP-1559 fee capabilities, not UTXO operations. TRON exposes fixed-USDT balance, public preparation/resources and execution/confirmation status. No backend adapter broadcasts or receives signed bytes for publication.

## Ethereum Mainnet

Ethereum backend access is configured with:

```text
ETHEREUM_RPC_URL
```

The URL may contain an operator API key but must never be committed or logged. Leaving it empty keeps DOGE/BTC startup working; an attempted Ethereum operation then fails explicitly with `provider_not_configured`.

The focused JSON-RPC client uses only the methods needed by the current backend features:

- `eth_chainId`;
- `eth_getBalance`;
- `eth_call` for fixed ERC-20 balance reads;
- `eth_getTransactionCount` with `pending`;
- `eth_estimateGas`;
- `eth_feeHistory`.

Every Ethereum operation verifies that the configured provider reports chain ID `1`. Another EVM chain fails closed with `provider_wrong_chain`.

Provider responses are treated as untrusted: JSON-RPC shape/id/error fields, canonical hex quantities and ERC-20 ABI return words are validated before use. EVM quantities are converted exactly with decimal-string arithmetic and exposed through Application/HTTP as canonical decimal strings, never PHP `int` or float.

USDT ERC-20 uses the fixed Ethereum Mainnet contract `0xdAC17F958D2ee523a2206206994597C13D831ec7`. The public USDT balance endpoint does not accept arbitrary token contracts; the adapter uses `eth_call balanceOf(address)` and returns exact 6-decimal token units.

The EIP-1559 wallet policy uses the next base fee from `eth_feeHistory`, the provider's 50th-percentile priority-fee reward from the latest returned block, and computes:

```text
maxFeePerGas = 2 * baseFeePerGas + maxPriorityFeePerGas
```

This is a deterministic wallet fee-selection policy, not an Ethereum protocol constant. If required EIP-1559 data is unavailable, fee preparation fails explicitly instead of falling back to legacy `gasPrice`.

The prepare endpoint accepts only public transaction intent (`from`, `to`, `valueWei`, `data`). Native ETH uses recipient `to`; USDT ERC-20 uses the fixed token contract, zero native value and locally encoded `transfer(address,uint256)` calldata. Symfony never receives mnemonic/private-key material, signs or broadcasts. The browser publishes via a separately selected direct provider or exports signed bytes. See `docs/SECURITY_MODEL.md` and `docs/architecture/TRON_TRC20.md`.

The live frontend ETH and USDT ERC-20 routes consume this contract. Both share one Ethereum wallet identity while keeping route-specific balances and transfer behavior. The browser signs EIP-1559 Type-2 transactions locally and compares its local transaction hash with the provider-returned hash after explicit broadcast.
