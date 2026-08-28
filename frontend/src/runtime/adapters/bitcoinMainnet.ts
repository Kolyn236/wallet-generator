import { createElement, lazy } from 'react';
import { getBitcoinBalance } from '../../api';
import { createBitcoinWallet, isBitcoinMainnetAddress } from '../../wallet/bitcoin';
import type { AssetRouteAdapter } from '../AssetRouteAdapter';
import type { WalletNetworkAdapter } from '../WalletNetworkAdapter';

const BitcoinTransferPanel = lazy(async () => {
  const module = await import('../../BitcoinTransferPanel');
  return { default: module.BitcoinTransferPanel };
});

export const bitcoinMainnetWalletAdapter: WalletNetworkAdapter = {
  networkId: 'bitcoin-mainnet',
  identity: {
    addressType: 'legacy P2PKH',
    derivationPath: "m/44'/0'/0'/0/0",
  },
  capabilities: {
    localWalletCreation: true,
    watchOnly: true,
    localSigning: true,
  },
  createWallet: createBitcoinWallet,
  validatePublicAddress: isBitcoinMainnetAddress,
  async loadBalance(address, signal) {
    const result = await getBitcoinBalance(address, signal);
    return { address: result.address, balance: result.balance };
  },
};

export const bitcoinMainnetAssetRouteAdapter: AssetRouteAdapter = {
  routeId: 'btc-bitcoin-mainnet-native',
  assetId: 'btc',
  networkId: 'bitcoin-mainnet',
  capabilities: {
    balance: true,
    transfer: true,
    localSigning: true,
  },
  renderTransferPanel(props) {
    return createElement(BitcoinTransferPanel, {
      language: props.language,
      networkName: props.networkName,
      networkStandard: props.networkStandard,
      sourceAddress: props.sourceAddress,
      walletMode: props.walletMode,
      createdWallet: props.createdWallet,
    });
  },
};
