export type BroadcastDestination =
  | { kind: 'utxo-blockcypher'; endpoint: string }
  | { kind: 'evm-json-rpc'; endpoint: string }
  | { kind: 'tron-http'; endpoint: string };

export type SignedBroadcastTransaction = { rawTransaction: string; txid: string };
const RESPONSE_LIMIT = 65_536;

/** Never route signed bytes through the application gateway, even on another port. */
export function validateBroadcastEndpoint(endpoint: string): string {
  let url: URL;
  try { url = new URL(endpoint); } catch { throw new Error('invalid_broadcast_destination'); }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (endpoint !== endpoint.trim() || url.protocol !== 'https:' || url.username || url.password || url.hash
    || host === globalThis.location?.hostname.toLowerCase().replace(/\.$/, '')
    || host === 'localhost' || host.endsWith('.localhost') || host === '[::1]'
    || host.startsWith('[::ffff:')
    || /^127\./.test(host) || host === '0.0.0.0'
    || /(?:^|\/)api(?:\/|$)/i.test(decodeURIComponent(url.pathname))) {
    throw new Error('invalid_broadcast_destination');
  }
  return url.href;
}

async function post(endpoint: string, payload: unknown, signal?: AbortSignal): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST', mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer',
      redirect: 'error', cache: 'no-store', signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch { throw new Error('broadcast_transport_failed'); }
  if (!response.ok || response.redirected || !response.body) throw new Error('broadcast_transport_failed');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > RESPONSE_LIMIT) throw new Error('invalid_broadcast_response');
      chunks.push(value);
    }
  } catch {
    await reader.cancel().catch(() => {});
    throw new Error('invalid_broadcast_response');
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const body: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch { throw new Error('invalid_broadcast_response'); }
}

function verifyIdentity(candidate: unknown, expected: string): string {
  if (typeof candidate !== 'string' || !/^(?:0x)?[0-9a-fA-F]{64}$/.test(candidate)
    || candidate.toLowerCase() !== expected.toLowerCase()) throw new Error('broadcast_txid_mismatch');
  return candidate;
}

/** Only already-signed public bytes belong at this boundary. No signer is accepted. */
export async function broadcastSignedTransaction(
  destination: BroadcastDestination,
  signed: SignedBroadcastTransaction,
  signal?: AbortSignal,
): Promise<{ txid: string }> {
  const endpoint = validateBroadcastEndpoint(destination.endpoint);
  if (!['utxo-blockcypher', 'evm-json-rpc', 'tron-http'].includes(destination.kind)) throw new Error('unsupported_broadcast_transport');
  const evm = destination.kind === 'evm-json-rpc';
  const rawPattern = evm ? /^0x(?:[0-9a-fA-F]{2})+$/ : /^(?:[0-9a-fA-F]{2})+$/;
  const identityPattern = evm ? /^0x[0-9a-fA-F]{64}$/ : /^[0-9a-fA-F]{64}$/;
  if (typeof signed.rawTransaction !== 'string' || signed.rawTransaction.length > (evm ? 2_000_002 : 2_000_000)
    || !rawPattern.test(signed.rawTransaction) || !identityPattern.test(signed.txid)) throw new Error('invalid_signed_transaction');
  if (destination.kind === 'evm-json-rpc') {
    const rpc = async (id: number, method: string, params: string[]) => {
      const body = await post(endpoint, { jsonrpc: '2.0', id, method, params }, signal);
      if (body.jsonrpc !== '2.0' || body.id !== id || 'error' in body || !('result' in body)) {
        throw new Error('invalid_broadcast_response');
      }
      return body.result;
    };
    if (await rpc(1, 'eth_chainId', []) !== '0x1') throw new Error('wrong_broadcast_network');
    return { txid: verifyIdentity(await rpc(2, 'eth_sendRawTransaction', [signed.rawTransaction]), signed.txid) };
  }
  if (destination.kind === 'tron-http') {
    const url = new URL(endpoint);
    if (url.pathname !== '/' && url.pathname !== '/wallet/broadcasthex') throw new Error('invalid_broadcast_destination');
    url.pathname = '/wallet/broadcasthex';
    const body = await post(url.href, { transaction: signed.rawTransaction }, signal);
    if (body.result !== true) throw new Error('broadcast_rejected');
    return { txid: 'txid' in body ? verifyIdentity(body.txid, signed.txid) : signed.txid };
  }
  const body = await post(endpoint, { tx: signed.rawTransaction }, signal);
  const tx = body.tx as Record<string, unknown> | undefined;
  return { txid: verifyIdentity(tx?.hash, signed.txid) };
}
