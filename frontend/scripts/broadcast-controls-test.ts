import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const controls = await import('../src/broadcast/BroadcastControls.tsx');
assert.equal(typeof controls.BroadcastControls, 'function', 'shared user-controlled broadcast UI must exist');
let requests = 0;
globalThis.fetch = async () => { requests++; throw new Error('must not auto-broadcast'); };
for (const language of ['en', 'ru']) {
  const html = renderToStaticMarkup(createElement(controls.BroadcastControls, {
    language, kind: 'utxo-blockcypher', rawTransaction: 'aabb', txid: 'ab'.repeat(32),
    busy: false, disabled: false, onBroadcast: () => { throw new Error('not explicit'); },
  }));
  assert.match(html, /type="url"/);
  assert.match(html, /value=""/);
  assert.match(html, /autoComplete="off"/i);
  assert.match(html, /aabb/);
  assert.match(html, /disabled=""/); // no URL: cannot broadcast
  assert.match(html, language === 'en' ? /Export signed transaction/ : /Экспорт подписанной транзакции/);
}
assert.equal(requests, 0);
console.log('broadcast controls: EN/RU, explicit custom endpoint, export-only initial render pass');

const api = await readFile(new URL('../src/api.ts', import.meta.url), 'utf8');
assert.doesNotMatch(api, /broadcast\w*Transaction|postRawTransaction|transactions\/broadcast/, 'Symfony API client must not expose any signed-byte transport');
for (const panel of ['Dogecoin', 'Bitcoin', 'Litecoin', 'Ethereum', 'UsdtErc20']) {
  const source = await readFile(new URL(`../src/${panel}TransferPanel.tsx`, import.meta.url), 'utf8');
  assert.match(source, /<BroadcastControls/);
  assert.match(source, /broadcastSignedTransaction\(destination,/);
  const handler = source.split('async function broadcastPreparedTransfer')[1].split('return (')[0];
  assert.doesNotMatch(handler, /buildSigned|prepareEthereumTransaction|get\w+Utxos|setSignedTransfer/);
  assert.match(handler, /setState\('prepared'\)/, 'failure retains prepared bytes for retry');
  assert.match(handler, /toLowerCase\(\) !== signedTransfer\.(txid|txHash)\.toLowerCase\(\)/, 'local identity comparison stays in originating panel');
}
console.log('broadcast controls: all five panels retain local verification and same-bytes retry; no Symfony broadcaster');
