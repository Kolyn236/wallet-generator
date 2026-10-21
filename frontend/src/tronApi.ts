import { WalletApiError } from './api';
import { formatUsdtTrc20Amount, isTronMainnetAddress, TRON_USDT_CONTRACT } from './wallet/tron';
import type { PreparedTronTransactionData } from './wallet/tronTransaction';

export type TronTransferIntent = Pick<PreparedTronTransactionData, 'assetRouteId' | 'from' | 'to' | 'amountBaseUnits'>;
export type TronTransactionStatus = {
  chain: 'tron'; network: 'mainnet'; networkId: 'tron-mainnet'; txId: string;
  state: 'unknown' | 'observed' | 'included' | 'included-solidified' | 'executed-success' | 'executed-failure';
  solidified: boolean; blockNumber?: string; feeSun?: string; energyUsed?: string; failureCode?: string;
};
const root = '/api/chains/tron/mainnet';
async function request(path: string, signal?: AbortSignal, body?: TronTransferIntent): Promise<unknown> {
  const response = await fetch(`${root}${path}`, {
    method: body ? 'POST' : 'GET', headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    cache: 'no-store', signal, ...(body ? {body: JSON.stringify(body)} : {}),
  });
  if (!response.ok) throw new WalletApiError('TRON public data request failed.', response.status);
  return response.json();
}
function envelope(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_tron_response');
  const r = value as Record<string, unknown>;
  if (r.chain !== 'tron' || r.network !== 'mainnet' || r.networkId !== 'tron-mainnet') throw new Error('invalid_tron_response');
  return r;
}
export async function getUsdtTrc20Balance(address: string, signal?: AbortSignal): Promise<{address: string; balance: string; balanceBaseUnits: string}> {
  if (!isTronMainnetAddress(address)) throw new Error('invalid_address');
  const r = envelope(await request(`/tokens/usdt/addresses/${encodeURIComponent(address)}/balance`, signal));
  if (r.assetRouteId !== 'usdt-tron-mainnet-trc20' || r.address !== address || r.contractAddress !== TRON_USDT_CONTRACT || r.decimals !== 6 || typeof r.balanceBaseUnits !== 'string') throw new Error('invalid_tron_response');
  return {address, balanceBaseUnits: r.balanceBaseUnits, balance: formatUsdtTrc20Amount(r.balanceBaseUnits)};
}
/** Explicit allowlist: never serialize the caller object or any signing material. */
export async function prepareTronTransaction(intent: TronTransferIntent, signal?: AbortSignal): Promise<PreparedTronTransactionData> {
  const {assetRouteId, from, to, amountBaseUnits} = intent;
  // The browser review/serializer validates every preparation field against this intent.
  return await request('/transactions/prepare', signal, {assetRouteId, from, to, amountBaseUnits}) as PreparedTronTransactionData;
}
export async function getTronTransactionStatus(txId: string, signal?: AbortSignal): Promise<TronTransactionStatus> {
  if (!/^[0-9a-f]{64}$/.test(txId)) throw new Error('invalid_transaction_id');
  const r = envelope(await request(`/transactions/${txId}`, signal));
  const states = ['unknown', 'observed', 'included', 'included-solidified', 'executed-success', 'executed-failure'];
  if (r.txId !== txId || typeof r.state !== 'string' || !states.includes(r.state) || typeof r.solidified !== 'boolean'
    || (['included-solidified', 'executed-success', 'executed-failure'].includes(r.state) && !r.solidified)) throw new Error('invalid_tron_response');
  for (const field of ['blockNumber', 'feeSun', 'energyUsed']) {
    if (r[field] !== undefined && (typeof r[field] !== 'string' || !/^(0|[1-9]\d*)$/.test(r[field] as string) || (r[field] as string).length > 19)) throw new Error('invalid_tron_response');
  }
  if (r.state === 'executed-failure' && (typeof r.failureCode !== 'string' || !/^[A-Z_]{1,40}$/.test(r.failureCode))) throw new Error('invalid_tron_response');
  return r as TronTransactionStatus;
}
