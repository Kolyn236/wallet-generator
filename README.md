# ChainCourier

ChainCourier is a multi-chain non-custodial crypto transfer tool built with a **Symfony 7.4 modular monolith + React/TypeScript frontend**.

Wallet creation and transaction signing happen in browser memory. Symfony is the blockchain API gateway: it handles public chain data, transaction preparation where chain state is required, and broadcast of already-signed transactions.

## Current status

```text
Browser
   |
   |  network-scoped wallet sessions
   |  local DOGE / BTC / Ethereum signers
   v
Nginx :8080
   |---- / ----------> React + TypeScript
   |
   +---- /api/* -----> Symfony / PHP-FPM
                         |
                         +--> chain/network capability adapters
                                |
                                +--> blockchain nodes/providers
```

Live frontend routes:

- DOGE / Dogecoin mainnet — legacy P2PKH;
- BTC / Bitcoin mainnet — legacy P2PKH;
- ETH / Ethereum mainnet — native ETH with EIP-1559 Type-2 transactions;
- USDT / Ethereum mainnet — ERC-20 with EIP-1559 Type-2 transactions.

Planned route:

- USDT TRC-20 on Tron mainnet.

ETH and USDT ERC-20 share one `ethereum-mainnet` wallet identity. They do not share balances or transfer adapters: native ETH and USDT remain separate asset routes.

## Wallet derivation

Locally created wallets use BIP39 mnemonics and BIP44 derivation:

```text
DOGE  m/44'/3'/0'/0/0
BTC   m/44'/0'/0'/0/0
ETH   m/44'/60'/0'/0/0
USDT  same ethereum-mainnet wallet identity as ETH
```

DOGE/BTC expose WIF signing material for their legacy P2PKH runtime. Ethereum routes use a browser-local secp256k1 private key. All signing material remains in the active browser session only.

## Quick start

Requirements:

- Docker with Compose support.

```bash
git clone https://github.com/Kolyn236/chain-courier.git
cd chain-courier
cp .env.example .env
docker compose up --build
```

Open `http://localhost:8080`.

Health endpoint:

```text
GET http://localhost:8080/api/health
```

Stop the stack:

```bash
docker compose down
```

## Runtime configuration

```dotenv
DOGE_RECOMMENDED_FEE_RATE=0.01
BTC_RECOMMENDED_FEE_RATE=0.00010000
ETHEREUM_RPC_URL=
```

`ETHEREUM_RPC_URL` is required for ETH and USDT ERC-20 Ethereum operations. Configure an Ethereum Mainnet JSON-RPC URL through deployment secrets/runtime environment. The backend checks `eth_chainId == 1` before Ethereum operations and fails closed on another EVM network.

DOGE/BTC fee-rate values remain operator-controlled defaults. Ethereum fee preparation uses live provider state through `eth_estimateGas` and `eth_feeHistory`.

Local Docker development uses `compose.yaml`. Production uses the separate `compose.prod.yaml` topology and requires a real `APP_SECRET`; the production PHP image contains source/dependencies and has no development bind mount or `start-dev.sh` runtime.

See `deploy/README.md` for production secrets, build/start/update steps, Nginx limits and TLS assumptions.

## Stack

- PHP 8.4;
- Symfony 7.4 LTS;
- React 19 + TypeScript;
- Vite;
- Nginx + PHP-FPM;
- Docker Compose;
- GitHub Actions.

PostgreSQL, Redis and RabbitMQ are not required by the current runtime. Add persistence, cache, queues or indexing only for concrete product/load requirements.

## Security model

The application is non-custodial.

```text
seed / WIF / private key
          |
          v
     browser memory
          |
          +--> address derivation / key-address verification
          |
          +--> local transaction signing
          |
          v
 signed raw transaction
          |
          v
Symfony blockchain gateway
          |
          v
    node / provider
```

Core rules:

- Symfony never receives seed phrases, WIFs or private keys;
- plaintext signing material is not persisted in localStorage, sessionStorage, IndexedDB, cookies or backend storage;
- created wallet secrets live only in browser memory and disappear when the session is lost;
- signing and broadcast are separate explicit actions;
- external providers receive public addresses/public transaction intent or signed raw transaction bytes only;
- unknown chain/network/asset routes fail closed;
- provider data is validated before it can influence signing;
- locally calculated transaction identity is compared with the provider-returned identity after broadcast.

## DOGE / BTC transfer flow

DOGE and BTC are UTXO integrations and keep chain-specific address/WIF/serialization rules isolated.

```text
Sender + matching WIF
        |
        v
Recipient + amount + fee rate
        |
        v
Symfony -> confirmed UTXOs
        |
        v
Browser -> verify key/address + UTXO scripts
        |
        v
Browser -> coin selection + local P2PKH signing
        |
        v
Review amount / fee / change / local TXID
        |
        v
Explicit broadcast
        |
        v
Symfony -> provider
```

Amounts use integer smallest units internally (`koinu` / `satoshi`). DOGE/BTC spend confirmed UTXOs only. The browser calculates the local TXID and verifies the provider-returned TXID.

## Ethereum transaction flow

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
Symfony -> eth_sendRawTransaction
        |
        v
compare provider hash with local hash
```

The Type-2 signer encodes:

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

Native ETH uses the recipient as `to`, the ETH amount as `valueWei` and `data = 0x`.

## USDT ERC-20

Ethereum Mainnet USDT uses the fixed contract:

```text
0xdAC17F958D2ee523a2206206994597C13D831ec7
```

USDT uses 6 decimal places. The balance path calls the fixed contract with `eth_call balanceOf(address)`; the browser encodes `transfer(address,uint256)` locally for sending.

For a USDT transfer the public Ethereum prepare intent is:

```text
from     = sender Ethereum address
to       = USDT contract
valueWei = 0
data     = ERC-20 transfer(recipient, amount) calldata
```

The browser verifies the returned prepare snapshot against that exact contract/value/calldata before signing. The token amount is paid in USDT while Ethereum network fees are paid separately in ETH.

USDT and ETH use the same `ethereum-mainnet` wallet session but route-scoped balances:

```text
ethereum-mainnet wallet session
address: 0x...

eth-ethereum-mainnet-native       -> ETH balance + native transfer
usdt-ethereum-mainnet-erc20       -> USDT balance + ERC-20 transfer
```

Changing the Ethereum wallet invalidates both route balances together. USDT TRC-20 remains a separate unimplemented Tron route and never falls back to the ERC-20 runtime.

## EVM amount and fee correctness

EVM quantities cross the backend Application/HTTP boundary as canonical decimal strings. Browser arithmetic uses `bigint`; wei/gas/nonce/fee/token-unit values are never routed through JavaScript `number` or PHP floating point.

The current EIP-1559 wallet policy is:

```text
maxFeePerGas = 2 * baseFeePerGas + maxPriorityFeePerGas
```

This is a wallet policy, not an Ethereum protocol constant. Missing gas/fee data fails explicitly instead of falling back to a legacy `gasPrice` transaction.

Before signing, native ETH checks:

```text
valueWei + gasLimit * maxFeePerGas <= sender ETH balance
```

USDT checks both:

```text
USDT amount <= sender USDT balance
gasLimit * maxFeePerGas <= sender ETH balance
```

## Backend API

Dogecoin:

```text
GET  /api/chains/dogecoin/mainnet/fee-policy
GET  /api/chains/dogecoin/mainnet/addresses/{address}/balance
GET  /api/chains/dogecoin/mainnet/addresses/{address}/utxos
POST /api/chains/dogecoin/mainnet/transactions/broadcast
```

Bitcoin:

```text
GET  /api/chains/bitcoin/mainnet/fee-policy
GET  /api/chains/bitcoin/mainnet/addresses/{address}/balance
GET  /api/chains/bitcoin/mainnet/addresses/{address}/utxos
POST /api/chains/bitcoin/mainnet/transactions/broadcast
```

Ethereum:

```text
GET  /api/chains/ethereum/mainnet/addresses/{address}/balance
GET  /api/chains/ethereum/mainnet/tokens/usdt/addresses/{address}/balance
POST /api/chains/ethereum/mainnet/transactions/prepare
POST /api/chains/ethereum/mainnet/transactions/broadcast
```

Ethereum prepare accepts only `from`, `to`, `valueWei` and `data`. Broadcast accepts only `rawTransaction`. Symfony never signs Ethereum transactions.

## Frontend runtime model

Wallet identity is network-scoped while balances and execution behavior are asset-route-scoped.

Runtime lookup is explicit:

- `WalletNetworkAdapter` selects wallet identity/creation/address validation by network;
- `AssetRouteAdapter` selects balance/transfer behavior by asset route;
- backend `ChainAdapterRegistry` selects capabilities by exact `chain:network`;
- no registry has a default/fallback asset adapter.

See `docs/architecture/ADAPTER_REGISTRY.md`.

## Development

Backend, outside Docker:

```bash
cd backend
cp .env.example .env
composer install
composer test
composer analyse
composer cs:check
```

`backend/.env` is ignored and is for local development only. Tests also supply their own test environment through PHPUnit configuration.

Frontend:

```bash
cd frontend
npm ci
npm run test:adapter-invariants
npm run test:dogecoin-vector
npm run test:bitcoin-vector
npm run test:ethereum-vector
npm run test:usdt-erc20-vector
npm run build
npm run dev
```

Deterministic frontend coverage includes DOGE/BTC transaction vectors, Ethereum wallet/Type-2 serialization vectors and USDT ERC-20 amount/calldata/signing vectors. Tests do not require funded accounts or a live Ethereum RPC provider.

Docker development runtime:

```bash
cp .env.example .env
docker compose up --build
```

Production runtime:

```bash
sh scripts/build-deploy-env.sh /etc/chain-courier/runtime.env .env
docker compose -f compose.prod.yaml config --quiet
docker compose -f compose.prod.yaml up -d --build
```

See `deploy/README.md`; production requires a real `APP_SECRET` and intentionally does not inherit the development Compose topology.

## CI

`Quality Gate` runs source checks, backend tests/static analysis/style, frontend adapter invariants, deterministic DOGE/BTC/ETH/USDT vectors and the TypeScript/Vite build.

`Integration Smoke` validates both Compose configurations and exercises the explicit production runtime, including production env/debug state, PHP-FPM startup, Nginx syntax, health/frontend/API smoke checks, request-body rejection and rate limiting.

## Architecture docs

- `docs/architecture/ADR-001-modular-monolith.md`
- `docs/architecture/MODULE_BOUNDARIES.md`
- `docs/architecture/ADAPTER_REGISTRY.md`
- `docs/architecture/ETHEREUM_BACKEND.md`
- `docs/architecture/ETHEREUM_FRONTEND.md`
- `docs/architecture/USDT_ERC20.md`

## Roadmap

Near-term work is intentionally narrow:

1. fee-estimation and transaction-review improvements;
2. production observability, load testing and operational hardening.

Additional chains, token routes, persistence, queues, indexers or browser vault features should be introduced only for a concrete product or load requirement.
