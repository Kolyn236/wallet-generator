import { createElement, lazy } from 'react';
import { getUsdtTrc20Balance } from '../../tronApi';
import { createTronWallet, deriveTronWallet, isTronMainnetAddress, TRON_DERIVATION_PATH, type TronWallet } from '../../wallet/tron';
import type { AssetRouteAdapter } from '../AssetRouteAdapter';
import type { BrowserSigningWallet, WalletNetworkAdapter } from '../WalletNetworkAdapter';

const TronTransferPanel = lazy(async () => ({default: (await import('../../TronTransferPanel')).TronTransferPanel}));
function recoveredWallet(wallet: TronWallet): BrowserSigningWallet {
  return {address: wallet.address, derivationPath: wallet.derivationPath, origin: 'mnemonic', signingMaterial: {kind: 'private-key', value: wallet.privateKey}};
}
export const tronMainnetWalletAdapter: WalletNetworkAdapter = {
  networkId: 'tron-mainnet', identity: {addressType: 'TRON account', derivationPath: TRON_DERIVATION_PATH},
  capabilities: {localWalletCreation: true, mnemonicImport: true, watchOnly: true, localSigning: true},
  createWallet() {
    const wallet = createTronWallet();
    return {...recoveredWallet(wallet), origin: 'generated', generatedMnemonic: wallet.mnemonic};
  },
  importMnemonic(mnemonic) {
    try { return recoveredWallet(deriveTronWallet(mnemonic)); }
    catch (error) {
      if (error instanceof Error && error.message === 'invalid_mnemonic') throw new Error('Invalid BIP39 mnemonic');
      throw error;
    }
  },
  validatePublicAddress: isTronMainnetAddress,
};
export const usdtTronMainnetAssetRouteAdapter: AssetRouteAdapter = {
  routeId: 'usdt-tron-mainnet-trc20', assetId: 'usdt', networkId: 'tron-mainnet',
  capabilities: {balance: true, transfer: true, localSigning: true},
  async loadBalance(address, signal) {
    const result = await getUsdtTrc20Balance(address, signal);
    return {address: result.address, balance: result.balance};
  },
  renderTransferPanel(props) {
    if (props.createdWallet && (props.createdWallet.signingMaterial.kind !== 'private-key'
      || props.createdWallet.derivationPath !== TRON_DERIVATION_PATH
      || !isTronMainnetAddress(props.createdWallet.address))) throw new Error('incompatible_signing_material');
    return createElement(TronTransferPanel, props);
  },
};
