import { createElement, lazy } from 'react';
import { getEthereumBalance } from '../../api';
import { getUsdtErc20Balance } from '../../usdtApi';
import {
  createEthereumWallet,
  deriveEthereumWalletFromMnemonic,
  isEthereumMainnetAddress,
  type CreatedEthereumWallet,
} from '../../wallet/ethereum';
import type { AssetRouteAdapter } from '../AssetRouteAdapter';
import type { BrowserSigningWallet, WalletNetworkAdapter } from '../WalletNetworkAdapter';

const EthereumTransferPanel = lazy(async () => {
  const module = await import('../../EthereumTransferPanel');
  return { default: module.EthereumTransferPanel };
});

const UsdtErc20TransferPanel = lazy(async () => {
  const module = await import('../../UsdtErc20TransferPanel');
  return { default: module.UsdtErc20TransferPanel };
});

function toBrowserWallet(wallet: CreatedEthereumWallet, origin: 'generated' | 'mnemonic'): BrowserSigningWallet {
  const base = {
    address: wallet.address,
    derivationPath: wallet.derivationPath,
    signingMaterial: {
      kind: 'private-key' as const,
      value: wallet.privateKey,
    },
  };

  return origin === 'generated'
    ? { ...base, origin, generatedMnemonic: wallet.mnemonic }
    : { ...base, origin };
}

function createBrowserWallet(): BrowserSigningWallet {
  return toBrowserWallet(createEthereumWallet(), 'generated');
}

function importBrowserMnemonic(mnemonic: string): BrowserSigningWallet {
  return toBrowserWallet(deriveEthereumWalletFromMnemonic(mnemonic), 'mnemonic');
}

function toEthereumCreatedWallet(wallet: BrowserSigningWallet | null): CreatedEthereumWallet | null {
  if (!wallet) return null;
  if (wallet.signingMaterial.kind !== 'private-key') {
    throw new Error('incompatible_signing_material');
  }

  return {
    address: wallet.address,
    mnemonic: wallet.origin === 'generated' ? wallet.generatedMnemonic : '',
    derivationPath: wallet.derivationPath,
    privateKey: wallet.signingMaterial.value,
  };
}

export const ethereumMainnetWalletAdapter: WalletNetworkAdapter = {
  networkId: 'ethereum-mainnet',
  identity: {
    addressType: 'EVM account',
    derivationPath: "m/44'/60'/0'/0/0",
  },
  capabilities: {
    localWalletCreation: true,
    mnemonicImport: true,
    watchOnly: true,
    localSigning: true,
  },
  createWallet: createBrowserWallet,
  importMnemonic: importBrowserMnemonic,
  validatePublicAddress: isEthereumMainnetAddress,
};

export const ethereumMainnetAssetRouteAdapter: AssetRouteAdapter = {
  routeId: 'eth-ethereum-mainnet-native',
  assetId: 'eth',
  networkId: 'ethereum-mainnet',
  capabilities: {
    balance: true,
    transfer: true,
    localSigning: true,
  },
  async loadBalance(address, signal) {
    const result = await getEthereumBalance(address, signal);
    return { address: result.address, balance: result.balance };
  },
  renderTransferPanel(props) {
    return createElement(EthereumTransferPanel, {
      language: props.language,
      networkName: props.networkName,
      networkStandard: props.networkStandard,
      sourceAddress: props.sourceAddress,
      walletMode: props.walletMode === 'local-signing' ? 'created' : props.walletMode,
      createdWallet: toEthereumCreatedWallet(props.createdWallet),
    });
  },
};

export const usdtEthereumMainnetAssetRouteAdapter: AssetRouteAdapter = {
  routeId: 'usdt-ethereum-mainnet-erc20',
  assetId: 'usdt',
  networkId: 'ethereum-mainnet',
  capabilities: {
    balance: true,
    transfer: true,
    localSigning: true,
  },
  async loadBalance(address, signal) {
    const result = await getUsdtErc20Balance(address, signal);
    return { address: result.address, balance: result.balance };
  },
  renderTransferPanel(props) {
    return createElement(UsdtErc20TransferPanel, {
      language: props.language,
      networkName: props.networkName,
      networkStandard: props.networkStandard,
      sourceAddress: props.sourceAddress,
      walletMode: props.walletMode === 'local-signing' ? 'created' : props.walletMode,
      createdWallet: toEthereumCreatedWallet(props.createdWallet),
    });
  },
};
