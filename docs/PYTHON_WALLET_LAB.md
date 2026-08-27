# Python Dogecoin Wallet Lab (reference implementation)

> This document preserves the original project guide while the primary application migrates to Symfony + React. The Python implementation remains the parity/reference path until equivalent platform behavior is covered by tests.

# doge-wallet-generator

A small educational Dogecoin **mainnet** wallet and raw-transaction tool written in pure Python.

The goal is to make the Bitcoin/Dogecoin UTXO model visible instead of hiding it behind a wallet library:

```text
private key
    |
    v
public key -> DOGE address
    |
    | receives a UTXO
    v
previous txid:vout
    |
    | build outputs + change + fee
    v
raw transaction
    |
    | SIGHASH_ALL + secp256k1 ECDSA
    v
signed raw transaction
    |
    | explicit broadcast
    v
Dogecoin network
```

No third-party Python packages are required. Private keys and signatures are created locally. The only command that intentionally uses the network is `broadcast`.

> [!WARNING]
> This is educational wallet software for small test amounts. It has not been professionally audited. Anyone who obtains your private key or WIF can spend your DOGE.

## Requirements

- Python 3.10+
- no `pip install`
- Dogecoin mainnet legacy P2PKH addresses (`D...`)

RIPEMD-160 is taken from Python/OpenSSL when available. If the local build does not expose it, the program automatically falls back to the bundled pure-Python implementation.

## Install

```bash
git clone https://github.com/Kolyn236/doge-wallet-generator.git
cd doge-wallet-generator
```

Already cloned:

```bash
git pull
```

Run the local self-test first:

```bash
python3 doge_wallet.py --self-test
```

Expected output:

```text
Self-test passed.
```

The test checks RIPEMD-160 vectors, Dogecoin address/WIF derivation, Base58Check decoding, ECDSA signing/verification and a locally built P2PKH transaction.

## 1. Generate a wallet

Either command works:

```bash
python3 doge_wallet.py
```

or:

```bash
python3 doge_wallet.py generate
```

Example output:

```text
Dogecoin mainnet wallet generated locally.

Private key (hex): <SECRET>
Private key (WIF): <SECRET>
Public key:        <public key>
DOGE address:      D...
```

Only the **DOGE address** and public key are safe to share.

Keep both of these secret:

```text
Private key (hex)
Private key (WIF)
```

The WIF is the convenient representation used later to sign a spend.

## 2. Receive DOGE

Send DOGE to the generated `D...` address.

After confirmation, a block explorer will show at least one unspent output. To spend one UTXO with this tool you need four public facts:

```text
source address
previous transaction id (txid)
output index (vout)
output amount
```

For example:

```text
source:       DSource...
utxo txid:    abcd...1234
utxo vout:    0
utxo amount:  10 DOGE
```

The private WIF is **not** part of the blockchain and should never be copied into an explorer.

## 3. Create a second wallet

For an easy self-transfer experiment, generate another wallet:

```bash
python3 doge_wallet.py generate
```

Save its WIF separately and copy only its new `D...` address. That address will be the destination.

## 4. Build and sign a transaction locally

Suppose the source owns a `10 DOGE` UTXO and you want to send `3 DOGE` to the second wallet:

```bash
python3 doge_wallet.py build-tx \
  --source DSourceAddress \
  --utxo-txid PREVIOUS_TXID \
  --utxo-vout 0 \
  --utxo-amount 10 \
  --to DDestinationAddress \
  --amount 3 \
  --out signed.tx
```

The program asks for the **source wallet WIF using hidden terminal input**:

```text
Source wallet WIF (hidden):
```

It verifies that the supplied WIF really derives the `--source` address before signing.

The summary looks like:

```text
Signed Dogecoin transaction created locally.

Source:       DSource...
Destination:  DDestination...
Send:         3.00000000 DOGE
Change:       6.9977... DOGE
Change addr:  DSource...
Network fee:  0.0022... DOGE
Size:         ~226 bytes
TXID:         ...

Raw tx saved: signed.tx

NOT BROADCAST.
```

Nothing has moved yet. `signed.tx` contains only the signed public transaction, not the private key.

### Change

Unless `--change` is supplied, change returns to the source address.

Conceptually:

```text
INPUT
10 DOGE UTXO
   |
   +----> 3 DOGE       destination
   |
   +----> ~6.9977 DOGE source/change
   |
   +----> ~0.0023 DOGE network fee
```

The old 10 DOGE UTXO is consumed as a whole. The outputs become new UTXOs.

To send change to another address:

```bash
python3 doge_wallet.py build-tx \
  ... \
  --change DAnotherChangeAddress
```

## Fee calculation

The default fee rate is:

```text
0.01 DOGE / kB
```

The program signs the transaction, measures its exact serialized byte size, and adjusts the change so the fee meets that rate.

Override it explicitly if needed:

```bash
--fee-rate 0.02
```

Dogecoin Core fee recommendation:
https://github.com/dogecoin/dogecoin/blob/master/doc/fee-recommendation.md

Outputs below `0.01 DOGE` are intentionally avoided by this educational tool.

## 5. Review before broadcast

Before broadcasting, verify:

- `Source`
- `Destination`
- `Send`
- `Change`
- `Change addr`
- `Network fee`

Broadcasting a valid transaction is irreversible.

The `TXID` printed before broadcast is derived locally from the exact signed bytes. Once the network accepts the transaction, this should be the transaction ID you see in the explorer.

## 6. Broadcast

Broadcast is deliberately a separate command:

```bash
python3 doge_wallet.py broadcast \
  --raw-file signed.tx \
  --yes
```

The current broadcaster posts the **already-signed raw transaction** to DogeChain's push-transaction endpoint.

The private key/WIF is never included in that request.

`--yes` is required so a build command can never accidentally publish a transaction.

If the third-party broadcaster is unavailable, the same `signed.tx` can be broadcast later through a Dogecoin Core node with `sendrawtransaction`; rebuilding or revealing the WIF is not required.

## Optional WIF file

Interactive hidden input is safer for normal use. For local automation you can store only the WIF in a separate file:

```bash
chmod 600 source.wif
```

Then:

```bash
python3 doge_wallet.py build-tx \
  ... \
  --wif-file source.wif
```

`*.wif` files are ignored by this repository, but do not rely on `.gitignore` as your security boundary.

## Private-key safety

Do **not**:

- paste WIF/private keys into ChatGPT, messengers, websites or issue trackers;
- include them in screenshots;
- commit them to Git;
- store them in shell history;
- use the public self-test key for funds.

The address, public key, TXID and signed raw transaction are not secret.

## Dogecoin-specific parameters

The mainnet prefixes come from Dogecoin Core `src/chainparams.cpp`:

| Value | Decimal | Hex |
|---|---:|---:|
| P2PKH address prefix | 30 | `0x1e` |
| Private key / WIF prefix | 158 | `0x9e` |

Source:
https://github.com/dogecoin/dogecoin/blob/master/src/chainparams.cpp

Dogecoin uses `100,000,000` koinu per DOGE.

## What is implemented manually

The project deliberately avoids a wallet library so the mechanics stay visible:

- cryptographically secure key generation with `secrets`;
- secp256k1 point addition and scalar multiplication;
- compressed public keys;
- SHA-256 and RIPEMD-160;
- Base58 and Base58Check encode/decode;
- Dogecoin mainnet P2PKH addresses;
- compressed WIF encode/decode;
- P2PKH `scriptPubKey`;
- transaction varints and binary serialization;
- little-endian outpoints and values;
- RFC6979 deterministic ECDSA nonces;
- secp256k1 ECDSA signatures;
- low-S normalization;
- DER signature encoding;
- legacy `SIGHASH_ALL`;
- P2PKH `scriptSig`;
- TXID calculation;
- exact-size fee calculation;
- change output creation;
- explicit raw-transaction broadcast.

## Current limitations

This is intentionally not a complete wallet. At the moment:

- mainnet only;
- legacy P2PKH only;
- exactly one input UTXO per transaction;
- no automatic UTXO discovery/selection;
- no BIP39 seed phrase;
- no BIP32/HD derivation;
- no encrypted keystore;
- no local blockchain synchronization;
- no fee estimation from current mempool conditions;
- no RBF controls;
- no multisig;
- broadcast currently depends on a third-party endpoint.

For substantial funds, use maintained wallet software such as Dogecoin Core.

## Useful commands

```bash
# Run tests
python3 doge_wallet.py --self-test

# Generate wallet
python3 doge_wallet.py generate

# Show CLI help
python3 doge_wallet.py --help

# Show transaction-builder help
python3 doge_wallet.py build-tx --help

# Show broadcaster help
python3 doge_wallet.py broadcast --help
```

## Next learning steps

Good next iterations for this repository:

1. fetch and display UTXOs for an address;
2. decode our own raw transaction back into fields;
3. support multiple input UTXOs;
4. coin selection;
5. broadcast through our own Dogecoin Core JSON-RPC;
6. inspect the mempool and confirmations from our own node;
7. add testnet support;
8. add BIP32/BIP39 as a separate HD-wallet module.

That gives us the complete path from random private key to a real UTXO spend without hiding the interesting parts behind wallet software.
