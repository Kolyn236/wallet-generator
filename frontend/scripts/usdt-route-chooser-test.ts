import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { UsdtRouteChooser } from '../src/UsdtRouteChooser.ts';
import { createWalletSessions, withWalletSession } from '../src/runtime/walletSessions.ts';
import { createAssetRouteBalances, withAssetRouteBalance } from '../src/runtime/assetRouteBalances.ts';

let requests = 0;
globalThis.fetch = async () => { requests += 1; throw new Error('Rendering must not request providers'); };
const sessions = withWalletSession(withWalletSession(createWalletSessions(), 'ethereum-mainnet', {
  address: 'ethereum-public-address', mode: 'local-signing',
}), 'tron-mainnet', { address: 'tron-public-address', mode: 'watch-only' });
const balances = withAssetRouteBalance(withAssetRouteBalance(createAssetRouteBalances(), 'usdt-ethereum-mainnet-erc20', {
  address: 'ethereum-public-address', balance: '12.34', status: 'loaded',
}), 'usdt-tron-mainnet-trc20', { address: 'old-tron-address', balance: '999', status: 'loaded' });
for (const language of ['en', 'ru'] as const) {
  const html = renderToStaticMarkup(createElement(UsdtRouteChooser, {
    language, selectedRoute: 'usdt-tron-mainnet-trc20', sessions, balances, onSelect: () => {},
  }));
  assert.match(html, /ERC-20/);
  assert.match(html, /TRC-20/);
  assert.match(html, /ETH/);
  assert.match(html, /TRX/);
  assert.match(html, /ethereum-public-address/);
  assert.match(html, /tron-public-address/);
  assert.match(html, /12.34 USDT/);
  assert.doesNotMatch(html, /999/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, language === 'en' ? /not a swap or bridge/ : /не обмен и не мост/);
  assert.match(html, language === 'en' ? /Watch-only/ : /Только просмотр/);
}
assert.equal(requests, 0);
console.log('USDT route chooser: independent identities, route balances, EN/RU, no render-time requests passed.');
