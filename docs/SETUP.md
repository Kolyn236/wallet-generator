# Setup and configuration

[Project overview](../README.md)

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

See [deployment environment overrides](../deploy/README.md).


The bundled Compose runtime is a development stack, not a production-hardening recipe. See the [security model](SECURITY_MODEL.md) before exposing it publicly. Never embed provider credentials in the frontend bundle.
