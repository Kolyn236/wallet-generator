import assert from 'node:assert/strict';
const api = await import('../src/tronApi.ts').catch(() => null);
assert.ok(api, 'TRON public API client must exist');
const address = 'TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH';
const contractAddress = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const balance = { chain: 'tron', network: 'mainnet', networkId: 'tron-mainnet', assetRouteId: 'usdt-tron-mainnet-trc20', address, contractAddress, decimals: 6, balanceBaseUnits: '1500000' };
let result: unknown = balance;
const requests: Array<{url: string; init: RequestInit}> = [];
globalThis.fetch = async (url, init) => { requests.push({url: String(url), init: init!}); return new Response(JSON.stringify(result)); };
assert.equal((await api.getUsdtTrc20Balance(address)).balance, '1.5');
for (const patch of [{networkId: 'ethereum-mainnet'}, {address: contractAddress}, {contractAddress: address}, {decimals: 18}, {balanceBaseUnits: 1}, {balanceBaseUnits: '01'}, {balanceBaseUnits: (1n<<256n).toString()}]) {
  result = {...balance, ...patch};
  await assert.rejects(api.getUsdtTrc20Balance(address));
}
const intent = {assetRouteId: 'usdt-tron-mainnet-trc20' as const, from: address, to: contractAddress, amountBaseUnits: '1500000'};
result = {};
await api.prepareTronTransaction({...intent, privateKey: 'must-not-send'} as typeof intent);
assert.deepEqual(JSON.parse(requests.at(-1)!.init.body as string), intent, 'only public intent may reach Symfony');
assert.equal(requests.at(-1)!.url, '/api/chains/tron/mainnet/transactions/prepare');
const txId = 'ab'.repeat(32);
for (const state of ['unknown', 'observed', 'included', 'included-solidified', 'executed-success', 'executed-failure']) {
  result = {chain: 'tron', network: 'mainnet', networkId: 'tron-mainnet', txId, state, solidified: ['included-solidified', 'executed-success', 'executed-failure'].includes(state), ...(state === 'executed-failure' ? {failureCode: 'REVERT'} : {})};
  assert.equal((await api.getTronTransactionStatus(txId)).state, state);
}
for (const patch of [{txId: 'cd'.repeat(32)}, {state: 'success'}, {solidified: 'yes'}, {network: 'nile'}, {state: 'executed-success', solidified: false}]) {
  result = {chain: 'tron', network: 'mainnet', networkId: 'tron-mainnet', txId, state: 'unknown', solidified: false, ...patch};
  await assert.rejects(api.getTronTransactionStatus(txId));
}
await assert.rejects(api.getTronTransactionStatus('bad'));
assert.ok(requests.every(r => !r.url.includes('broadcast')));
console.log('TRON API: public intent allowlist, exact balance and status validation passed.');
