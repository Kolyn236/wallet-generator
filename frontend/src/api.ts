import type { BitcoinUtxo } from './wallet/bitcoinTransaction';
import type { DogecoinUtxo } from './wallet/dogecoinTransaction';
import type { LitecoinUtxo } from './wallet/litecoinTransaction';

export type DogecoinBalanceResponse = { chain: 'dogecoin'; network: 'mainnet'; address: string; balance: string; balanceSmallestUnit: number; unit: 'DOGE' };
export type BitcoinBalanceResponse = { chain: 'bitcoin'; network: 'mainnet'; address: string; balance: string; balanceSmallestUnit: number; unit: 'BTC' };
export type LitecoinBalanceResponse = { chain: 'litecoin'; network: 'mainnet'; address: string; balance: string; balanceSmallestUnit: number; unit: 'LTC' };
export type EthereumBalanceResponse = { chain: 'ethereum'; network: 'mainnet'; address: string; balance: string; balanceWei: string; unit: 'ETH' };

export type DogecoinFeePolicyResponse = { chain: 'dogecoin'; network: 'mainnet'; kind: 'utxo-rate-per-kb'; recommendedRate: string; unit: 'DOGE/kB' };
export type BitcoinFeePolicyResponse = { chain: 'bitcoin'; network: 'mainnet'; kind: 'utxo-rate-per-kb'; recommendedRate: string; unit: 'BTC/kB' };
export type LitecoinFeePolicyResponse = { chain: 'litecoin'; network: 'mainnet'; kind: 'utxo-rate-per-kb'; recommendedRate: string; unit: 'LTC/kB' };

export type DogecoinUtxoResponse = { chain: 'dogecoin'; network: 'mainnet'; address: string; utxos: DogecoinUtxo[] };
export type BitcoinUtxoResponse = { chain: 'bitcoin'; network: 'mainnet'; address: string; utxos: BitcoinUtxo[] };
export type LitecoinUtxoResponse = { chain: 'litecoin'; network: 'mainnet'; address: string; utxos: LitecoinUtxo[] };
export type EthereumPrepareResponse = {
  chain: 'ethereum'; network: 'mainnet'; chainId: 1; from: string; to: string; valueWei: string; data: string; senderBalanceWei: string; nonce: string; gasLimit: string;
  feePolicy: { kind: 'eip1559'; baseFeePerGasWei: string; maxPriorityFeePerGasWei: string; maxFeePerGasWei: string };
};
type ApiErrorResponse = { error?: string; reason?: string };

export class WalletApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string, public readonly reason?: string) { super(message); this.name = 'WalletApiError'; }
}

export async function getHealth(signal?: AbortSignal): Promise<void> {
  const response = await fetch('/api/health', { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store', signal });
  if (!response.ok) throw new Error(`Health request failed with HTTP ${response.status}.`);
}

export async function getDogecoinFeePolicy(signal?: AbortSignal): Promise<DogecoinFeePolicyResponse> { return getJson('/api/chains/dogecoin/mainnet/fee-policy', 'DOGE fee policy lookup', signal); }
export async function getBitcoinFeePolicy(signal?: AbortSignal): Promise<BitcoinFeePolicyResponse> { return getJson('/api/chains/bitcoin/mainnet/fee-policy', 'BTC fee policy lookup', signal); }
export async function getLitecoinFeePolicy(signal?: AbortSignal): Promise<LitecoinFeePolicyResponse> { return getJson('/api/chains/litecoin/mainnet/fee-policy', 'LTC fee policy lookup', signal); }

export async function getDogecoinBalance(address: string, signal?: AbortSignal): Promise<DogecoinBalanceResponse> { return getJson(`/api/chains/dogecoin/mainnet/addresses/${encodeURIComponent(address)}/balance`, 'DOGE balance lookup', signal); }
export async function getBitcoinBalance(address: string, signal?: AbortSignal): Promise<BitcoinBalanceResponse> { return getJson(`/api/chains/bitcoin/mainnet/addresses/${encodeURIComponent(address)}/balance`, 'BTC balance lookup', signal); }
export async function getLitecoinBalance(address: string, signal?: AbortSignal): Promise<LitecoinBalanceResponse> { return getJson(`/api/chains/litecoin/mainnet/addresses/${encodeURIComponent(address)}/balance`, 'LTC balance lookup', signal); }
export async function getEthereumBalance(address: string, signal?: AbortSignal): Promise<EthereumBalanceResponse> { return getJson(`/api/chains/ethereum/mainnet/addresses/${encodeURIComponent(address)}/balance`, 'ETH balance lookup', signal); }

export async function getDogecoinUtxos(address: string, signal?: AbortSignal): Promise<DogecoinUtxoResponse> { return getJson(`/api/chains/dogecoin/mainnet/addresses/${encodeURIComponent(address)}/utxos`, 'DOGE UTXO lookup', signal); }
export async function getBitcoinUtxos(address: string, signal?: AbortSignal): Promise<BitcoinUtxoResponse> { return getJson(`/api/chains/bitcoin/mainnet/addresses/${encodeURIComponent(address)}/utxos`, 'BTC UTXO lookup', signal); }
export async function getLitecoinUtxos(address: string, signal?: AbortSignal): Promise<LitecoinUtxoResponse> { return getJson(`/api/chains/litecoin/mainnet/addresses/${encodeURIComponent(address)}/utxos`, 'LTC UTXO lookup', signal); }

export async function prepareEthereumTransaction(intent: { from: string; to: string; valueWei: string; data: string }, signal?: AbortSignal): Promise<EthereumPrepareResponse> { return postJson('/api/chains/ethereum/mainnet/transactions/prepare', intent, 'ETH transaction preparation', signal); }

async function getJson<T>(url: string, operation: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store', signal });
  if (!response.ok) throw await apiError(response, operation);
  return (await response.json()) as T;
}
async function postJson<T>(url: string, payload: unknown, operation: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(payload), cache: 'no-store', signal });
  if (!response.ok) throw await apiError(response, operation);
  return (await response.json()) as T;
}
async function apiError(response: Response, operation: string): Promise<WalletApiError> {
  let details: ApiErrorResponse = {};
  try { details = (await response.json()) as ApiErrorResponse; } catch { /* HTTP status still classifies the failure. */ }
  console.error(`[chain-courier] ${operation} failed`, { status: response.status, error: details.error ?? null, reason: details.reason ?? null });
  return new WalletApiError(`${operation} failed with HTTP ${response.status}.`, response.status, details.error, details.reason);
}
