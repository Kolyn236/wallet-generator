import { createElement, lazy } from 'react';
import { getBitcoinBalance } from '../../api';
import { createBitcoinWallet, isBitcoinMainnetAddress } from '../../wallet/bitcoin';
import type { AssetRouteAdapter } from '../AssetRouteAdapter';
import type { BrowserCreatedWallet, WalletNetworkAdapter } from '../WalletNetworkAdapter';

const BitcoinTransferPanel = lazy(async () => {
  const module = await import('../../BitcoinTransferPanel');
  return { default: module.BitcoinTransferPanel };
});

function toBrowserWallet(): BrowserCreatedWallet {
  const wallet = createBitcoinWallet();

  return {
    address: wallet.address,
    mnemonic: wallet.mnemonic,
    derivationPath: wallet.derivationPath,
    signingMaterial: {
      kind: 'wif',
      value: wallet.wif,
    },
  };
}

function toBitcoinCreatedWallet(wallet: BrowserCreatedWallet | null) {
  if (!wallet) return null;
  if (wallet.signingMaterial.kind !== 'wif') {
    throw new Error('incompatible_signing_material');
  }

  return {
    address: wallet.address,
    mnemonic: wallet.mnemonic,
    derivationPath: wallet.derivationPath,
    wif: wallet.signingMaterial.value,
  };
}

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
  createWallet: toBrowserWallet,
  validatePublicAddress: isBitcoinMainnetAddress,
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
  async loadBalance(address, signal) {
    const result = await getBitcoinBalance(address, signal);
    return { address: result.address, balance: result.balance };
  },
  renderTransferPanel(props) {
    return createElement(BitcoinTransferPanel, {
      language: props.language,
      networkName: props.networkName,
      networkStandard: props.networkStandard,
      sourceAddress: props.sourceAddress,
      walletMode: props.walletMode,
      createdWallet: toBitcoinCreatedWallet(props.createdWallet),
    });
  },
};
