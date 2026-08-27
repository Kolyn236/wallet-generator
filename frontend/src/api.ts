import type { DogecoinUtxo } from './wallet/dogecoinTransaction';

export type DogecoinBalanceResponse = {
  chain: 'dogecoin';
  network: 'mainnet';
  address: string;
  balance: string;
  balanceSmallestUnit: number;
  unit: 'DOGE';
};

export type DogecoinUtxoResponse = {
  chain: 'dogecoin';
  network: 'mainnet';
  address: string;
  utxos: DogecoinUtxo[];
};

export type DogecoinBroadcastResponse = {
  chain: 'dogecoin';
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
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw new Error(`Health request failed with HTTP ${response.status}.`);
  }
}

export async function getDogecoinBalance(address: string, signal?: AbortSignal): Promise<DogecoinBalanceResponse> {
  const response = await fetch(`/api/chains/dogecoin/mainnet/addresses/${encodeURIComponent(address)}/balance`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw await apiError(response, 'DOGE balance lookup');
  }

  return (await response.json()) as DogecoinBalanceResponse;
}

export async function getDogecoinUtxos(address: string, signal?: AbortSignal): Promise<DogecoinUtxoResponse> {
  const response = await fetch(`/api/chains/dogecoin/mainnet/addresses/${encodeURIComponent(address)}/utxos`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw await apiError(response, 'DOGE UTXO lookup');
  }

  return (await response.json()) as DogecoinUtxoResponse;
}

export async function broadcastDogecoinTransaction(
  rawTransaction: string,
  signal?: AbortSignal,
): Promise<DogecoinBroadcastResponse> {
  const response = await fetch('/api/chains/dogecoin/mainnet/transactions/broadcast', {
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
    throw await apiError(response, 'DOGE transaction broadcast');
  }

  return (await response.json()) as DogecoinBroadcastResponse;
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
