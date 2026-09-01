# React frontend

The primary web UI and browser-local signing runtime for the wallet platform.

Current live frontend routes:

- DOGE / Dogecoin mainnet;
- BTC / Bitcoin mainnet legacy P2PKH;
- ETH / Ethereum mainnet EIP-1559.

Wallet sessions are network-scoped and kept in browser memory. DOGE/BTC use WIF-backed UTXO signing; Ethereum uses the same BIP39/BIP44 wallet model with derivation path `m/44'/60'/0'/0/0` and browser-local private-key signing for EIP-1559 Type-2 transactions.

For native ETH transfers, the browser sends only public intent (`from`, `to`, `valueWei`, `data`) to Symfony. The backend returns public preparation state (pending nonce, gas limit and EIP-1559 fees), the browser signs locally, and broadcast is a separate explicit action. The local Ethereum transaction hash is compared with the provider-returned hash after broadcast.

Seed phrases, private keys and WIF must never be sent to Symfony or persisted in browser storage. Existing DOGE/BTC senders may enter a matching WIF in the transfer flow; existing Ethereum senders may enter a matching private key. Both remain browser-local.

USDT ERC-20 remains a separate planned asset route on the same `ethereum-mainnet` wallet identity. Registering native ETH does not make the token route executable.

## Local development

```bash
npm ci
npm run test:adapter-invariants
npm run test:dogecoin-vector
npm run test:bitcoin-vector
npm run test:ethereum-vector
npm run build
npm run dev
```

Vite runs on `http://localhost:5173` and proxies `/api` to the platform Nginx endpoint on `http://localhost:8080`.

For the integrated application use the repository root:

```bash
docker compose up --build
```

Then open `http://localhost:8080`.

## Runtime model

Frontend runtime selection is explicit:

- `WalletNetworkAdapter` owns network wallet identity/creation/address validation;
- `AssetRouteAdapter` owns route-specific balance and transfer behavior;
- wallet sessions are keyed by network;
- balances are keyed by asset route;
- unknown or planned routes fail closed rather than falling back to another asset runtime.

See `../docs/architecture/ADAPTER_REGISTRY.md`.
