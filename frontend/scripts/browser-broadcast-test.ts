import assert from 'node:assert/strict';

const module = await import('../src/broadcast/browserBroadcast.ts').catch(() => ({}));
assert.equal(typeof module.broadcastSignedTransaction, 'function', 'browser-owned broadcast capability must exist');
const { broadcastSignedTransaction } = module;
const txid = 'ab'.repeat(32);
const calls: { url: string; init: RequestInit }[] = [];
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), init: init! });
  return Response.json({ tx: { hash: txid } });
};
const result = await broadcastSignedTransaction(
  { kind: 'utxo-blockcypher', endpoint: 'https://node.example/v1/doge/main/txs/push' },
  { rawTransaction: 'aabb', txid },
);
assert.equal(result.txid, txid);
assert.equal(calls[0].url, 'https://node.example/v1/doge/main/txs/push');
assert.deepEqual(JSON.parse(calls[0].init.body as string), { tx: 'aabb' });
assert.equal(calls[0].init.credentials, 'omit');
assert.equal(calls[0].init.referrerPolicy, 'no-referrer');
assert.equal(calls[0].init.redirect, 'error');
assert.equal(calls[0].init.mode, 'cors');
console.log('browser broadcast: UTXO direct transport passes');

Object.defineProperty(globalThis, 'location', { value: new URL('https://wallet.example/'), configurable: true });
for (const endpoint of [
  '/api/chains/dogecoin/mainnet/transactions/broadcast',
  'https://wallet.example/api/chains/bitcoin/mainnet/transactions/broadcast',
  'https://wallet.example:444/relay', 'https://wallet.example./relay',
  'https://localhost./push', 'https://[::ffff:127.0.0.1]/push',
  'https://other.example/api/chains/litecoin/mainnet/transactions/broadcast',
  'http://node.example/push', 'javascript:alert(1)', 'https://user:password@node.example/push',
  'https://node.example/push#fragment', 'https://localhost:8080/push', 'https://127.0.0.1/push',
]) {
  const before = calls.length;
  await assert.rejects(() => broadcastSignedTransaction({ kind: 'utxo-blockcypher', endpoint }, { rawTransaction: 'aabb', txid }));
  assert.equal(calls.length, before, `blocked destination must never receive fetch: ${endpoint}`);
}
for (const body of [{ tx: { hash: 'bad' } }, { tx: { hash: 'cd'.repeat(32) } }, {}, { error: 'raw aabb' }]) {
  globalThis.fetch = async () => Response.json(body);
  await assert.rejects(() => broadcastSignedTransaction({ kind: 'utxo-blockcypher', endpoint: 'https://node.example/push' }, { rawTransaction: 'aabb', txid }));
}
globalThis.fetch = async () => new Response('x'.repeat(65537));
await assert.rejects(() => broadcastSignedTransaction({ kind: 'utxo-blockcypher', endpoint: 'https://node.example/push' }, { rawTransaction: 'aabb', txid }));
globalThis.fetch = async () => Response.json({ tx: { hash: txid } }, { status: 500 });
await assert.rejects(() => broadcastSignedTransaction({ kind: 'utxo-blockcypher', endpoint: 'https://node.example/push' }, { rawTransaction: 'aabb', txid }));
console.log('browser broadcast: forbidden destinations and untrusted responses rejected');

const evmSigned = { rawTransaction: '0x02aabb', txid: `0x${txid}` };
const rpcCalls: Record<string, unknown>[] = [];
globalThis.fetch = async (_url, init) => {
  const request = JSON.parse(init!.body as string);
  rpcCalls.push(request);
  return Response.json({ jsonrpc: '2.0', id: request.id, result: request.method === 'eth_chainId' ? '0x1' : evmSigned.txid });
};
assert.equal((await broadcastSignedTransaction({ kind: 'evm-json-rpc', endpoint: 'https://node.example/rpc' }, evmSigned)).txid, evmSigned.txid);
assert.deepEqual(rpcCalls.map(call => call.method), ['eth_chainId', 'eth_sendRawTransaction']);
assert.deepEqual(rpcCalls[1].params, [evmSigned.rawTransaction]);
assert.deepEqual(rpcCalls[0].params, []);
for (const response of [
  { jsonrpc: '2.0', id: 1, result: '0x89' },
  { jsonrpc: '2.0', id: 99, result: '0x1' },
  { jsonrpc: '2.0', id: 1, result: '0x1', error: { message: 'untrusted' } },
]) {
  let count = 0;
  globalThis.fetch = async () => { count++; return Response.json(response); };
  await assert.rejects(() => broadcastSignedTransaction({ kind: 'evm-json-rpc', endpoint: 'https://node.example/rpc' }, evmSigned));
  assert.equal(count, 1, 'wrong network or malformed RPC must not send signed bytes');
}
console.log('browser broadcast: EVM mainnet preflight passes');

const tronRequests: { url: string; body: unknown }[] = [];
globalThis.fetch = async (url, init) => {
  tronRequests.push({ url: String(url), body: JSON.parse(init!.body as string) });
  return Response.json({ result: true, txid });
};
assert.deepEqual(await broadcastSignedTransaction({ kind: 'tron-http', endpoint: 'https://tron.example/' }, { rawTransaction: 'aabb', txid }), { txid });
assert.deepEqual(tronRequests, [{ url: 'https://tron.example/wallet/broadcasthex', body: { transaction: 'aabb' } }]);
for (const response of [{ result: false }, { result: true, txid: 'cd'.repeat(32) }, { result: 'true' }, { result: true, txid: null }]) {
  globalThis.fetch = async () => Response.json(response);
  await assert.rejects(() => broadcastSignedTransaction({ kind: 'tron-http', endpoint: 'https://tron.example' }, { rawTransaction: 'aabb', txid }));
}
globalThis.fetch = async () => Response.json({ result: true });
assert.deepEqual(await broadcastSignedTransaction({ kind: 'tron-http', endpoint: 'https://tron.example' }, { rawTransaction: 'aabb', txid }), { txid });
console.log('browser broadcast: TRON broadcasthex and optional identity verification pass');

for (const signed of [
  { rawTransaction: '', txid }, { rawTransaction: 'not-hex', txid }, { rawTransaction: 'abc', txid },
  { rawTransaction: 'aabb', txid: 'bad' }, { rawTransaction: 'ab'.repeat(1_000_001), txid },
]) {
  let count = 0;
  globalThis.fetch = async () => { count++; return Response.json({ tx: { hash: txid } }); };
  await assert.rejects(() => broadcastSignedTransaction({ kind: 'utxo-blockcypher', endpoint: 'https://node.example/push' }, signed));
  assert.equal(count, 0, 'malformed transaction must fail before fetch');
}
await assert.rejects(() => broadcastSignedTransaction({ kind: 'unsupported', endpoint: 'https://node.example/push' }, { rawTransaction: 'aabb', txid }));
const attempts: string[] = [];
globalThis.fetch = async (_url, init) => {
  attempts.push(init!.body as string);
  if (attempts.length === 1) throw new Error('provider URL or raw transaction must not be reflected');
  return Response.json({ tx: { hash: txid } });
};
const destination = { kind: 'utxo-blockcypher', endpoint: 'https://node.example/push' } as const;
const signed = { rawTransaction: 'aabb', txid };
await assert.rejects(() => broadcastSignedTransaction(destination, signed), { message: 'broadcast_transport_failed' });
await broadcastSignedTransaction(destination, signed);
assert.deepEqual(attempts, ['{"tx":"aabb"}', '{"tx":"aabb"}']);
console.log('browser broadcast: invalid signed inputs fail closed; failed transport retries identical bytes');
