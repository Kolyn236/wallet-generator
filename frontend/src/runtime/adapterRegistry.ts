import { getAssetRoute, type AssetRouteId, type NetworkId } from '../assets';
import type { AssetRouteAdapter } from './AssetRouteAdapter';
import { bitcoinMainnetAssetRouteAdapter, bitcoinMainnetWalletAdapter } from './adapters/bitcoinMainnet';
import { dogecoinMainnetAssetRouteAdapter, dogecoinMainnetWalletAdapter } from './adapters/dogecoinMainnet';
import { ethereumMainnetAssetRouteAdapter, ethereumMainnetWalletAdapter, usdtEthereumMainnetAssetRouteAdapter } from './adapters/ethereumMainnet';
import { litecoinMainnetAssetRouteAdapter, litecoinMainnetWalletAdapter } from './adapters/litecoinMainnet';
import type { WalletNetworkAdapter } from './WalletNetworkAdapter';

export type AdapterRegistryOptions = { walletNetworkAdapters?: WalletNetworkAdapter[]; assetRouteAdapters?: AssetRouteAdapter[] };

export class AdapterRegistry {
  private readonly walletNetworkAdapters = new Map<NetworkId, WalletNetworkAdapter>();
  private readonly assetRouteAdapters = new Map<AssetRouteId, AssetRouteAdapter>();
  constructor(options: AdapterRegistryOptions = {}) {
    for (const adapter of options.walletNetworkAdapters ?? []) this.registerWalletNetwork(adapter);
    for (const adapter of options.assetRouteAdapters ?? []) this.registerAssetRoute(adapter);
  }
  registerWalletNetwork(adapter: WalletNetworkAdapter): void {
    if (this.walletNetworkAdapters.has(adapter.networkId)) throw new Error(`Duplicate wallet network adapter: ${adapter.networkId}`);
    this.walletNetworkAdapters.set(adapter.networkId, adapter);
  }
  registerAssetRoute(adapter: AssetRouteAdapter): void {
    if (this.assetRouteAdapters.has(adapter.routeId)) throw new Error(`Duplicate asset route adapter: ${adapter.routeId}`);
    const route = getAssetRoute(adapter.routeId);
    if (route.assetId !== adapter.assetId || route.networkId !== adapter.networkId) throw new Error(`Asset route adapter does not match catalog route: ${adapter.routeId}`);
    if (!this.walletNetworkAdapters.has(adapter.networkId)) throw new Error(`Asset route adapter has no wallet network adapter: ${adapter.routeId}`);
    this.assetRouteAdapters.set(adapter.routeId, adapter);
  }
  resolveWalletNetwork(networkId: string): WalletNetworkAdapter | null { return this.walletNetworkAdapters.get(networkId as NetworkId) ?? null; }
  resolveAssetRoute(routeId: string): AssetRouteAdapter | null { return this.assetRouteAdapters.get(routeId as AssetRouteId) ?? null; }
}

export function createAdapterRegistry(options: AdapterRegistryOptions = {}): AdapterRegistry { return new AdapterRegistry(options); }

export const adapterRegistry = createAdapterRegistry({
  walletNetworkAdapters: [dogecoinMainnetWalletAdapter, bitcoinMainnetWalletAdapter, litecoinMainnetWalletAdapter, ethereumMainnetWalletAdapter],
  assetRouteAdapters: [dogecoinMainnetAssetRouteAdapter, bitcoinMainnetAssetRouteAdapter, litecoinMainnetAssetRouteAdapter, ethereumMainnetAssetRouteAdapter, usdtEthereumMainnetAssetRouteAdapter],
});
