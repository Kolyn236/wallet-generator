import { createElement, lazy } from 'react';
import { getEthereumBalance } from '../../api';
import {
  createEthereumWallet,
  isEthereumMainnetAddress,
  type CreatedEthereumWallet,
} from '../../wallet/ethereum';
import type { AssetRouteAdapter } from '../AssetRouteAdapter';
import type { BrowserCreatedWallet, WalletNetworkAdapter } from '../WalletNetworkAdapter';

const EthereumTransferPanel = lazy(async () => {
  const module = await import('../../EthereumTransferPanel');
  return { default: module.EthereumTransferPanel };
});

function toBrowserWallet(): BrowserCreatedWallet {
  const wallet = createEthereumWallet();

  return {
    address: wallet.address,
    mnemonic: wallet.mnemonic,
    derivationPath: wallet.derivationPath,
    signingMaterial: {
      kind: 'private-key',
      value: wallet.privateKey,
    },
  };
}

function toEthereumCreatedWallet(wallet: BrowserCreatedWallet | null): CreatedEthereumWallet | null {
  if (!wallet) return null;
  if (wallet.signingMaterial.kind !== 'private-key') {
    throw new Error('incompatible_signing_material');
  }

  return {
    address: wallet.address,
    mnemonic: wallet.mnemonic,
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
    watchOnly: true,
    localSigning: true,
  },
  createWallet: toBrowserWallet,
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
      walletMode: props.walletMode,
      createdWallet: toEthereumCreatedWallet(props.createdWallet),
    });
  },
};
