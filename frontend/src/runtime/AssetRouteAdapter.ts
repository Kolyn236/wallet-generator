import type { ReactNode } from 'react';
import type { AssetId, AssetRouteId, NetworkId } from '../assets';
import type { Language } from '../i18n';
import type { BrowserCreatedWallet, WalletMode } from './WalletNetworkAdapter';

export type AssetRouteCapabilities = {
  balance: boolean;
  transfer: boolean;
  localSigning: boolean;
};

export type AssetRouteBalance = {
  address: string;
  balance: string;
};

export type AssetRouteTransferPanelProps = {
  language: Language;
  assetId: AssetId;
  assetSymbol: string;
  networkName: string;
  networkStandard: string;
  sourceAddress: string;
  walletMode: WalletMode;
  createdWallet: BrowserCreatedWallet | null;
};

export interface AssetRouteAdapter {
  routeId: AssetRouteId;
  assetId: AssetId;
  networkId: NetworkId;
  capabilities: AssetRouteCapabilities;
  loadBalance(address: string, signal?: AbortSignal): Promise<AssetRouteBalance>;
  renderTransferPanel(props: AssetRouteTransferPanelProps): ReactNode;
}
