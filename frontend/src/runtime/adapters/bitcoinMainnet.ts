import { createElement, lazy } from 'react';
import { getBitcoinBalance } from '../../api';
import {
  createBitcoinWallet,
  deriveBitcoinWalletFromMnemonic,
  isBitcoinMainnetAddress,
  type CreatedBitcoinWallet,
} from '../../wallet/bitcoin';
import type { AssetRouteAdapter } from '../AssetRouteAdapter';
import type { BrowserSigningWallet, WalletNetworkAdapter } from '../WalletNetworkAdapter';

const BitcoinTransferPanel = lazy(async () => {
  const module = await import('../../BitcoinTransferPanel');
  return { default: module.BitcoinTransferPanel };
});

function toBrowserWallet(wallet: CreatedBitcoinWallet, origin: 'generated' | 'mnemonic'): BrowserSigningWallet {
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
  return toBrowserWallet(createBitcoinWallet(), 'generated');
}

function importBrowserMnemonic(mnemonic: string): BrowserSigningWallet {
  return toBrowserWallet(deriveBitcoinWalletFromMnemonic(mnemonic), 'mnemonic');
}

function toBitcoinCreatedWallet(wallet: BrowserSigningWallet | null): CreatedBitcoinWallet | null {
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

export const bitcoinMainnetWalletAdapter: WalletNetworkAdapter = {
  networkId: 'bitcoin-mainnet',
  identity: {
    addressType: 'legacy P2PKH',
    derivationPath: "m/44'/0'/0'/0/0",
  },
  capabilities: {
    localWalletCreation: true,
    mnemonicImport: true,
    watchOnly: true,
    localSigning: true,
  },
  createWallet: createBrowserWallet,
  importMnemonic: importBrowserMnemonic,
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
      walletMode: props.walletMode === 'local-signing' ? 'created' : props.walletMode,
      createdWallet: toBitcoinCreatedWallet(props.createdWallet),
    });
  },
};
