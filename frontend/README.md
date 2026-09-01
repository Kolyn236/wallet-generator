# React frontend

The primary web UI and browser-local signing runtime for the wallet platform.

Current live frontend routes:

- DOGE / Dogecoin mainnet;
- BTC / Bitcoin mainnet legacy P2PKH.

The Ethereum Mainnet backend is implemented, while the ETH frontend route remains planned until browser-local Ethereum wallet creation and EIP-1559 signing are complete.

Wallet sessions are network-scoped and kept in browser memory. DOGE/BTC can create local wallets, connect watch-only public addresses, load balances/UTXOs, build and sign transactions locally, review the signed transaction and broadcast explicitly through Symfony.

Seed phrases, private keys and WIF must never be sent to Symfony or persisted in browser storage. Existing DOGE/BTC senders may enter a matching WIF in the transfer flow; it remains browser-local.

## Local development

```bash
npm ci
npm run test:adapter-invariants
npm run test:dogecoin-vector
npm run test:bitcoin-vector
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
