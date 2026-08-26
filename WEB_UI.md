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

## Screens

### Wallet

Generates a new Dogecoin mainnet P2PKH wallet locally:

- private key;
- compressed WIF;
- compressed public key;
- `D...` address.

Secrets are visually hidden until explicitly revealed.

### Send DOGE

Builds and signs a one-input P2PKH transaction.

The UI asks for:

- source WIF;
- UTXO txid;
- UTXO vout;
- UTXO amount;
- recipient (`To`) address;
- send amount;
- fee rate;
- optional change address.

There is intentionally no manual source-address field. The source address is derived from the WIF so the private key and source cannot silently disagree.

Building does **not** broadcast. The result shows:

- source;
- recipient;
- send amount;
- change and change address;
- network fee;
- serialized size;
- locally calculated TXID.

The signed raw transaction can then be loaded into the separate Broadcast screen.

### CPFP rescue

Builds a Child-Pays-For-Parent transaction.

Instead of manually typing a parent TXID and size, paste the signed parent raw transaction. The web app calculates both locally, which avoids TXID transcription mistakes.

You still provide the parent output index, that output's amount, the parent's fee, and the target package fee rate.

If the child destination is blank, the remaining output is sent back to the source wallet (self-transfer), which is the usual CPFP rescue shape.

### Broadcast

Broadcast is intentionally separate from signing and requires an explicit irreversible-action checkbox.

The current web UI uses BlockCypher for Dogecoin mainnet broadcast. The request contains only the already-signed public raw transaction. The WIF/private key is never included.

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
- only performs external network access during explicit broadcast.

Treat this as educational software for small test amounts, not an audited production wallet.

## Current limitations

The web UI exposes the same core limitations as the CLI:

- Dogecoin mainnet only;
- legacy P2PKH only;
- one input UTXO per normal transaction;
- no automatic UTXO discovery or coin selection;
- no live fee estimator;
- no RBF controls yet;
- third-party broadcast provider instead of our own Dogecoin Core node.

Natural next steps are automatic UTXO lookup/selection, RBF-by-default, live fee estimation, transaction decoding/review, and optional Dogecoin Core JSON-RPC integration.
