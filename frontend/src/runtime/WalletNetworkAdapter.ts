import type { NetworkId } from '../assets';

export type WalletMode = 'none' | 'created' | 'watch-only';

export type BrowserCreatedWallet = {
  address: string;
  mnemonic: string;
  wif: string;
  derivationPath: string;
};

export type WalletSession = {
  address: string;
  balance: string | null;
  mode: WalletMode;
};

export type WalletBalance = {
  address: string;
  balance: string;
};

export type WalletIdentityMetadata = {
  addressType: string;
  derivationPath: string;
};

export type WalletNetworkCapabilities = {
  localWalletCreation: boolean;
  watchOnly: boolean;
  localSigning: boolean;
};

export interface WalletNetworkAdapter {
  networkId: NetworkId;
  identity: WalletIdentityMetadata;
  capabilities: WalletNetworkCapabilities;
  createWallet(): BrowserCreatedWallet;
  validatePublicAddress(address: string): boolean;
  loadBalance(address: string, signal?: AbortSignal): Promise<WalletBalance>;
}
