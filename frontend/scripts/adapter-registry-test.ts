import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  adapterRegistry,
  createAdapterRegistry,
} from '../src/runtime/adapterRegistry.ts';
import {
  bitcoinMainnetAssetRouteAdapter,
  bitcoinMainnetWalletAdapter,
} from '../src/runtime/adapters/bitcoinMainnet.ts';
import {
  dogecoinMainnetAssetRouteAdapter,
  dogecoinMainnetWalletAdapter,
} from '../src/runtime/adapters/dogecoinMainnet.ts';
import {
  createWalletSessions,
  getWalletSession,
  withWalletSession,
} from '../src/runtime/walletSessions.ts';

assert.equal(
  adapterRegistry.resolveAssetRoute('doge-dogecoin-mainnet-native')?.assetId,
  'doge',
);
assert.equal(
  adapterRegistry.resolveAssetRoute('doge-dogecoin-mainnet-native')?.networkId,
  'dogecoin-mainnet',
);
assert.equal(
  adapterRegistry.resolveWalletNetwork('dogecoin-mainnet')?.networkId,
  'dogecoin-mainnet',
);

assert.equal(
  adapterRegistry.resolveAssetRoute('btc-bitcoin-mainnet-native')?.assetId,
  'btc',
);
assert.equal(
  adapterRegistry.resolveAssetRoute('btc-bitcoin-mainnet-native')?.networkId,
  'bitcoin-mainnet',
);
assert.equal(
  adapterRegistry.resolveWalletNetwork('bitcoin-mainnet')?.networkId,
  'bitcoin-mainnet',
);

assert.equal(adapterRegistry.resolveAssetRoute('eth-ethereum-mainnet-native'), null);
assert.equal(adapterRegistry.resolveAssetRoute('usdt-ethereum-mainnet-erc20'), null);
assert.equal(adapterRegistry.resolveAssetRoute('usdt-tron-mainnet-trc20'), null);
assert.equal(adapterRegistry.resolveWalletNetwork('ethereum-mainnet'), null);
assert.equal(adapterRegistry.resolveWalletNetwork('tron-mainnet'), null);
assert.equal(adapterRegistry.resolveAssetRoute('unknown-route'), null);
assert.equal(adapterRegistry.resolveWalletNetwork('unknown-network'), null);

assert.throws(
  () => createAdapterRegistry({
    walletNetworkAdapters: [dogecoinMainnetWalletAdapter, dogecoinMainnetWalletAdapter],
  }),
  /Duplicate wallet network adapter: dogecoin-mainnet/,
);

assert.throws(
  () => createAdapterRegistry({
    walletNetworkAdapters: [dogecoinMainnetWalletAdapter],
    assetRouteAdapters: [dogecoinMainnetAssetRouteAdapter, dogecoinMainnetAssetRouteAdapter],
  }),
  /Duplicate asset route adapter: doge-dogecoin-mainnet-native/,
);

const independentRegistry = createAdapterRegistry({
  walletNetworkAdapters: [dogecoinMainnetWalletAdapter, bitcoinMainnetWalletAdapter],
  assetRouteAdapters: [dogecoinMainnetAssetRouteAdapter, bitcoinMainnetAssetRouteAdapter],
});
assert.ok(independentRegistry.resolveAssetRoute('doge-dogecoin-mainnet-native'));
assert.ok(independentRegistry.resolveAssetRoute('btc-bitcoin-mainnet-native'));

let sessions = createWalletSessions();
sessions = withWalletSession(sessions, 'dogecoin-mainnet', {
  address: 'D-dogecoin-session',
  balance: '12.00000000',
  mode: 'watch-only',
});
sessions = withWalletSession(sessions, 'bitcoin-mainnet', {
  address: '1-bitcoin-session',
  balance: '0.50000000',
  mode: 'created',
});

assert.equal(getWalletSession(sessions, 'dogecoin-mainnet').address, 'D-dogecoin-session');
assert.equal(getWalletSession(sessions, 'dogecoin-mainnet').balance, '12.00000000');
assert.equal(getWalletSession(sessions, 'bitcoin-mainnet').address, '1-bitcoin-session');
assert.equal(getWalletSession(sessions, 'bitcoin-mainnet').balance, '0.50000000');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const srcDirectory = join(process.cwd(), 'src');
const storageWrites: Array<{ file: string; call: string }> = [];

for (const file of sourceFiles(srcDirectory)) {
  const source = readFileSync(file, 'utf8');
  assert.equal(
    /sessionStorage\s*\.\s*setItem\s*\(/.test(source),
    false,
    `sessionStorage writes are forbidden in ${relative(process.cwd(), file)}`,
  );

  for (const match of source.matchAll(/localStorage\s*\.\s*setItem\s*\(([^\n;]*)\)/g)) {
    storageWrites.push({
      file: relative(process.cwd(), file),
      call: match[0],
    });
  }

  assert.equal(
    /(?:localStorage|sessionStorage)\s*\.\s*setItem\s*\([^\n;]*(?:wif|mnemonic|privateKey|seed)/i.test(source),
    false,
    `wallet secret persistence is forbidden in ${relative(process.cwd(), file)}`,
  );
}

assert.deepEqual(storageWrites, [{
  file: 'src/App.tsx',
  call: 'localStorage.setItem(LANGUAGE_KEY, language)',
}]);

console.log('Frontend wallet adapter registry tests passed.');
