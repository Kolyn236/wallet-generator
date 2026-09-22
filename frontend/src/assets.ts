export type ChainFamily = 'utxo' | 'evm' | 'tron';
export type ChainId = 'dogecoin' | 'bitcoin' | 'litecoin' | 'ethereum' | 'tron';
export type NetworkId = 'dogecoin-mainnet' | 'bitcoin-mainnet' | 'litecoin-mainnet' | 'ethereum-mainnet' | 'tron-mainnet';
export type AssetId = 'doge' | 'btc' | 'ltc' | 'eth' | 'usdt';
export type AssetRouteId =
  | 'doge-dogecoin-mainnet-native'
  | 'btc-bitcoin-mainnet-native'
  | 'ltc-litecoin-mainnet-native'
  | 'eth-ethereum-mainnet-native'
  | 'usdt-ethereum-mainnet-erc20'
  | 'usdt-tron-mainnet-trc20';

export type ChainDefinition = { id: ChainId; name: string; family: ChainFamily };
export type NetworkDefinition = { id: NetworkId; chainId: ChainId; name: string };
export type AssetDefinition = { id: AssetId; symbol: string; name: string; mark: string };
export type AssetRouteDefinition = { id: AssetRouteId; assetId: AssetId; networkId: NetworkId; kind: 'native' | 'token'; standard: string };
export type AssetAvailability = 'ready-next' | 'planned';
export type AssetRouteAvailability = AssetAvailability;
export type UtxoRatePerKbFeePolicy = { kind: 'utxo-rate-per-kb'; unit: string };
type AssetRouteNetworkView = { id: NetworkId; name: string; standard: string; feePolicy: UtxoRatePerKbFeePolicy | null };
type AssetViewDefinition = AssetDefinition & { networks: AssetRouteNetworkView[] };

export const chains: ChainDefinition[] = [
  { id: 'dogecoin', name: 'Dogecoin', family: 'utxo' },
  { id: 'bitcoin', name: 'Bitcoin', family: 'utxo' },
  { id: 'litecoin', name: 'Litecoin', family: 'utxo' },
  { id: 'ethereum', name: 'Ethereum', family: 'evm' },
  { id: 'tron', name: 'Tron', family: 'tron' },
];

export const networks: NetworkDefinition[] = [
  { id: 'dogecoin-mainnet', chainId: 'dogecoin', name: 'Dogecoin' },
  { id: 'bitcoin-mainnet', chainId: 'bitcoin', name: 'Bitcoin' },
  { id: 'litecoin-mainnet', chainId: 'litecoin', name: 'Litecoin' },
  { id: 'ethereum-mainnet', chainId: 'ethereum', name: 'Ethereum' },
  { id: 'tron-mainnet', chainId: 'tron', name: 'TRON' },
];

export const assets: AssetDefinition[] = [
  { id: 'doge', symbol: 'DOGE', name: 'Dogecoin', mark: 'Ð' },
  { id: 'btc', symbol: 'BTC', name: 'Bitcoin', mark: '₿' },
  { id: 'ltc', symbol: 'LTC', name: 'Litecoin', mark: 'Ł' },
  { id: 'eth', symbol: 'ETH', name: 'Ethereum', mark: 'Ξ' },
  { id: 'usdt', symbol: 'USDT', name: 'Tether', mark: '₮' },
];

export const assetRoutes: AssetRouteDefinition[] = [
  { id: 'doge-dogecoin-mainnet-native', assetId: 'doge', networkId: 'dogecoin-mainnet', kind: 'native', standard: 'DOGE mainnet · P2PKH' },
  { id: 'btc-bitcoin-mainnet-native', assetId: 'btc', networkId: 'bitcoin-mainnet', kind: 'native', standard: 'BTC mainnet · P2PKH' },
  { id: 'ltc-litecoin-mainnet-native', assetId: 'ltc', networkId: 'litecoin-mainnet', kind: 'native', standard: 'LTC mainnet · P2PKH' },
  { id: 'eth-ethereum-mainnet-native', assetId: 'eth', networkId: 'ethereum-mainnet', kind: 'native', standard: 'Ethereum mainnet · EIP-1559' },
  { id: 'usdt-ethereum-mainnet-erc20', assetId: 'usdt', networkId: 'ethereum-mainnet', kind: 'token', standard: 'Ethereum mainnet · ERC-20' },
  { id: 'usdt-tron-mainnet-trc20', assetId: 'usdt', networkId: 'tron-mainnet', kind: 'token', standard: 'TRC-20' },
];

const routeAvailability: Record<AssetRouteId, AssetRouteAvailability> = {
  'doge-dogecoin-mainnet-native': 'ready-next',
  'btc-bitcoin-mainnet-native': 'ready-next',
  'ltc-litecoin-mainnet-native': 'ready-next',
  'eth-ethereum-mainnet-native': 'ready-next',
  'usdt-ethereum-mainnet-erc20': 'ready-next',
  'usdt-tron-mainnet-trc20': 'ready-next',
};

const utxoFeePolicies: Partial<Record<NetworkId, UtxoRatePerKbFeePolicy>> = {
  'dogecoin-mainnet': { kind: 'utxo-rate-per-kb', unit: 'DOGE/kB' },
  'bitcoin-mainnet': { kind: 'utxo-rate-per-kb', unit: 'BTC/kB' },
  'litecoin-mainnet': { kind: 'utxo-rate-per-kb', unit: 'LTC/kB' },
};

function findAsset(assetId: AssetId): AssetDefinition {
  const asset = assets.find((candidate) => candidate.id === assetId);
  if (!asset) throw new Error(`Unknown asset: ${assetId}`);
  return asset;
}
export function getNetwork(networkId: NetworkId): NetworkDefinition { const network = networks.find((candidate) => candidate.id === networkId); if (!network) throw new Error(`Unknown network: ${networkId}`); return network; }
export function getAssetRoute(routeId: AssetRouteId): AssetRouteDefinition { const route = assetRoutes.find((candidate) => candidate.id === routeId); if (!route) throw new Error(`Unknown asset route: ${routeId}`); return route; }
export function getAssetRoutes(assetId: AssetId): AssetRouteDefinition[] { return assetRoutes.filter((candidate) => candidate.assetId === assetId); }
export function getAssetRouteAvailability(routeId: AssetRouteId): AssetRouteAvailability { return routeAvailability[routeId]; }
export function getDefaultAssetRoute(assetId: AssetId): AssetRouteDefinition { const routes = getAssetRoutes(assetId); const liveRoute = routes.find((route) => getAssetRouteAvailability(route.id) === 'ready-next'); const route = liveRoute ?? routes[0]; if (!route) throw new Error(`No asset route configured for: ${assetId}`); return route; }
export function getAssetAvailability(assetId: AssetId): AssetAvailability { return getAssetRoutes(assetId).some((route) => getAssetRouteAvailability(route.id) === 'ready-next') ? 'ready-next' : 'planned'; }
export function getAsset(assetId: AssetId): AssetViewDefinition {
  const asset = findAsset(assetId);
  return { ...asset, networks: getAssetRoutes(assetId).map((route) => { const network = getNetwork(route.networkId); return { id: network.id, name: network.name, standard: route.standard, feePolicy: utxoFeePolicies[network.id] ?? null }; }) };
}
