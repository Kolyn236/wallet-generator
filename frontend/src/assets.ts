export type AssetId = 'doge' | 'btc' | 'eth' | 'usdt';

export type UtxoRatePerKbFeePolicy = {
  kind: 'utxo-rate-per-kb';
  unit: string;
};

export type NetworkFeePolicy = UtxoRatePerKbFeePolicy;

export type NetworkDefinition = {
  id: string;
  name: string;
  standard: string;
  feePolicy: NetworkFeePolicy | null;
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
    networks: [
      {
        id: 'dogecoin-mainnet',
        name: 'Dogecoin',
        standard: 'DOGE mainnet · P2PKH',
        feePolicy: {
          kind: 'utxo-rate-per-kb',
          unit: 'DOGE/kB',
        },
      },
    ],
  },
  {
    id: 'btc',
    symbol: 'BTC',
    name: 'Bitcoin',
    mark: '₿',
    status: 'ready-next',
    networks: [
      {
        id: 'bitcoin-mainnet',
        name: 'Bitcoin',
        standard: 'BTC mainnet · P2PKH',
        feePolicy: {
          kind: 'utxo-rate-per-kb',
          unit: 'BTC/kB',
        },
      },
    ],
  },
  {
    id: 'eth',
    symbol: 'ETH',
    name: 'Ethereum',
    mark: 'Ξ',
    status: 'planned',
    networks: [
      {
        id: 'ethereum-mainnet',
        name: 'Ethereum',
        standard: 'EVM mainnet',
        feePolicy: null,
      },
    ],
  },
  {
    id: 'usdt',
    symbol: 'USDT',
    name: 'Tether',
    mark: '₮',
    status: 'planned',
    networks: [
      {
        id: 'usdt-erc20',
        name: 'Ethereum',
        standard: 'ERC-20',
        feePolicy: null,
      },
      {
        id: 'usdt-trc20',
        name: 'TRON',
        standard: 'TRC-20',
        feePolicy: null,
      },
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
