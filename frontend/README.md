# React frontend

The primary web UI and browser-local signing runtime for ChainCourier.

Current live frontend routes:

- DOGE / Dogecoin mainnet;
- BTC / Bitcoin mainnet legacy P2PKH local signing, with P2PKH/P2SH watch-only connections;
- ETH / Ethereum mainnet EIP-1559;
- USDT / Ethereum mainnet ERC-20.

Wallet sessions are network-scoped and kept in browser memory. DOGE/BTC use WIF-backed UTXO signing; Ethereum uses the BIP39/BIP44 derivation path `m/44'/60'/0'/0/0` and browser-local private-key signing for EIP-1559 Type-2 transactions.

Bitcoin wallet creation, mnemonic restore and local transaction signing remain legacy P2PKH only. The watch-only flow may additionally connect a mainnet legacy P2SH (`3...`) address for public balance inspection; this does not add a P2SH signing path or expose any wallet secrets.

ETH and USDT ERC-20 deliberately share the same `ethereum-mainnet` wallet session/address/private key while keeping independent asset-route balances and transfer runtimes. Switching between ETH and USDT does not create a second Ethereum wallet.

For native ETH transfers, the browser sends public intent (`from`, `to`, `valueWei`, `data`) to Symfony. For USDT, `to` is the fixed Ethereum Mainnet USDT contract, `valueWei` is zero and `data` is the locally encoded ERC-20 `transfer(address,uint256)` calldata. Symfony returns public preparation state (pending nonce, gas limit and EIP-1559 fees), the browser signs locally, and broadcast is a separate explicit action.

USDT balance loading uses the fixed token contract through the backend `eth_call balanceOf(address)` capability. USDT uses 6 decimal places. Ethereum gas for token transfers is paid in ETH.

Seed phrases, private keys and WIF must never be sent to Symfony or persisted in browser storage. Existing DOGE/BTC senders may enter a matching WIF in the transfer flow; existing Ethereum/USDT senders may enter a matching Ethereum private key. Both remain browser-local.

USDT TRC-20 remains planned and does not resolve through the Ethereum route.

## Local development

```bash
npm ci
npm run test:adapter-invariants
npm run test:dogecoin-vector
npm run test:bitcoin-vector
npm run test:ethereum-vector
npm run test:usdt-erc20-vector
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
