import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  assetRoutes,
  getAssetRouteAvailability,
} from '../src/assets.ts';
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
  ethereumMainnetAssetRouteAdapter,
  ethereumMainnetWalletAdapter,
  usdtEthereumMainnetAssetRouteAdapter,
} from '../src/runtime/adapters/ethereumMainnet.ts';
import {
  createAssetRouteBalances,
  getAssetRouteBalance,
  invalidateAssetRouteBalancesForNetwork,
  withAssetRouteBalance,
} from '../src/runtime/assetRouteBalances.ts';
import {
  createWalletSessions,
  getWalletSession,
  withWalletSession,
} from '../src/runtime/walletSessions.ts';

const liveRoutes = assetRoutes.filter(
  (route) => getAssetRouteAvailability(route.id) === 'ready-next',
);
const plannedRoutes = assetRoutes.filter(
  (route) => getAssetRouteAvailability(route.id) === 'planned',
);

for (const route of liveRoutes) {
  const routeAdapter = adapterRegistry.resolveAssetRoute(route.id);
  assert.ok(routeAdapter, `Live asset route has no runtime adapter: ${route.id}`);
  assert.equal(routeAdapter.routeId, route.id);
  assert.equal(routeAdapter.assetId, route.assetId);
  assert.equal(routeAdapter.networkId, route.networkId);
  assert.equal(typeof routeAdapter.loadBalance, 'function');

  const walletAdapter = adapterRegistry.resolveWalletNetwork(route.networkId);
  assert.ok(walletAdapter, `Live asset route has no wallet network adapter: ${route.id}`);
  assert.equal(walletAdapter.networkId, route.networkId);
  assert.equal('loadBalance' in walletAdapter, false, 'Wallet network adapters must not own asset balance loading.');
}

for (const route of plannedRoutes) {
  assert.equal(
    adapterRegistry.resolveAssetRoute(route.id),
    null,
    `Planned route must not resolve to a runtime adapter: ${route.id}`,
  );
}

assert.strictEqual(
  adapterRegistry.resolveAssetRoute('doge-dogecoin-mainnet-native'),
  dogecoinMainnetAssetRouteAdapter,
);
assert.strictEqual(
  adapterRegistry.resolveWalletNetwork('dogecoin-mainnet'),
  dogecoinMainnetWalletAdapter,
);
assert.strictEqual(
  adapterRegistry.resolveAssetRoute('btc-bitcoin-mainnet-native'),
  bitcoinMainnetAssetRouteAdapter,
);
assert.strictEqual(
  adapterRegistry.resolveWalletNetwork('bitcoin-mainnet'),
  bitcoinMainnetWalletAdapter,
);
assert.strictEqual(
  adapterRegistry.resolveAssetRoute('eth-ethereum-mainnet-native'),
  ethereumMainnetAssetRouteAdapter,
);
assert.strictEqual(
  adapterRegistry.resolveAssetRoute('usdt-ethereum-mainnet-erc20'),
  usdtEthereumMainnetAssetRouteAdapter,
);
assert.strictEqual(
  adapterRegistry.resolveWalletNetwork('ethereum-mainnet'),
  ethereumMainnetWalletAdapter,
);
assert.notStrictEqual(ethereumMainnetAssetRouteAdapter, usdtEthereumMainnetAssetRouteAdapter);
assert.notStrictEqual(dogecoinMainnetAssetRouteAdapter, bitcoinMainnetAssetRouteAdapter);
assert.notStrictEqual(bitcoinMainnetAssetRouteAdapter, ethereumMainnetAssetRouteAdapter);
assert.notStrictEqual(dogecoinMainnetWalletAdapter, bitcoinMainnetWalletAdapter);
assert.notStrictEqual(bitcoinMainnetWalletAdapter, ethereumMainnetWalletAdapter);

assert.equal(getAssetRouteAvailability('doge-dogecoin-mainnet-native'), 'ready-next');
assert.equal(getAssetRouteAvailability('btc-bitcoin-mainnet-native'), 'ready-next');
assert.equal(getAssetRouteAvailability('eth-ethereum-mainnet-native'), 'ready-next');
assert.equal(getAssetRouteAvailability('usdt-ethereum-mainnet-erc20'), 'ready-next');
assert.equal(getAssetRouteAvailability('usdt-tron-mainnet-trc20'), 'planned');

assert.equal(adapterRegistry.resolveAssetRoute('usdt-tron-mainnet-trc20'), null);
assert.equal(adapterRegistry.resolveWalletNetwork('tron-mainnet'), null);

for (const unknownRoute of [
  'unknown-route',
  'btc-dogecoin-mainnet-native',
  'doge-bitcoin-mainnet-native',
  'eth-bitcoin-mainnet-native',
  'usdt-bitcoin-mainnet-erc20',
]) {
  assert.equal(
    adapterRegistry.resolveAssetRoute(unknownRoute),
    null,
    `Unknown route must fail closed: ${unknownRoute}`,
  );
}
for (const unknownNetwork of [
  'unknown-network',
  'dogecoin-testnet',
  'bitcoin-testnet',
  'ethereum-sepolia',
]) {
  assert.equal(
    adapterRegistry.resolveWalletNetwork(unknownNetwork),
    null,
    `Unknown network must fail closed: ${unknownNetwork}`,
  );
}

const builtInWalletAdapters = [
  dogecoinMainnetWalletAdapter,
  bitcoinMainnetWalletAdapter,
  ethereumMainnetWalletAdapter,
];
const builtInAssetRouteAdapters = [
  dogecoinMainnetAssetRouteAdapter,
  bitcoinMainnetAssetRouteAdapter,
  ethereumMainnetAssetRouteAdapter,
  usdtEthereumMainnetAssetRouteAdapter,
];
assert.equal(
  new Set(builtInWalletAdapters.map((adapter) => adapter.networkId)).size,
  builtInWalletAdapters.length,
  'Built-in wallet network adapter keys must be unique.',
);
assert.equal(
  new Set(builtInAssetRouteAdapters.map((adapter) => adapter.routeId)).size,
  builtInAssetRouteAdapters.length,
  'Built-in asset route adapter keys must be unique.',
);

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
  walletNetworkAdapters: [
    dogecoinMainnetWalletAdapter,
    bitcoinMainnetWalletAdapter,
    ethereumMainnetWalletAdapter,
  ],
  assetRouteAdapters: [
    dogecoinMainnetAssetRouteAdapter,
    bitcoinMainnetAssetRouteAdapter,
    ethereumMainnetAssetRouteAdapter,
    usdtEthereumMainnetAssetRouteAdapter,
  ],
});
assert.strictEqual(
  independentRegistry.resolveAssetRoute('doge-dogecoin-mainnet-native'),
  dogecoinMainnetAssetRouteAdapter,
);
assert.strictEqual(
  independentRegistry.resolveAssetRoute('btc-bitcoin-mainnet-native'),
  bitcoinMainnetAssetRouteAdapter,
);
assert.strictEqual(
  independentRegistry.resolveAssetRoute('eth-ethereum-mainnet-native'),
  ethereumMainnetAssetRouteAdapter,
);
assert.strictEqual(
  independentRegistry.resolveAssetRoute('usdt-ethereum-mainnet-erc20'),
  usdtEthereumMainnetAssetRouteAdapter,
);
assert.equal(independentRegistry.resolveAssetRoute('usdt-tron-mainnet-trc20'), null);
assert.equal(independentRegistry.resolveAssetRoute('unknown-route'), null);

let sessions = createWalletSessions();
sessions = withWalletSession(sessions, 'dogecoin-mainnet', {
  address: 'D-dogecoin-session',
  mode: 'watch-only',
});
sessions = withWalletSession(sessions, 'bitcoin-mainnet', {
  address: '1-bitcoin-session',
  mode: 'created',
});
sessions = withWalletSession(sessions, 'ethereum-mainnet', {
  address: '0x1111111111111111111111111111111111111111',
  mode: 'created',
});

assert.equal(getWalletSession(sessions, 'dogecoin-mainnet').address, 'D-dogecoin-session');
assert.equal(getWalletSession(sessions, 'bitcoin-mainnet').address, '1-bitcoin-session');
assert.equal(
  getWalletSession(sessions, 'ethereum-mainnet').address,
  '0x1111111111111111111111111111111111111111',
);
assert.equal('balance' in getWalletSession(sessions, 'dogecoin-mainnet'), false);
assert.equal('balance' in getWalletSession(sessions, 'ethereum-mainnet'), false);

let balances = createAssetRouteBalances();
balances = withAssetRouteBalance(balances, 'doge-dogecoin-mainnet-native', {
  address: 'D-dogecoin-session',
  balance: '12.00000000',
  status: 'loaded',
});
balances = withAssetRouteBalance(balances, 'eth-ethereum-mainnet-native', {
  address: '0xshared',
  balance: '1.25',
  status: 'loaded',
});
balances = withAssetRouteBalance(balances, 'usdt-ethereum-mainnet-erc20', {
  address: '0xshared',
  balance: '500',
  status: 'loaded',
});

assert.equal(getAssetRouteBalance(balances, 'doge-dogecoin-mainnet-native').balance, '12.00000000');
assert.equal(getAssetRouteBalance(balances, 'eth-ethereum-mainnet-native').balance, '1.25');
assert.equal(getAssetRouteBalance(balances, 'usdt-ethereum-mainnet-erc20').balance, '500');

balances = invalidateAssetRouteBalancesForNetwork(balances, 'ethereum-mainnet');
assert.equal(getAssetRouteBalance(balances, 'eth-ethereum-mainnet-native').balance, null);
assert.equal(getAssetRouteBalance(balances, 'usdt-ethereum-mainnet-erc20').balance, null);
assert.equal(getAssetRouteBalance(balances, 'doge-dogecoin-mainnet-native').balance, '12.00000000');

const incompatibleWallet = {
  address: '0x0000000000000000000000000000000000000000',
  mnemonic: 'test only',
  derivationPath: "m/44'/60'/0'/0/0",
  signingMaterial: {
    kind: 'private-key' as const,
    value: '0xdeadbeef',
  },
};
const transferProps = {
  language: 'en' as const,
  assetId: 'doge' as const,
  assetSymbol: 'DOGE',
  networkName: 'Dogecoin',
  networkStandard: 'DOGE mainnet · P2PKH',
  sourceAddress: 'D-test',
  walletMode: 'created' as const,
  createdWallet: incompatibleWallet,
};
assert.throws(
  () => dogecoinMainnetAssetRouteAdapter.renderTransferPanel(transferProps),
  /incompatible_signing_material/,
);
assert.throws(
  () => bitcoinMainnetAssetRouteAdapter.renderTransferPanel({
    ...transferProps,
    assetId: 'btc',
    assetSymbol: 'BTC',
    networkName: 'Bitcoin',
    networkStandard: 'BTC mainnet · P2PKH',
  }),
  /incompatible_signing_material/,
);

const incompatibleEthereumWallet = {
  address: '1BitcoinOnlySigningMaterial',
  mnemonic: 'test only',
  derivationPath: "m/44'/0'/0'/0/0",
  signingMaterial: {
    kind: 'wif' as const,
    value: 'test-only-wif',
  },
};
for (const adapter of [ethereumMainnetAssetRouteAdapter, usdtEthereumMainnetAssetRouteAdapter]) {
  assert.throws(
    () => adapter.renderTransferPanel({
      ...transferProps,
      assetId: adapter.assetId,
      assetSymbol: adapter.assetId === 'eth' ? 'ETH' : 'USDT',
      networkName: 'Ethereum',
      networkStandard: adapter.assetId === 'eth' ? 'Ethereum mainnet · EIP-1559' : 'Ethereum mainnet · ERC-20',
      sourceAddress: '0x0000000000000000000000000000000000000000',
      createdWallet: incompatibleEthereumWallet,
    }),
    /incompatible_signing_material/,
  );
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const srcDirectory = join(process.cwd(), 'src');
const storageWrites: Array<{ file: string; call: string }> = [];
const forbiddenPersistentStorage = [
  { name: 'document.cookie', pattern: /document\s*\.\s*cookie\s*=/ },
  { name: 'IndexedDB', pattern: /indexedDB\s*\.\s*open\s*\(/ },
  { name: 'Cache Storage', pattern: /caches\s*\.\s*open\s*\(/ },
];

for (const file of sourceFiles(srcDirectory)) {
  const source = readFileSync(file, 'utf8');
  const relativeFile = relative(process.cwd(), file);

  assert.equal(
    /sessionStorage\s*\.\s*setItem\s*\(/.test(source),
    false,
    `sessionStorage writes are forbidden in ${relativeFile}`,
  );

  for (const match of source.matchAll(/localStorage\s*\.\s*setItem\s*\(([^\n;]*)\)/g)) {
    storageWrites.push({
      file: relativeFile,
      call: match[0],
    });
  }

  assert.equal(
    /(?:localStorage|sessionStorage)\s*\.\s*setItem\s*\([^\n;]*(?:wif|mnemonic|privateKey|private-key|signingMaterial|seed)/i.test(source),
    false,
    `wallet secret persistence is forbidden in ${relativeFile}`,
  );

  for (const storage of forbiddenPersistentStorage) {
    assert.equal(
      storage.pattern.test(source),
      false,
      `${storage.name} persistence is forbidden in ${relativeFile}; wallet secrets must remain in browser memory.`,
    );
  }
}

assert.deepEqual(storageWrites, [{
  file: 'src/App.tsx',
  call: 'localStorage.setItem(LANGUAGE_KEY, language)',
}]);

console.log('Frontend wallet adapter registry invariant tests passed.');
