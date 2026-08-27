export type AssetId = 'doge' | 'btc' | 'eth' | 'usdt';

export type NetworkDefinition = {
  id: string;
  name: string;
  standard: string;
};

export type AssetDefinition = {
  id: AssetId;
  symbol: string;
  name: string;
  mark: string;
  status: 'ready-next' | 'planned';
  networks: NetworkDefinition[];
};

export const assets: AssetDefinition[] = [
  {
    id: 'doge',
    symbol: 'DOGE',
    name: 'Dogecoin',
    mark: 'Ð',
    status: 'ready-next',
    networks: [{ id: 'dogecoin-mainnet', name: 'Dogecoin', standard: 'DOGE mainnet' }],
  },
  {
    id: 'btc',
    symbol: 'BTC',
    name: 'Bitcoin',
    mark: '₿',
    status: 'planned',
    networks: [{ id: 'bitcoin-mainnet', name: 'Bitcoin', standard: 'BTC mainnet' }],
  },
  {
    id: 'eth',
    symbol: 'ETH',
    name: 'Ethereum',
    mark: 'Ξ',
    status: 'planned',
    networks: [{ id: 'ethereum-mainnet', name: 'Ethereum', standard: 'EVM mainnet' }],
  },
  {
    id: 'usdt',
    symbol: 'USDT',
    name: 'Tether',
    mark: '₮',
    status: 'planned',
    networks: [
      { id: 'usdt-erc20', name: 'Ethereum', standard: 'ERC-20' },
      { id: 'usdt-trc20', name: 'TRON', standard: 'TRC-20' },
    ],
  },
];

export function getAsset(assetId: AssetId): AssetDefinition {
  const asset = assets.find((candidate) => candidate.id === assetId);

  if (!asset) {
    throw new Error(`Unknown asset: ${assetId}`);
  }

  return asset;
}
