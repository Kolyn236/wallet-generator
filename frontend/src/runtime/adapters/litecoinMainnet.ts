import { createElement, lazy } from 'react';
import { getLitecoinBalance } from '../../api';
import {
  createLitecoinWallet,
  deriveLitecoinWalletFromMnemonic,
  isLitecoinMainnetAddress,
  type CreatedLitecoinWallet,
} from '../../wallet/litecoin';
import type { AssetRouteAdapter } from '../AssetRouteAdapter';
import type { BrowserSigningWallet, WalletNetworkAdapter } from '../WalletNetworkAdapter';

const LitecoinTransferPanel = lazy(async () => {
  const module = await import('../../LitecoinTransferPanel');
  return { default: module.LitecoinTransferPanel };
});

function toBrowserWallet(wallet: CreatedLitecoinWallet, origin: 'generated' | 'mnemonic'): BrowserSigningWallet {
  const base = {
    address: wallet.address,
    derivationPath: wallet.derivationPath,
    signingMaterial: { kind: 'wif' as const, value: wallet.wif },
  };
  return origin === 'generated' ? { ...base, origin, generatedMnemonic: wallet.mnemonic } : { ...base, origin };
}

function toCreatedWallet(wallet: BrowserSigningWallet | null): CreatedLitecoinWallet | null {
  if (!wallet) return null;
  if (wallet.signingMaterial.kind !== 'wif') throw new Error('incompatible_signing_material');
  return {
    address: wallet.address,
    mnemonic: wallet.origin === 'generated' ? wallet.generatedMnemonic : '',
    derivationPath: wallet.derivationPath,
    wif: wallet.signingMaterial.value,
  };
}

export const litecoinMainnetWalletAdapter: WalletNetworkAdapter = {
  networkId: 'litecoin-mainnet',
  identity: { addressType: 'legacy P2PKH', derivationPath: "m/44'/2'/0'/0/0" },
  capabilities: { localWalletCreation: true, mnemonicImport: true, watchOnly: true, localSigning: true },
  createWallet: () => toBrowserWallet(createLitecoinWallet(), 'generated'),
  importMnemonic: (mnemonic) => toBrowserWallet(deriveLitecoinWalletFromMnemonic(mnemonic), 'mnemonic'),
  validatePublicAddress: isLitecoinMainnetAddress,
};

export const litecoinMainnetAssetRouteAdapter: AssetRouteAdapter = {
  routeId: 'ltc-litecoin-mainnet-native',
  assetId: 'ltc',
  networkId: 'litecoin-mainnet',
  capabilities: { balance: true, transfer: true, localSigning: true },
  async loadBalance(address, signal) {
    const result = await getLitecoinBalance(address, signal);
    return { address: result.address, balance: result.balance };
  },
  renderTransferPanel(props) {
    return createElement(LitecoinTransferPanel, {
      language: props.language,
      networkName: props.networkName,
      networkStandard: props.networkStandard,
      sourceAddress: props.sourceAddress,
      walletMode: props.walletMode === 'local-signing' ? 'created' : props.walletMode,
      createdWallet: toCreatedWallet(props.createdWallet),
    });
  },
};
