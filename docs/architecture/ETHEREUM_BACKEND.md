# Ethereum Mainnet backend contract

The Ethereum backend is a non-custodial public-state and broadcast gateway for browser-local signers.

## Runtime identity

The backend registry key is exactly:

```text
ethereum:mainnet
```

The adapter exposes EVM-specific capabilities for native ETH balance, ERC-20 balance reads, pending nonce, gas estimation and EIP-1559 fee quoting, plus signed raw transaction broadcast. It deliberately does not expose UTXO capabilities.

## Provider boundary

`ETHEREUM_RPC_URL` configures the Ethereum Mainnet JSON-RPC provider. The URL may contain an API key and must never be committed or logged.

Only RPC methods required by live Ethereum routes are used:

- `eth_chainId`;
- `eth_getBalance`;
- `eth_call` for ERC-20 balance reads;
- `eth_getTransactionCount` with the `pending` tag;
- `eth_estimateGas`;
- `eth_feeHistory`;
- `eth_sendRawTransaction`.

Every operation fails closed unless `eth_chainId` resolves to chain ID `1`.

ERC-20 calls are exposed through a capability, but public route-specific use cases choose their own fixed token contract. The USDT endpoint does not accept an arbitrary contract address from the HTTP caller.

## Integer and ABI safety

Wei, nonce, gas, fee and token smallest-unit quantities are represented at Application/HTTP boundaries as canonical decimal strings. Provider hex quantities are validated and converted losslessly with decimal-string arithmetic; PHP floating point and signed machine integers are never used for EVM amount arithmetic.

ERC-20 `balanceOf` provider output is validated as one exact 32-byte ABI uint256 word before conversion.

The fee-selection policy is:

```text
maxFeePerGas = 2 * baseFeePerGas + maxPriorityFeePerGas
```

This is wallet policy, not a protocol constant. Missing or malformed EIP-1559 data fails explicitly instead of silently falling back to legacy gas pricing.

## HTTP API

```text
GET  /api/chains/ethereum/mainnet/addresses/{address}/balance
GET  /api/chains/ethereum/mainnet/tokens/usdt/addresses/{address}/balance
POST /api/chains/ethereum/mainnet/transactions/prepare
POST /api/chains/ethereum/mainnet/transactions/broadcast
```

Prepare accepts only public transaction intent fields: `from`, `to`, `valueWei` and `data`. The same prepare endpoint supports native ETH and token contract calls. Broadcast accepts only an already-signed `rawTransaction`.

Symfony never receives an Ethereum mnemonic or private key and never signs Ethereum transactions.

See `USDT_ERC20.md` for the fixed USDT contract, decimals and token transfer flow.
