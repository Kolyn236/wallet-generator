# USDT ERC-20 on Ethereum Mainnet

Native ETH and USDT ERC-20 share one `ethereum-mainnet` wallet identity but remain separate asset routes.

## Fixed token identity

```text
asset route:       usdt-ethereum-mainnet-erc20
chain/network:     ethereum:mainnet
contract:          0xdAC17F958D2ee523a2206206994597C13D831ec7
decimals:          6
balance selector:  0x70a08231  balanceOf(address)
transfer selector: 0xa9059cbb  transfer(address,uint256)
```

The contract address is fixed in the application. The public HTTP API does not accept an arbitrary ERC-20 contract address for the USDT route.

Tether documents this address for USD₮ on Ethereum. The deployed token uses 6 decimals. Tether's legacy Ethereum contract does not return the modern Boolean value from `transfer`; the wallet does not depend on decoding a transfer return value because it signs/broadcasts the transaction itself.

## Balance flow

```text
Ethereum address
      |
      v
Symfony USDT balance endpoint
      |
      v
ethereum:mainnet adapter
      |
      v
eth_call
  to   = USDT contract
  data = balanceOf(address)
      |
      v
32-byte ABI uint256 result
      |
      v
canonical decimal smallest units
      |
      v
6-decimal USDT display value
```

Provider output is validated as exactly one 32-byte ABI word before conversion.

## Transfer flow

```text
source Ethereum address + browser-local private key
recipient Ethereum address + USDT amount
      |
      v
Browser
  parse amount to 6-decimal integer units
  encode transfer(recipient, amount)
      |
      +--> Symfony token balance lookup
      |
      +--> Symfony Ethereum prepare
             from     = source
             to       = USDT contract
             valueWei = 0
             data     = transfer calldata
      |
      v
Symfony / Ethereum RPC
  pending nonce
  sender native ETH balance
  eth_estimateGas
  eth_feeHistory
      |
      v
Browser
  verify prepared intent matches the exact contract/calldata
  verify USDT balance covers token amount
  verify ETH balance covers gasLimit * maxFeePerGas
  sign EIP-1559 Type-2 transaction locally
  calculate local transaction hash
      |
      v
human-readable review
      |
      v
explicit broadcast of signed raw transaction
      |
      v
compare provider transaction hash with local hash
```

## Non-custodial boundary

The private key and seed stay in browser memory. Symfony receives only public addresses, token balance calls and unsigned public transaction intent. Signed transaction publication goes directly from the browser to a user-selected Ethereum RPC endpoint or through explicit export for external publication, never through Symfony.

ETH and USDT route balances are stored independently by asset route. Replacing the shared Ethereum wallet identity invalidates both balances together.

USDT TRC-20 uses a separate `tron-mainnet` wallet identity and asset-route adapter. Selecting USDT's network is neither swap nor bridge and never converts or moves tokens. See `TRON_TRC20.md` and `../SECURITY_MODEL.md`.
