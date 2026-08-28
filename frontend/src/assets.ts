export type ChainFamily = 'utxo' | 'evm' | 'tron';
export type ChainId = 'dogecoin' | 'bitcoin' | 'ethereum' | 'tron';
export type NetworkId = 'dogecoin-mainnet' | 'bitcoin-mainnet' | 'ethereum-mainnet' | 'tron-mainnet';
export type AssetId = 'doge' | 'btc' | 'eth' | 'usdt';
export type AssetRouteId =
  | 'doge-dogecoin-mainnet-native'
  | 'btc-bitcoin-mainnet-native'
  | 'eth-ethereum-mainnet-native'
  | 'usdt-ethereum-mainnet-erc20'
  | 'usdt-tron-mainnet-trc20';

export type ChainDefinition = {
  id: ChainId;
  name: string;
  family: ChainFamily;
};

export type NetworkDefinition = {
  id: NetworkId;
  chainId: ChainId;
  name: string;
};

export type AssetDefinition = {
  id: AssetId;
  symbol: string;
  name: string;
  mark: string;
};

export type AssetRouteDefinition = {
  id: AssetRouteId;
  assetId: AssetId;
  networkId: NetworkId;
  kind: 'native' | 'token';
  standard: string;
};

export type AssetAvailability = 'ready-next' | 'planned';

export const chains: ChainDefinition[] = [
  { id: 'dogecoin', name: 'Dogecoin', family: 'utxo' },
  { id: 'bitcoin', name: 'Bitcoin', family: 'utxo' },
  { id: 'ethereum', name: 'Ethereum', family: 'evm' },
  { id: 'tron', name: 'Tron', family: 'tron' },
];

export const networks: NetworkDefinition[] = [
  { id: 'dogecoin-mainnet', chainId: 'dogecoin', name: 'Dogecoin' },
  { id: 'bitcoin-mainnet', chainId: 'bitcoin', name: 'Bitcoin' },
  { id: 'ethereum-mainnet', chainId: 'ethereum', name: 'Ethereum' },
  { id: 'tron-mainnet', chainId: 'tron', name: 'TRON' },
];

export const assets: AssetDefinition[] = [
  { id: 'doge', symbol: 'DOGE', name: 'Dogecoin', mark: 'Ð' },
  { id: 'btc', symbol: 'BTC', name: 'Bitcoin', mark: '₿' },
  { id: 'eth', symbol: 'ETH', name: 'Ethereum', mark: 'Ξ' },
  { id: 'usdt', symbol: 'USDT', name: 'Tether', mark: '₮' },
];

export const assetRoutes: AssetRouteDefinition[] = [
  {
    id: 'doge-dogecoin-mainnet-native',
    assetId: 'doge',
    networkId: 'dogecoin-mainnet',
    kind: 'native',
    standard: 'DOGE mainnet · P2PKH',
  },
  {
    id: 'btc-bitcoin-mainnet-native',
    assetId: 'btc',
    networkId: 'bitcoin-mainnet',
    kind: 'native',
    standard: 'BTC mainnet · P2PKH',
  },
  {
    id: 'eth-ethereum-mainnet-native',
    assetId: 'eth',
    networkId: 'ethereum-mainnet',
    kind: 'native',
    standard: 'EVM mainnet',
  },
  {
    id: 'usdt-ethereum-mainnet-erc20',
    assetId: 'usdt',
    networkId: 'ethereum-mainnet',
    kind: 'token',
    standard: 'ERC-20',
  },
  {
    id: 'usdt-tron-mainnet-trc20',
    assetId: 'usdt',
    networkId: 'tron-mainnet',
    kind: 'token',
    standard: 'TRC-20',
  },
];

const assetAvailability: Record<AssetId, AssetAvailability> = {
  doge: 'ready-next',
  btc: 'ready-next',
  eth: 'planned',
  usdt: 'planned',
};

export function getAsset(assetId: AssetId): AssetDefinition {
  const asset = assets.find((candidate) => candidate.id === assetId);

  if (!asset) {
    throw new Error(`Unknown asset: ${assetId}`);
  }

  return asset;
}

export function getNetwork(networkId: NetworkId): NetworkDefinition {
  const network = networks.find((candidate) => candidate.id === networkId);

  if (!network) {
    throw new Error(`Unknown network: ${networkId}`);
  }

  return network;
}

export function getAssetRoute(routeId: AssetRouteId): AssetRouteDefinition {
  const route = assetRoutes.find((candidate) => candidate.id === routeId);

  if (!route) {
    throw new Error(`Unknown asset route: ${routeId}`);
  }

  return route;
}

export function getAssetRoutes(assetId: AssetId): AssetRouteDefinition[] {
  return assetRoutes.filter((candidate) => candidate.assetId === assetId);
}

export function getDefaultAssetRoute(assetId: AssetId): AssetRouteDefinition {
  const route = getAssetRoutes(assetId)[0];

  if (!route) {
    throw new Error(`No asset route configured for: ${assetId}`);
  }

  return route;
}

export function getAssetAvailability(assetId: AssetId): AssetAvailability {
  return assetAvailability[assetId];
}
