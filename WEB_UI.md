# Local Web UI

`web_app.py` wraps the educational Dogecoin wallet tools in a browser UI while keeping private keys on the local machine.

## Start

```bash
git pull
python3 doge_wallet.py --self-test
python3 web_app.py --open
```

If `--open` does not launch a browser, open:

```text
http://127.0.0.1:8765/
```

The separate public balance checker is available at:

```text
http://127.0.0.1:8765/balance
```

Use another local port if needed:

```bash
python3 web_app.py --port 9000 --open
```

The server deliberately binds to `127.0.0.1`, not `0.0.0.0`.

## Languages

The web UI supports:

- Russian (`ru`)
- English (`en`)

Use the `RU / EN` switch in the header. The selected language is saved in browser `localStorage` under a non-secret preference key so it survives page reloads.

If there is no saved preference, the UI uses Russian when the browser language starts with `ru`; otherwise it defaults to English.

Only the language preference may be stored in browser storage. WIF/private keys are never written to `localStorage` or `sessionStorage`.

## Main workflow

The main wallet UI has three steps:

1. **Wallet**;
2. **Send DOGE**;
3. **CPFP rescue**.

There is intentionally no separate raw-transaction Broadcast screen. Serialized signed transaction bytes are machine-readable and are not a useful manual review surface for a normal user.

Send and CPFP first display a human-readable transaction summary. Only after that summary exists does an explicit **Broadcast to network / Отправить в сеть** button appear in the same result card.

Broadcast remains a separate irreversible action from building/signing. Pressing the button asks for final confirmation before the signed transaction is sent to the relay provider.

After broadcast, success or failure information remains in the same transaction result card together with the TXID, provider status, and explorer link.

## Screens

### Wallet

Generates a new Dogecoin mainnet P2PKH wallet locally:

- private key;
- compressed WIF;
- compressed public key;
- `D...` address.

Secrets are visually hidden until explicitly revealed.

### Public balance checker

The `/balance` page checks a wallet using only its public Dogecoin address. It never asks for a WIF or private key.

The page shows:

- confirmed balance;
- count of confirmed spendable UTXOs;
- largest confirmed UTXO;
- a table of confirmed UTXOs with amount, confirmations, TXID and vout.

The address is validated locally as a Dogecoin mainnet legacy P2PKH address before the lookup. Only the public `D...` address is sent to BlockCypher.

The balance page uses the same RU/EN preference as the main wallet UI and links back to the wallet workflow.

### Send DOGE

Builds and signs a one-input P2PKH transaction with automatic confirmed-UTXO discovery and selection.

The normal send form asks only for:

- source WIF;
- recipient (`To`) address;
- send amount;
- fee rate.

The source address is derived locally from the WIF. The local Python process then sends only that **public address** to BlockCypher and requests confirmed unspent outputs. The WIF/private key is never sent to BlockCypher.

When the WIF field loses focus, the UI shows the derived source address, confirmed balance, and count of spendable confirmed UTXOs.

When building a transaction, the backend fetches the UTXOs again and chooses the smallest confirmed UTXO that can cover the send amount plus the exact serialized transaction fee. This selection happens on the backend rather than trusting hidden browser fields.

Change is returned automatically to the source address.

The current transaction engine still supports exactly one input. If the total confirmed balance is sufficient but is split across multiple UTXOs and no individual UTXO can cover the amount plus fee, the UI reports that limitation instead of silently combining inputs.

Building does **not** broadcast. The result shows:

- source;
- recipient;
- send amount;
- change and change address;
- network fee;
- serialized size;
- locally calculated TXID.

The signed raw bytes stay as internal application data rather than being exposed in an editable raw-hex review field. The user reviews the human-readable summary and explicitly presses **Broadcast to network**.

On success, the same result card shows the broadcast state, TXID, provider, and a Blockchair explorer link. On failure, the error is shown in the same card without discarding the transaction summary.

### CPFP rescue

Builds a Child-Pays-For-Parent transaction.

Instead of manually typing a parent TXID and size, paste the signed parent raw transaction. The web app calculates both locally, which avoids TXID transcription mistakes.

You still provide the parent output index, that output's amount, the parent's fee, and the target package fee rate.

If the child destination is blank, the remaining output is sent back to the source wallet (self-transfer), which is the usual CPFP rescue shape.

After the child is built, the human-readable CPFP summary contains its own **Broadcast to network** button. Broadcast status and explorer information are shown in that same CPFP result card.

The parent raw transaction input remains an advanced CPFP input for now. It is not the broadcast review UI. A future iteration can replace it with automatic parent transaction lookup/decoding.

## Broadcast behavior

The current web UI uses BlockCypher for Dogecoin mainnet broadcast.

Only an already-signed public transaction is sent to the provider. The WIF/private key is never included.

The UI deliberately does not ask the user to approve a wall of serialized transaction hex. The review boundary is the human-readable transaction information produced before the broadcast button becomes available.

## Local security model

The page and API are served by the same Python process on loopback only:

```text
browser -> 127.0.0.1 -> local Python process
```

The web app:

- does not store WIF/private keys on disk;
- stores only the selected `ru/en` language preference in `localStorage`;
- does not store secrets in `localStorage` or `sessionStorage`;
- sends `Cache-Control: no-store`;
- requires a random per-process local API token for POST requests;
- denies framing;
- has no permissive CORS configuration;
- sends only a public Dogecoin address externally for balance/UTXO lookup;
- sends only already-signed public transaction bytes externally during explicit broadcast;
- never broadcasts automatically as part of build/sign.

Treat this as educational software for small test amounts, not an audited production wallet.

## Current limitations

The web UI currently has these main limitations:

- Dogecoin mainnet only;
- legacy P2PKH only;
- one input UTXO per normal transaction;
- automatic selection cannot yet combine multiple small UTXOs;
- only confirmed UTXOs are selected for ordinary sends and shown by the balance page;
- CPFP still accepts parent raw transaction data manually;
- no live fee estimator;
- no RBF controls yet;
- UTXO lookup and broadcast currently depend on BlockCypher rather than our own Dogecoin Core node.

Natural next steps are multi-input coin selection, automatic CPFP parent lookup/decoding, RBF-by-default, live fee estimation, transaction decoding/review, and optional Dogecoin Core JSON-RPC integration.
