export type DogecoinBalanceResponse = {
  chain: 'dogecoin';
  network: 'mainnet';
  address: string;
  balance: string;
  balanceSmallestUnit: number;
  unit: 'DOGE';
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
    let details: ApiErrorResponse = {};

    try {
      details = (await response.json()) as ApiErrorResponse;
    } catch {
      // The HTTP status is still enough to classify the failure safely.
    }

    console.error('[wallet-platform] DOGE balance lookup failed', {
      status: response.status,
      error: details.error ?? null,
      reason: details.reason ?? null,
    });

    throw new WalletApiError(
      `Balance request failed with HTTP ${response.status}.`,
      response.status,
      details.error,
      details.reason,
    );
  }

  return (await response.json()) as DogecoinBalanceResponse;
}
