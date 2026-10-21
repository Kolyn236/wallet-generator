import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

// Exercise the actual panel handlers in a dependency-injected closure. The signer
// is a spy: cryptographic bytes are covered separately by the canonical vectors.
for (const panel of ['Dogecoin', 'Bitcoin', 'Litecoin', 'Ethereum', 'UsdtErc20']) {
  const source = readFileSync(new URL(`../src/${panel}TransferPanel.tsx`, import.meta.url), 'utf8');
  function handler(name: string) {
    const start = source.search(new RegExp(`^  (?:async )?function ${name}\\(`, 'm'));
    assert.notEqual(start, -1, `${panel}: ${name} handler must exist`);
    const lineEnd = source.indexOf('\n', start);
    const end = source.slice(start, lineEnd).includes('setSignedTransfer(null)') ? lineEnd : source.indexOf('\n  }', lineEnd) + 4;
    return source.slice(start, end);
  }
  const handlers = ['resetResult', 'prepareTransfer', 'signTransfer', 'handleTransferError', 'broadcastPreparedTransfer'].map(handler).join('\n');
  const evm = panel === 'Ethereum' || panel === 'UsdtErc20';
  const token = panel === 'UsdtErc20';
  const builder = `buildSigned${panel}Transfer`;
  let signingCalls = 0;
  let broadcastCalls = 0;
  let resolveRead: ((value: unknown) => void) | undefined;
  let delayed = false;
  const utxo = { txid: 'a'.repeat(64), vout: 0, valueSmallestUnit: '900000000', confirmations: 2, scriptPubKey: '76a914' };
  const prepared = { chain: 'ethereum', network: 'mainnet', chainId: 1, from: 'source', to: token ? 'contract' : 'destination', valueWei: token ? '0' : '1', data: token ? 'calldata' : '0x', nonce: '7', gasLimit: '21000', senderBalanceWei: '999999999', feePolicy: { kind: 'eip1559', baseFeePerGasWei: '1', maxFeePerGasWei: '3', maxPriorityFeePerGasWei: '1' } };
  const read = async () => delayed ? new Promise((resolve) => { resolveRead = resolve; }) : { utxos: [utxo, { ...utxo, confirmations: 0 }] };
  const dependencies: Record<string, unknown> = {
    WalletApiError: class extends Error {},
    [`get${panel}Utxos`]: read,
    prepareEthereumTransaction: async () => delayed ? new Promise((resolve) => { resolveRead = resolve; }) : prepared,
    getUsdtErc20Balance: async () => ({ balanceSmallestUnit: '100' }),
    normalizeEthereumPrivateKey: () => {}, ethereumPrivateKeyMatchesAddress: () => true,
    parseEthToWei: () => '1', parseUsdtToSmallestUnit: () => '1', buildUsdtErc20TransferData: () => 'calldata',
    assertPreparedIntent: () => {}, USDT_ERC20_CONTRACT: 'contract',
    [builder]: (input: Record<string, unknown>) => {
      signingCalls++;
      assert.equal(input[evm ? 'privateKey' : 'wif'], 'local-key');
      assert.equal(input.sourceAddress, 'source');
      assert.equal(input.recipientAddress, 'destination');
      assert.ok(Object.isFrozen(input[evm ? 'prepared' : 'utxos']));
      return { rawTransaction: 'same-signed-bytes', txid: 'id', txHash: 'id' };
    },
    broadcastSignedTransaction: async (_destination: unknown, signed: { rawTransaction: string }) => {
      broadcastCalls++;
      assert.equal(signed.rawTransaction, 'same-signed-bytes');
      throw new Error('timeout');
    },
  };
  for (const chain of ['Dogecoin', 'Bitcoin', 'Litecoin', 'Ethereum']) {
    dependencies[`is${chain}MainnetAddress`] = () => true;
    dependencies[`is${chain}MainnetTransferRecipientAddress`] = () => true;
  }
  const setup = `
    let sender = 'source', recipient = 'destination', amount = '1', wif = 'local-key', privateKey = 'local-key';
    const feePolicy = {}, feePolicyState = 'loaded', assetId = 'doge', feeRate = '0.001';
    let state = 'idle', publicPreparation = null, signedTransfer = null, error = null;
    const generation = { current: 0 };
    const setState = (value) => { state = value; }, setError = (value) => { error = value; };
    const setPublicPreparation = (value) => { publicPreparation = value; };
    const setSignedTransfer = (value) => { signedTransfer = value; };
    const setBroadcastTxid = () => {}, setBroadcastTxHash = () => {};
    ${stripTypeScriptTypes(handlers)}
    return { prepareTransfer, signTransfer, resetResult, broadcastPreparedTransfer,
      get review() { return publicPreparation; }, get signed() { return signedTransfer; }, get state() { return state; } };
  `;
  const flow = new Function(...Object.keys(dependencies), setup)(...Object.values(dependencies));
  await flow.prepareTransfer({ preventDefault() {} });
  assert.equal(signingCalls, 0, `${panel}: prepare does not sign`);
  assert.equal(flow.state, 'review');
  assert.ok(Object.isFrozen(flow.review));
  assert.equal(flow.review[evm ? 'privateKey' : 'wif'], undefined, 'public review contains no key');
  if (!evm) assert.equal(flow.review.utxos.length, 1, 'only confirmed public inputs');
  assert.equal(flow.signed, null);
  flow.signTransfer();
  assert.equal(signingCalls, 1);
  assert.equal(flow.state, 'prepared');
  await flow.broadcastPreparedTransfer({});
  await flow.broadcastPreparedTransfer({});
  assert.equal(broadcastCalls, 2);
  assert.equal(signingCalls, 1, 'transport retry must never re-sign');
  flow.resetResult();
  flow.signTransfer();
  assert.equal(signingCalls, 1, 'invalidated review cannot sign');
  assert.equal(flow.review, null);
  assert.equal(flow.signed, null);
  delayed = true;
  const pending = flow.prepareTransfer({ preventDefault() {} });
  // Token preparation has a separate balance read before the delayed EVM read.
  await Promise.resolve(); await Promise.resolve();
  assert.ok(resolveRead);
  flow.resetResult();
  resolveRead!(evm ? prepared : { utxos: [utxo] });
  await pending;
  assert.equal(flow.review, null, 'stale async preparation cannot revive a review');
  assert.equal(flow.state, 'idle');
  if (!evm) {
    delayed = false;
    utxo.valueSmallestUnit = 'not-an-integer';
    await flow.prepareTransfer({ preventDefault() {} });
    assert.equal(flow.review, null, 'malformed provider amounts must not reach review rendering');
    assert.equal(flow.state, 'idle');
    utxo.valueSmallestUnit = 123 as unknown as string;
    await flow.prepareTransfer({ preventDefault() {} });
    assert.equal(flow.review, null, 'provider amounts must remain canonical strings');
  } else {
    delayed = false;
    prepared.nonce = 7 as unknown as string;
    await flow.prepareTransfer({ preventDefault() {} });
    assert.equal(flow.review, null, 'EVM quantities must remain canonical strings');
  }
}
console.log('Five panel handler behaviors: unsigned review, explicit sign, immutable snapshot, invalidation, stale reads, identical-byte retry passed.');
