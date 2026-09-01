import { assetRoutes, type AssetRouteId, type NetworkId } from '../assets';

export type AssetRouteBalanceStatus = 'idle' | 'loading' | 'loaded' | 'error';

export type AssetRouteBalanceState = {
  address: string;
  balance: string | null;
  status: AssetRouteBalanceStatus;
};

export type AssetRouteBalances = Partial<Record<AssetRouteId, AssetRouteBalanceState>>;

const EMPTY_ASSET_ROUTE_BALANCE: AssetRouteBalanceState = {
  address: '',
  balance: null,
  status: 'idle',
};

export function createAssetRouteBalances(): AssetRouteBalances {
  return {};
}

export function getAssetRouteBalance(
  balances: AssetRouteBalances,
  routeId: AssetRouteId,
): AssetRouteBalanceState {
  return balances[routeId] ?? { ...EMPTY_ASSET_ROUTE_BALANCE };
}

export function withAssetRouteBalance(
  balances: AssetRouteBalances,
  routeId: AssetRouteId,
  state: AssetRouteBalanceState,
): AssetRouteBalances {
  return {
    ...balances,
    [routeId]: state,
  };
}

export function invalidateAssetRouteBalancesForNetwork(
  balances: AssetRouteBalances,
  networkId: NetworkId,
): AssetRouteBalances {
  const next = { ...balances };

  for (const route of assetRoutes) {
    if (route.networkId === networkId) {
      delete next[route.id];
    }
  }

  return next;
}
