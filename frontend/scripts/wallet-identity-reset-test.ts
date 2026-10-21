import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';

// No DOM dependency: execute each panel's real reset effect (including its real
// dependency expression and cleanup) and publication handler. Emulate React's
// Object.is dependency comparison, not an independently maintained identity list.
// Parent adapters recreate compatibility wallets; only their values are stable.
for (const panel of ['Dogecoin', 'Bitcoin', 'Litecoin', 'Ethereum', 'UsdtErc20']) {
  const source = readFileSync(new URL(`../src/${panel}TransferPanel.tsx`, import.meta.url), 'utf8');
  const effect = source.match(/  useEffect\(\(\) => \{\n    resetResult\(\);[\s\S]*?\n  \}, \[[^\]]*\]\);/);
  assert.ok(effect, `${panel}: wallet reset effect exists`);
  function handler(name: string) {
    const start = source.search(new RegExp(`^  (?:async )?function ${name}\\(`, 'm'));
    assert.notEqual(start, -1, `${panel}: ${name} exists`);
    return source.slice(start, source.indexOf('\n  }', start) + 4);
  }
  const evm = panel === 'Ethereum' || panel === 'UsdtErc20';
  const keyField = evm ? 'privateKey' : 'wif';
  function harness() {
    return new Function('assert', `
      let sourceAddress, createdWallet, walletMode, networkName, networkStandard, language;
      let sender, key, publicPreparation, signedTransfer, state, error, broadcastId;
      const generation = { current: 0 };
      const setSender = value => { sender = value; };
      const setWif = value => { key = value; }, setPrivateKey = setWif;
      const setPublicPreparation = value => { publicPreparation = value; };
      const setSignedTransfer = value => { signedTransfer = value; };
      const setState = value => { state = value; }, setError = value => { error = value; };
      const setBroadcastTxid = value => { broadcastId = value; }, setBroadcastTxHash = setBroadcastTxid;
      let dependencies, cleanup, resolvePublication;
      function useEffect(callback, next) {
        if (!dependencies || next.some((value, i) => !Object.is(value, dependencies[i]))) {
          cleanup?.(); cleanup = callback(); dependencies = next;
        }
      }
      const broadcastSignedTransaction = (_destination, signed) => {
        assert.equal(signed.rawTransaction, 'test-only-signed-public-bytes');
        return new Promise(resolve => { resolvePublication = resolve; });
      };
      ${stripTypeScriptTypes(handler('resetResult') + '\n' + handler('broadcastPreparedTransfer'))}
      return {
        render(props) {
          ({sourceAddress, createdWallet, walletMode, networkName, networkStandard, language} = props);
          ${effect[0]}
        },
        seed(phase) {
          publicPreparation = Object.freeze({ sourceAddress: 'test-source' });
          signedTransfer = phase === 'review' ? null : Object.freeze({
            rawTransaction: 'test-only-signed-public-bytes', txid: 'test-id', txHash: 'test-id'
          });
          state = phase; broadcastId = phase === 'broadcasted' ? 'test-id' : null;
          error = phase === 'prepared' ? 'broadcast' : null;
        },
        snapshot() { return { publicPreparation, signedTransfer, state, error, broadcastId, generation: generation.current }; },
        keyMatches(value) { return key === value; },
        senderMatches(value) { return sender === value; },
        publish: broadcastPreparedTransfer,
        finishPublication() { resolvePublication({ txid: 'test-id' }); },
        unmount() { cleanup?.(); }
      };
    `)(assert);
  }
  // Deliberately non-secret sentinels; never snapshot or print signing material.
  function props() {
    return { sourceAddress: 'test-source', createdWallet: { address: 'test-source', [keyField]: 'test-only-key' },
      walletMode: 'created', networkName: 'mainnet', networkStandard: 'original-standard', language: 'en' };
  }

  test(`${panel}: equivalent fresh wallet objects preserve review, signed bytes and publication status`, () => {
    for (const phase of ['review', 'prepared', 'broadcasted']) {
      const flow = harness();
      flow.render(props()); flow.seed(phase);
      const before = flow.snapshot();
      // Language, balance and backup changes can each cause a parent render.
      for (const language of ['ru', 'ru', 'en']) {
        flow.render({ ...props(), language });
        assert.deepEqual(flow.snapshot(), before, `${panel}: ${phase} survives parent rerender`);
      }
      flow.unmount();
    }
  });

  test(`${panel}: equivalent parent rerender preserves an in-flight publication response`, async () => {
    const flow = harness(); flow.render(props()); flow.seed('prepared');
    const pending = flow.publish({});
    const before = flow.snapshot();
    flow.render({ ...props(), language: 'ru' });
    assert.deepEqual(flow.snapshot(), before);
    flow.finishPublication(); await pending;
    assert.equal(flow.snapshot().state, 'broadcasted');
    assert.equal(flow.snapshot().broadcastId, 'test-id');
  });

  test(`${panel}: genuine wallet, mode and network changes clear results and reject stale publication`, async () => {
    const changes = [
      { sourceAddress: 'test-other-source' },
      { createdWallet: { ...props().createdWallet, address: 'test-other-source' } },
      { createdWallet: { ...props().createdWallet, [keyField]: 'test-only-replacement-key' } },
      { createdWallet: null },
      { walletMode: 'watch-only' }, { networkName: 'other-network' }, { networkStandard: 'other-standard' },
    ];
    for (const change of changes) {
      const flow = harness(); flow.render(props()); flow.seed('prepared');
      const pending = flow.publish({});
      const beforeGeneration = flow.snapshot().generation;
      const next = { ...props(), ...change };
      flow.render(next);
      assert.equal(flow.snapshot().publicPreparation, null);
      assert.equal(flow.snapshot().signedTransfer, null);
      assert.equal(flow.snapshot().broadcastId, null);
      assert.equal(flow.snapshot().error, null);
      assert.equal(flow.snapshot().state, 'idle');
      assert.ok(flow.snapshot().generation > beforeGeneration);
      assert.ok(flow.keyMatches(next.createdWallet?.[keyField] ?? ''), 'active key resynchronized');
      assert.ok(flow.senderMatches(next.sourceAddress), 'source resynchronized');
      flow.finishPublication(); await pending;
      assert.equal(flow.snapshot().state, 'idle');
      assert.equal(flow.snapshot().broadcastId, null);
    }
  });

  test(`${panel}: unmount still invalidates pending publication`, async () => {
    const flow = harness(); flow.render(props()); flow.seed('prepared');
    const pending = flow.publish({}); flow.unmount();
    flow.finishPublication(); await pending;
    assert.equal(flow.snapshot().broadcastId, null);
    assert.notEqual(flow.snapshot().state, 'broadcasted');
  });
}
