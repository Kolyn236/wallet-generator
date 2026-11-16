# Backend API

[Project overview](../README.md)

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

TRON prepare accepts public route/sender/recipient/integer-token-amount intent only. The browser checks intent, TAPOS, timestamp/expiry and resources, serializes and signs locally. Submission is not execution success. See the [TRON contract](architecture/TRON_TRC20.md).


Health: `GET /api/health`.

Symfony exposes public-state and preparation APIs only, never signing or broadcast endpoints. See the [Ethereum backend contract](architecture/ETHEREUM_BACKEND.md) and [publication/migration guide](PUBLICATION.md).
