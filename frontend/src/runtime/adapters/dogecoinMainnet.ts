import { createElement, lazy } from 'react';
import { getDogecoinBalance } from '../../api';
import {
  createDogecoinWallet,
  deriveDogecoinWalletFromMnemonic,
  isDogecoinMainnetAddress,
  type CreatedDogecoinWallet,
} from '../../wallet/dogecoin';
import type { AssetRouteAdapter } from '../AssetRouteAdapter';
import type { BrowserSigningWallet, WalletNetworkAdapter } from '../WalletNetworkAdapter';

const DogecoinTransferPanel = lazy(async () => {
  const module = await import('../../DogecoinTransferPanel');
  return { default: module.DogecoinTransferPanel };
});

function toBrowserWallet(wallet: CreatedDogecoinWallet, origin: 'generated' | 'mnemonic'): BrowserSigningWallet {
  const base = {
    address: wallet.address,
    derivationPath: wallet.derivationPath,
    signingMaterial: {
      kind: 'wif' as const,
      value: wallet.wif,
    },
  };

  return origin === 'generated'
    ? { ...base, origin, generatedMnemonic: wallet.mnemonic }
    : { ...base, origin };
}

function createBrowserWallet(): BrowserSigningWallet {
  return toBrowserWallet(createDogecoinWallet(), 'generated');
}

function importBrowserMnemonic(mnemonic: string): BrowserSigningWallet {
  return toBrowserWallet(deriveDogecoinWalletFromMnemonic(mnemonic), 'mnemonic');
}

function toDogecoinCreatedWallet(wallet: BrowserSigningWallet | null): CreatedDogecoinWallet | null {
  if (!wallet) return null;
  if (wallet.signingMaterial.kind !== 'wif') {
    throw new Error('incompatible_signing_material');
  }

  return {
    address: wallet.address,
    mnemonic: wallet.origin === 'generated' ? wallet.generatedMnemonic : '',
    derivationPath: wallet.derivationPath,
    wif: wallet.signingMaterial.value,
  };
}

export const dogecoinMainnetWalletAdapter: WalletNetworkAdapter = {
  networkId: 'dogecoin-mainnet',
  identity: {
    addressType: 'legacy P2PKH',
    derivationPath: "m/44'/3'/0'/0/0",
  },
  capabilities: {
    localWalletCreation: true,
    mnemonicImport: true,
    watchOnly: true,
    localSigning: true,
  },
  createWallet: createBrowserWallet,
  importMnemonic: importBrowserMnemonic,
  validatePublicAddress: isDogecoinMainnetAddress,
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
  async loadBalance(address, signal) {
    const result = await getDogecoinBalance(address, signal);
    return { address: result.address, balance: result.balance };
  },
  renderTransferPanel(props) {
    return createElement(DogecoinTransferPanel, {
      language: props.language,
      assetId: 'doge',
      assetSymbol: props.assetSymbol,
      networkName: props.networkName,
      networkStandard: props.networkStandard,
      sourceAddress: props.sourceAddress,
      walletMode: props.walletMode === 'local-signing' ? 'created' : props.walletMode,
      createdWallet: toDogecoinCreatedWallet(props.createdWallet),
    });
  },
};
