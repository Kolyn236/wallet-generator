export type HealthResponse = {
  status: 'ok';
  service: string;
};

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch('/api/health', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Health request failed with HTTP ${response.status}.`);
  }

  return (await response.json()) as HealthResponse;
}
