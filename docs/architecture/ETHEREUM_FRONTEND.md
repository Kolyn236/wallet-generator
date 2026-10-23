# Ethereum Mainnet frontend contract

The native ETH frontend route is a browser-local non-custodial runtime layered on the Symfony Ethereum Mainnet backend.

## Wallet identity

The wallet-network key is:

```text
ethereum-mainnet
```

Locally created wallets use BIP39 + BIP44:

```text
m/44'/60'/0'/0/0
```

The derived secp256k1 private key is represented by the generic browser signing-material contract as `kind = private-key`. It remains in browser memory and is never sent to Symfony.

## Native ETH asset route

The live native route is:

```text
eth-ethereum-mainnet-native
```

It owns native ETH balance loading and transfer behavior. USDT ERC-20 shares the same `ethereum-mainnet` wallet identity with an independent asset-route adapter and balance.

## End-to-end transaction flow

Native ETH and ERC-20 token transfers share the same EIP-1559 signing engine.

```text
Browser public intent
from / to / valueWei / data
        |
        v
Symfony -> Ethereum Mainnet JSON-RPC
        |
        +--> verify chainId = 1
        +--> sender native ETH balance
        +--> pending nonce
        +--> eth_estimateGas
        +--> eth_feeHistory
        |
        v
public preparation snapshot
        |
        v
Browser
verify private key <-> sender
verify returned intent exactly
sign Type-2 transaction locally
calculate local transaction hash
        |
        v
human-readable review
        |
        v
explicit broadcast
        |
        v
Browser -> selected direct RPC -> eth_sendRawTransaction
        |
        v
compare provider hash with local hash
```


See the [backend contract](ETHEREUM_BACKEND.md) for public preparation and fee policy, and [USDT ERC-20](USDT_ERC20.md) for token intent and balance checks.

## Transfer preparation

The browser converts the entered ETH amount to exact integer wei using `bigint` and sends only public intent:

```text
from
to
valueWei
data = 0x
```

The backend returns chain ID, sender balance, pending nonce, gas limit and EIP-1559 fee values as canonical decimal strings.

Before signing, the browser verifies that the preparation response matches the exact source, destination, amount and calldata requested by the user.

## Local signing

Native ETH transfers use EIP-1559 Type-2 envelopes:

```text
0x02 || RLP([
  chainId,
  nonce,
  maxPriorityFeePerGas,
  maxFeePerGas,
  gasLimit,
  to,
  value,
  data,
  accessList,
  yParity,
  r,
  s
])
```

The shared native ETH / ERC-20 signing engine uses:

- chain ID `1`;
- recipient `to`, native `valueWei` and `data = 0x` for native ETH;
- fixed token-contract `to`, `valueWei = 0` and locally encoded transfer calldata for USDT ERC-20;
- empty access list;
- low-S secp256k1 ECDSA;
- EIP-1559 fee values supplied by the backend preparation snapshot.

The signing hash is `keccak256(0x02 || RLP(unsigned fields))`.

The browser validates the private key against the source address before any provider preparation request, signs locally, serializes the signed envelope and calculates the local transaction hash with Keccak-256.

## Fee review

The UI reviews:

- amount;
- pending nonce;
- gas limit;
- base fee;
- max priority fee per gas;
- max fee per gas;
- maximum network fee (`gasLimit * maxFeePerGas`);
- maximum total debit (`valueWei + maximum network fee`);
- local transaction hash.

EVM quantities cross backend Application/HTTP boundaries as canonical decimal strings. Browser arithmetic uses `bigint`; wei/gas/nonce/fee/token-unit values never pass through JavaScript `number` or PHP floating point.

The conservative native ETH balance check must pass before signing:

```text
valueWei + gasLimit * maxFeePerGas <= sender ETH balance
```

USDT checks token balance and native ETH gas capacity independently; see [USDT ERC-20](USDT_ERC20.md).

## Broadcast

Signing does not publish the transaction.

The user explicitly broadcasts the already-signed raw Type-2 transaction through a browser-side adapter to a selected direct Ethereum JSON-RPC endpoint, after verifying chain ID 1, or exports the signed payload for external publication. Symfony is not involved in publication. The provider-returned transaction hash must equal the locally calculated transaction hash. A transport error leaves the identical signed payload available for explicit retry; it never triggers a rebuild or re-sign. Provider acceptance is not proof of confirmation.

## Regression coverage

Deterministic frontend coverage includes:

- the standard Hardhat BIP39 mnemonic -> BIP44 Ethereum private key/address vector;
- exact ETH-to-wei conversion beyond JavaScript safe-integer limits;
- a public EIP-1559 Type-2 RLP serialization vector;
- the corresponding Keccak-256 transaction hash;
- adapter-registry fail-closed and browser-storage invariants.
