import type { BitcoinUtxo } from './wallet/bitcoinTransaction';
import type { DogecoinUtxo } from './wallet/dogecoinTransaction';

export type DogecoinBalanceResponse = {
  chain: 'dogecoin';
  network: 'mainnet';
  address: string;
  balance: string;
  balanceSmallestUnit: number;
  unit: 'DOGE';
};

export type BitcoinBalanceResponse = {
  chain: 'bitcoin';
  network: 'mainnet';
  address: string;
  balance: string;
  balanceSmallestUnit: number;
  unit: 'BTC';
};

export type DogecoinFeePolicyResponse = {
  chain: 'dogecoin';
  network: 'mainnet';
  kind: 'utxo-rate-per-kb';
  recommendedRate: string;
  unit: 'DOGE/kB';
};

export type BitcoinFeePolicyResponse = {
  chain: 'bitcoin';
  network: 'mainnet';
  kind: 'utxo-rate-per-kb';
  recommendedRate: string;
  unit: 'BTC/kB';
};

export type DogecoinUtxoResponse = {
  chain: 'dogecoin';
  network: 'mainnet';
  address: string;
  utxos: DogecoinUtxo[];
};

export type BitcoinUtxoResponse = {
  chain: 'bitcoin';
  network: 'mainnet';
  address: string;
  utxos: BitcoinUtxo[];
};

export type DogecoinBroadcastResponse = {
  chain: 'dogecoin';
  network: 'mainnet';
  txid: string;
};

export type BitcoinBroadcastResponse = {
  chain: 'bitcoin';
  network: 'mainnet';
  txid: string;
};

type ApiErrorResponse = {
  error?: string;
  reason?: string;
};

export class WalletApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly reason?: string,
  ) {
    super(message);
    this.name = 'WalletApiError';
  }
}

export async function getHealth(signal?: AbortSignal): Promise<void> {
  const response = await fetch('/api/health', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw new Error(`Health request failed with HTTP ${response.status}.`);
  }
}

export async function getDogecoinFeePolicy(signal?: AbortSignal): Promise<DogecoinFeePolicyResponse> {
  return getJson('/api/chains/dogecoin/mainnet/fee-policy', 'DOGE fee policy lookup', signal);
}

export async function getBitcoinFeePolicy(signal?: AbortSignal): Promise<BitcoinFeePolicyResponse> {
  return getJson('/api/chains/bitcoin/mainnet/fee-policy', 'BTC fee policy lookup', signal);
}

export async function getDogecoinBalance(address: string, signal?: AbortSignal): Promise<DogecoinBalanceResponse> {
  return getJson(
    `/api/chains/dogecoin/mainnet/addresses/${encodeURIComponent(address)}/balance`,
    'DOGE balance lookup',
    signal,
  );
}

export async function getBitcoinBalance(address: string, signal?: AbortSignal): Promise<BitcoinBalanceResponse> {
  return getJson(
    `/api/chains/bitcoin/mainnet/addresses/${encodeURIComponent(address)}/balance`,
    'BTC balance lookup',
    signal,
  );
}

export async function getDogecoinUtxos(address: string, signal?: AbortSignal): Promise<DogecoinUtxoResponse> {
  return getJson(
    `/api/chains/dogecoin/mainnet/addresses/${encodeURIComponent(address)}/utxos`,
    'DOGE UTXO lookup',
    signal,
  );
}

export async function getBitcoinUtxos(address: string, signal?: AbortSignal): Promise<BitcoinUtxoResponse> {
  return getJson(
    `/api/chains/bitcoin/mainnet/addresses/${encodeURIComponent(address)}/utxos`,
    'BTC UTXO lookup',
    signal,
  );
}

export async function broadcastDogecoinTransaction(
  rawTransaction: string,
  signal?: AbortSignal,
): Promise<DogecoinBroadcastResponse> {
  return postRawTransaction(
    '/api/chains/dogecoin/mainnet/transactions/broadcast',
    rawTransaction,
    'DOGE transaction broadcast',
    signal,
  );
}

export async function broadcastBitcoinTransaction(
  rawTransaction: string,
  signal?: AbortSignal,
): Promise<BitcoinBroadcastResponse> {
  return postRawTransaction(
    '/api/chains/bitcoin/mainnet/transactions/broadcast',
    rawTransaction,
    'BTC transaction broadcast',
    signal,
  );
}

async function getJson<T>(url: string, operation: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw await apiError(response, operation);
  }

  return (await response.json()) as T;
}

async function postRawTransaction<T>(
  url: string,
  rawTransaction: string,
  operation: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rawTransaction }),
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw await apiError(response, operation);
  }

  return (await response.json()) as T;
}

async function apiError(response: Response, operation: string): Promise<WalletApiError> {
  let details: ApiErrorResponse = {};

  try {
    details = (await response.json()) as ApiErrorResponse;
  } catch {
    // The HTTP status is still enough to classify the failure safely.
  }

  console.error(`[wallet-platform] ${operation} failed`, {
    status: response.status,
    error: details.error ?? null,
    reason: details.reason ?? null,
  });

  return new WalletApiError(
    `${operation} failed with HTTP ${response.status}.`,
    response.status,
    details.error,
    details.reason,
  );
}
