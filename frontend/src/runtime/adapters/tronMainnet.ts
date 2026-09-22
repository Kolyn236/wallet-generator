import { createElement, lazy } from 'react';
import type { AssetRouteAdapter } from '../AssetRouteAdapter';
import type { BrowserSigningWallet, WalletNetworkAdapter } from '../WalletNetworkAdapter';
import { createTronWallet, deriveTronWallet, decodeTronAddress, TRON_DERIVATION_PATH } from '../../wallet/tron';

const TronTransferPanel = lazy(async () => {
  const module = await import('../../TronTransferPanel');
  return { default: module.TronTransferPanel };
});

const BALANCE_PATH = '/api/chains/tron/mainnet/usdt-trc20/balance';

function toBrowserWallet(wallet: ReturnType<typeof deriveTronWallet>, origin: 'generated' | 'mnemonic'): BrowserSigningWallet {
  const base = { address: wallet.addressBase58, derivationPath: wallet.derivationPath, signingMaterial: { kind: 'private-key' as const, value: Array.from(wallet.privateKey, (byte) => byte.toString(16).padStart(2, '0')).join('') } };
  return origin === 'generated' ? { ...base, origin, generatedMnemonic: '' } : { ...base, origin };
}

function createBrowserWallet(): BrowserSigningWallet {
  const wallet = createTronWallet();
  const base = toBrowserWallet(wallet, 'mnemonic');
  return { address: base.address, derivationPath: base.derivationPath, signingMaterial: base.signingMaterial, origin: 'generated', generatedMnemonic: wallet.mnemonic };
}

function importBrowserMnemonic(mnemonic: string): BrowserSigningWallet {
  return toBrowserWallet(deriveTronWallet(mnemonic, TRON_DERIVATION_PATH), 'mnemonic');
}

export const tronMainnetWalletAdapter: WalletNetworkAdapter = {
  networkId: 'tron-mainnet',
  identity: { addressType: 'TRON Base58Check account', derivationPath: TRON_DERIVATION_PATH },
  capabilities: { localWalletCreation: true, mnemonicImport: true, watchOnly: true, localSigning: true },
  createWallet: createBrowserWallet,
  importMnemonic: importBrowserMnemonic,
  validatePublicAddress(address) { try { decodeTronAddress(address); return true; } catch { return false; } },
};

export const tronMainnetAssetRouteAdapter: AssetRouteAdapter = {
  routeId: 'usdt-tron-mainnet-trc20', assetId: 'usdt', networkId: 'tron-mainnet',
  capabilities: { balance: true, transfer: true, localSigning: true },
  async loadBalance(address, signal) {
    const response = await fetch(BALANCE_PATH, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ address }), cache: 'no-store', signal });
    if (!response.ok) throw new Error(`TRON balance request failed with HTTP ${response.status}`);
    const result = await response.json() as { address: string; balanceBaseUnits: string; decimals: 6; assetRouteId: 'usdt-tron-mainnet-trc20' };
    if (result.assetRouteId !== 'usdt-tron-mainnet-trc20' || result.decimals !== 6 || result.address !== address || !/^\d+$/.test(result.balanceBaseUnits)) throw new Error('invalid_tron_balance_response');
    const whole = result.balanceBaseUnits.slice(0, -6) || '0';
    const fraction = result.balanceBaseUnits.slice(-6).padStart(6, '0');
    return { address: result.address, balance: `${whole}.${fraction}` };
  },
  renderTransferPanel(props) { return createElement(TronTransferPanel, props); },
};
