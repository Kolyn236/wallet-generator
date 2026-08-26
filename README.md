# doge-wallet-generator

A tiny educational Dogecoin **mainnet** wallet generator written in pure Python.

It creates a private key locally, derives the corresponding compressed secp256k1 public key, builds a legacy Dogecoin P2PKH address, and exports the private key in compressed WIF format.

The program makes **no network requests** and uses **no third-party Python packages**.

> [!WARNING]
> This project is for learning and small test amounts. It has not been professionally audited as wallet software. Anyone who obtains your private key or WIF can spend the DOGE sent to the generated address.

## What it generates

```text
random 256-bit value
        |
        v
private key
        |
        | secp256k1: public_key = private_key * G
        v
compressed public key
        |
        | SHA-256 -> RIPEMD-160
        v
public key hash
        |
        | Dogecoin mainnet prefix 0x1e
        | double-SHA256 checksum
        | Base58Check
        v
DOGE address (usually starts with D)
```

The same private key is also encoded as a compressed WIF using Dogecoin mainnet's `0x9e` private-key prefix.

## Requirements

- Python 3.10+
- A Python/OpenSSL build with RIPEMD-160 available
- No `pip install` required

On Ubuntu 22.04+ the system Python is sufficient.

## Run

Clone the repository:

```bash
git clone https://github.com/Kolyn236/doge-wallet-generator.git
cd doge-wallet-generator
```

Run the deterministic self-test first:

```bash
python3 doge_wallet.py --self-test
```

Expected result:

```text
Self-test passed.
```

Then generate a fresh wallet:

```bash
python3 doge_wallet.py
```

Example output structure:

```text
Dogecoin mainnet wallet generated locally.

Private key (hex): <SECRET - DO NOT SHARE>
Private key (WIF): <SECRET - DO NOT SHARE>
Public key:        <public key>
DOGE address:      D...
```

Every normal run generates a new private key using Python's `secrets` module.

## Receiving a small DOGE test payment

Only the **DOGE address** is public and safe to give to a sender.

For example, after generating a wallet you can copy:

```text
DOGE address: D...
```

and use that as a Dogecoin mainnet withdrawal address on an exchange or in another Dogecoin wallet.

Before sending anything, securely back up the WIF/private key. Without it, this script cannot recover the funds later.

## Private key safety

Treat both of these as secrets:

```text
Private key (hex)
Private key (WIF)
```

Do **not**:

- paste them into ChatGPT, messengers, websites, or issue trackers;
- commit them to Git;
- include them in screenshots;
- store them in shell history or public notes;
- use the deterministic self-test key for real funds.

The DOGE address and public key are not secrets.

## Self-test vector

The `--self-test` command intentionally derives a wallet from private key `1` and checks the result against fixed values:

```text
Compressed public key:
0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798

Dogecoin address:
DFpN6QqFfUm3gKNaxN6tNcab1FArL9cZLE

Compressed WIF:
QNcdLVw8fHkixm6NNyN6nVwxKek4u7qrioRbQmjxac5TVoTtZuot
```

That private key is publicly known. **Never send DOGE to the self-test address.**

## Dogecoin-specific parameters

The generator uses the Dogecoin mainnet Base58 prefixes defined by Dogecoin Core:

| Value | Decimal | Hex |
|---|---:|---:|
| P2PKH address prefix | 30 | `0x1e` |
| Private key / WIF prefix | 158 | `0x9e` |

Source: Dogecoin Core `src/chainparams.cpp`:
https://github.com/dogecoin/dogecoin/blob/master/src/chainparams.cpp

## What is implemented manually

To keep the project educational, the script implements the important derivation steps directly instead of hiding them behind a wallet library:

- cryptographically secure private-key generation via `secrets`;
- secp256k1 point addition;
- secp256k1 scalar multiplication using double-and-add;
- compressed public-key serialization;
- SHA-256;
- RIPEMD-160 through Python `hashlib`;
- Base58 encoding;
- Base58Check checksum;
- Dogecoin P2PKH address encoding;
- compressed WIF encoding.

## What this project does not do

This is deliberately a small generator, not a complete wallet application. It currently does not provide:

- BIP39 seed phrases;
- HD/BIP32 key derivation;
- encrypted key storage;
- wallet files;
- balance lookup;
- blockchain synchronization;
- transaction creation or signing;
- transaction broadcasting;
- testnet support.

For real wallet management, use maintained Dogecoin wallet software such as Dogecoin Core.

## Next learning steps

A natural progression for this repository is:

1. decode and validate Base58Check addresses;
2. add Dogecoin testnet support;
3. construct a P2PKH locking script (`scriptPubKey`);
4. inspect UTXOs for the generated address through a Dogecoin node;
5. build a raw transaction;
6. sign the transaction locally with secp256k1;
7. broadcast it through our own Dogecoin Core node.

That path lets us follow the complete lifecycle from random private key to a real on-chain Dogecoin transaction.
