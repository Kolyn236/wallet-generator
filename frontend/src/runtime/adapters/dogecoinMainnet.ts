import { createElement, lazy } from 'react';
import { getDogecoinBalance } from '../../api';
import { createDogecoinWallet, isDogecoinMainnetAddress } from '../../wallet/dogecoin';
import type { AssetRouteAdapter } from '../AssetRouteAdapter';
import type { WalletNetworkAdapter } from '../WalletNetworkAdapter';

const DogecoinTransferPanel = lazy(async () => {
  const module = await import('../../DogecoinTransferPanel');
  return { default: module.DogecoinTransferPanel };
});

export const dogecoinMainnetWalletAdapter: WalletNetworkAdapter = {
  networkId: 'dogecoin-mainnet',
  identity: {
    addressType: 'legacy P2PKH',
    derivationPath: "m/44'/3'/0'/0/0",
  },
  capabilities: {
    localWalletCreation: true,
    watchOnly: true,
    localSigning: true,
  },
  createWallet: createDogecoinWallet,
  validatePublicAddress: isDogecoinMainnetAddress,
  async loadBalance(address, signal) {
    const result = await getDogecoinBalance(address, signal);
    return { address: result.address, balance: result.balance };
  },
};

export const dogecoinMainnetAssetRouteAdapter: AssetRouteAdapter = {
  routeId: 'doge-dogecoin-mainnet-native',
  assetId: 'doge',
  networkId: 'dogecoin-mainnet',
  capabilities: {
    balance: true,
    transfer: true,
    localSigning: true,
  },
  renderTransferPanel(props) {
    return createElement(DogecoinTransferPanel, {
      language: props.language,
      assetId: 'doge',
      assetSymbol: props.assetSymbol,
      networkName: props.networkName,
      networkStandard: props.networkStandard,
      sourceAddress: props.sourceAddress,
      walletMode: props.walletMode,
      createdWallet: props.createdWallet,
    });
  },
};
