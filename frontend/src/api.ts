export type DogecoinBalanceResponse = {
  chain: 'dogecoin';
  network: 'mainnet';
  address: string;
  balance: string;
  balanceSmallestUnit: number;
  unit: 'DOGE';
};

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
    throw new Error(`Balance request failed with HTTP ${response.status}.`);
  }

  return (await response.json()) as DogecoinBalanceResponse;
}
