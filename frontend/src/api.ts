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
