import type { NetworkId } from '../assets';

export type WalletMode = 'none' | 'created' | 'watch-only';

export type BrowserSigningMaterial =
  | {
      kind: 'wif';
      value: string;
    }
  | {
      kind: 'private-key';
      value: string;
    };

export type BrowserCreatedWallet = {
  address: string;
  mnemonic: string;
  derivationPath: string;
  signingMaterial: BrowserSigningMaterial;
};

export type WalletSession = {
  address: string;
  mode: WalletMode;
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
}
