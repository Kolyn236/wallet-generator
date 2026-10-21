import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createTronTransferFlow} from '../src/tronTransferFlow.ts';
import {prepared, now, input} from './tron-review-test.ts';
import {deriveTronWallet} from '../src/wallet/tron.ts';
const panel = await import('../src/TronTransferPanel.tsx').catch(() => null);
assert.ok(panel, 'TRON bilingual transfer panel must exist');
const wallet = deriveTronWallet('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
const flow = createTronTransferFlow({now: () => now, prepare: async () => prepared});
const props = {sourceAddress: wallet.address, walletMode: 'local-signing' as const, createdWallet: {address: wallet.address, derivationPath: wallet.derivationPath, origin: 'mnemonic' as const, signingMaterial: {kind: 'private-key' as const, value: wallet.privateKey}}, networkName: 'TRON', networkStandard: 'TRC-20', flow};
let requests = 0;
globalThis.fetch = async () => {requests++; throw new Error('render must not send');};
for (const language of ['en', 'ru'] as const) {
  const initial = renderToStaticMarkup(createElement(panel.TronTransferPanel, {...props, language, walletMode: 'watch-only'}));
  assert.match(initial, language === 'en' ? /Watch-only/ : /Только просмотр/);
  assert.doesNotMatch(initial, /type="password"|signed-transaction|node base URL/);
}
await flow.prepare(input.sourceAddress, input.recipientAddress, input.amount);
for (const language of ['en', 'ru'] as const) {
  const html = renderToStaticMarkup(createElement(panel.TronTransferPanel, {...props, language}));
  assert.match(html, language === 'en' ? /Sign locally/ : /Подписать локально/);
  assert.doesNotMatch(html, /Export signed transaction|Экспорт подписанной транзакции/);
  for (const field of ['from', 'to', 'assetRouteId', 'contractAddress', 'amountBaseUnits', 'refBlockId', 'refBlockBytesHex', 'refBlockHashHex', 'refBlockNumber', 'timestampMs', 'expirationMs', 'feeLimitSun', 'energyEstimate', 'energyPriceSun', 'bandwidthPriceSun', 'senderTrxSun', 'senderTokenBalanceBaseUnits', 'maxNetworkFeeSun', 'txId']) {
    assert.ok(html.includes(String(flow.getSnapshot().review![field])), `review exposes ${field}`);
  }
  assert.doesNotMatch(html, new RegExp(wallet.privateKey));
}
flow.sign(wallet.privateKey, 'local-signing');
for (const language of ['en', 'ru'] as const) {
  const html = renderToStaticMarkup(createElement(panel.TronTransferPanel, {...props, language}));
  assert.match(html, language === 'en' ? /Export signed transaction/ : /Экспорт подписанной транзакции/);
  assert.match(html, /type="url"/);
  assert.match(html, language === 'en' ? /Check execution status/ : /Проверить исполнение/);
}
assert.equal(requests, 0);
console.log('TRON panel: EN/RU review fields before signing; export/direct publication only after signing; no auto requests.');
