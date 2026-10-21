# ChainCourier

ChainCourier is a multi-chain non-custodial crypto transfer tool built with a **Symfony 7.4 modular monolith + React/TypeScript frontend**.

Wallet creation and transaction signing happen in browser memory. Symfony handles public chain data, unsigned transaction preparation and supported status lookups. It does not receive signed transactions for publication and has no broadcast API. Users publish directly through a selected browser-accessible provider/node or explicitly export signed bytes for external publication.

## Current status

```text
Browser
   |
   |  network-scoped wallet sessions
   |  local DOGE / BTC / LTC / Ethereum / TRON signers
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
- BTC / Bitcoin mainnet — legacy P2PKH wallets with P2PKH and native SegWit P2WPKH recipients;
- LTC / Litecoin mainnet — legacy P2PKH;
- ETH / Ethereum mainnet — native ETH with EIP-1559 Type-2 transactions;
- USDT / Ethereum mainnet — ERC-20 with EIP-1559 Type-2 transactions;
- USDT / TRON mainnet — TRC-20, a separate TRON wallet identity with fees/resources paid in TRX.

ETH and USDT ERC-20 share one `ethereum-mainnet` wallet identity. They do not share balances or transfer adapters: native ETH and USDT remain separate asset routes.

## Wallet derivation

Locally created wallets use BIP39 mnemonics and BIP44 derivation:

```text
DOGE  m/44'/3'/0'/0/0
BTC   m/44'/0'/0'/0/0
LTC   m/44'/2'/0'/0/0
ETH   m/44'/60'/0'/0/0
TRON  m/44'/195'/0'/0/0
USDT  Ethereum identity for ERC-20; separate TRON identity for TRC-20
```

DOGE/BTC/LTC expose WIF signing material for their legacy P2PKH runtime. Ethereum and TRON routes use browser-local secp256k1 private keys. All signing material remains in the active browser session only.

## Quick start

Requirements:

- Docker with Compose support.

```bash
git clone https://github.com/Kolyn236/wallet-generator.git
cd wallet-generator
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
TRON_RPC_URL=
```

`ETHEREUM_RPC_URL` is required for ETH and USDT ERC-20 Ethereum operations. Configure an Ethereum Mainnet JSON-RPC URL through deployment secrets/runtime environment. The backend checks `eth_chainId == 1` before Ethereum operations and fails closed on another EVM network.

`TRON_RPC_URL` is required for TRON public balance/preparation/status operations. Use a mainnet TRON HTTP API provider supporting both `/wallet` and `/walletsolidity`; the backend checks the pinned mainnet genesis identity. These backend RPC settings are never browser broadcast credentials.

DOGE/BTC fee-rate values remain operator-controlled defaults. Ethereum fee preparation uses live provider state through `eth_estimateGas` and `eth_feeHistory`.

For deployment-time overrides:

```bash
sh scripts/build-deploy-env.sh /etc/chain-courier/runtime.env .env
docker compose up -d --force-recreate php
```

See `deploy/README.md`.

## Stack

Source code is available under the MIT license; see `LICENSE`. Third-party dependencies retain their own licenses. Repository visibility/release publication is an operator decision and is not changed by this implementation.

- PHP 8.4;
- Symfony 7.4 LTS;
- React 19 + TypeScript;
- Vite;
- Nginx + PHP-FPM;
- Docker Compose;
- PHPUnit, PHPStan, PHP-CS-Fixer;
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
user-selected direct provider / RPC / node
          |
          v
    blockchain
```

Core rules:

- Symfony never receives seed phrases, WIFs or private keys;
- Symfony does not receive signed transactions for publication, sign, custody funds, swap, bridge or broadcast;
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
Browser -> user-selected provider, or signed-payload export
```

Amounts use integer smallest units internally (`koinu` / `satoshi`). DOGE/BTC spend confirmed UTXOs only. The browser calculates the local TXID and verifies the provider-returned TXID.

Bitcoin source and change outputs remain legacy P2PKH in the current runtime. BTC recipient outputs accept legacy P2PKH and native SegWit P2WPKH (`bc1q...`) addresses. P2WPKH source wallets/signing are not implemented yet.

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
Browser -> selected direct RPC -> eth_sendRawTransaction
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

Changing the Ethereum wallet invalidates both Ethereum route balances together. USDT TRC-20 uses a separate TRON session and never falls back to the ERC-20 runtime. The USDT chooser selects the network in which tokens already reside; it is not a swap or bridge.

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

```

Bitcoin:

```text
GET  /api/chains/bitcoin/mainnet/fee-policy
GET  /api/chains/bitcoin/mainnet/addresses/{address}/balance
GET  /api/chains/bitcoin/mainnet/addresses/{address}/utxos

```

Ethereum:

```text
GET  /api/chains/ethereum/mainnet/addresses/{address}/balance
GET  /api/chains/ethereum/mainnet/tokens/usdt/addresses/{address}/balance
POST /api/chains/ethereum/mainnet/transactions/prepare

```

Ethereum prepare accepts only `from`, `to`, `valueWei` and `data`. Symfony never signs or broadcasts transactions. Litecoin has the same read-only balance/UTXO/fee-policy endpoint structure as DOGE/BTC, under `litecoin/mainnet`.

TRON:

```text
GET  /api/chains/tron/mainnet/tokens/usdt/addresses/{address}/balance
POST /api/chains/tron/mainnet/transactions/prepare
GET  /api/chains/tron/mainnet/transactions/{txId}
```

TRON prepare accepts public route/sender/recipient/integer-token-amount intent only. The browser checks intent, TAPOS, timestamp/expiry and resources, serializes and signs locally. Submission is not execution success. See `docs/architecture/TRON_TRC20.md`.

## User-controlled publication and migration

The former Symfony `/transactions/broadcast` endpoints are removed for all chains. Integrations must publish signed payloads directly to their own node/provider; there is no automatic backend forwarding or compatibility relay.

After local signing/review, choose a browser-accessible endpoint and explicitly submit, or export the signed payload for external broadcast. The UI retains the identical signed bytes after a transport error for deliberate retry, without changing nonce, inputs, fees or TRON expiry. CORS, authentication and provider rate limits can prevent a direct browser request; use export rather than forwarding through the default backend. No secret provider key is built into the frontend. No relay is required or included.

Backend RPC settings configure public reads/preparation only; they are not automatically exposed as browser broadcast destinations. Inspect the selected provider's privacy and authentication policy. Provider acceptance is not proof of confirmation or successful contract execution.

See `docs/SECURITY_MODEL.md` for trust boundaries, compromised-hosted-JavaScript risks, browser-memory limitations and self-hosting/release guidance. `compose.yaml` is a development stack, not a production-hardening recipe.

## Frontend runtime model

Wallet identity is network-scoped while balances and execution behavior are asset-route-scoped.

Runtime lookup is explicit:

- `WalletNetworkAdapter` selects wallet identity/creation/address validation by network;
- `AssetRouteAdapter` selects balance/transfer behavior by asset route;
- backend `ChainAdapterRegistry` selects capabilities by exact `chain:network`;
- no registry has a default/fallback asset adapter.

See `docs/architecture/ADAPTER_REGISTRY.md`.

## Development

Backend:

```bash
cd backend
composer install
composer test
composer analyse
composer cs:check
```

Frontend:

```bash
cd frontend
npm ci
npm run test:adapter-invariants
npm run test:dogecoin-vector
npm run test:bitcoin-vector
npm run test:litecoin-vector
npm run test:ethereum-vector
npm run test:usdt-erc20-vector
npm run test:tron-vector
npm run test:tron-flow
npm run test:broadcast
npm run test:usdt-route-chooser
npm run test:transfer-review
npm run test:public-runtime
npm run build
npm run dev
```

Deterministic frontend coverage includes DOGE/BTC transaction vectors, Ethereum wallet/Type-2 serialization vectors and USDT ERC-20 amount/calldata/signing vectors. Tests do not require funded accounts or a live Ethereum RPC provider.

Production-like local build:

```bash
docker compose up --build
```

## CI

`Quality Gate` runs source checks, backend tests/static analysis/style, frontend adapter invariants, deterministic DOGE/BTC/ETH/USDT vectors and the TypeScript/Vite build.

`Integration Smoke` owns Docker/Compose runtime checks and is restricted to deploy/runtime-sensitive changes on `main` or manual execution.

## Architecture docs

- `docs/architecture/ADR-001-modular-monolith.md`
- `docs/architecture/MODULE_BOUNDARIES.md`
- `docs/architecture/ADAPTER_REGISTRY.md`
- `docs/architecture/ETHEREUM_BACKEND.md`
- `docs/architecture/ETHEREUM_FRONTEND.md`
- `docs/architecture/USDT_ERC20.md`
- `docs/architecture/TRON_TRC20.md`
- `docs/SECURITY_MODEL.md`

## Roadmap

Near-term work is intentionally narrow:

1. fee-estimation and transaction-review improvements;
2. production observability, load testing and operational hardening.

Additional chains, token routes, persistence, queues, indexers or browser vault features should be introduced only for a concrete product or load requirement.
