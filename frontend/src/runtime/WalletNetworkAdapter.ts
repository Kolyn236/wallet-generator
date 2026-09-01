import type { NetworkId } from '../assets';

export type WalletMode = 'none' | 'local-signing' | 'watch-only';

export type BrowserSigningMaterial =
  | {
      kind: 'wif';
      value: string;
    }
  | {
      kind: 'private-key';
      value: string;
    };

type BrowserSigningWalletBase = {
  address: string;
  derivationPath: string;
  signingMaterial: BrowserSigningMaterial;
};

export type BrowserSigningWallet =
  | (BrowserSigningWalletBase & {
      origin: 'generated';
      generatedMnemonic: string;
    })
  | (BrowserSigningWalletBase & {
      origin: 'mnemonic';
    });

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
  mnemonicImport: boolean;
  watchOnly: boolean;
  localSigning: boolean;
};

export interface WalletNetworkAdapter {
  networkId: NetworkId;
  identity: WalletIdentityMetadata;
  capabilities: WalletNetworkCapabilities;
  createWallet(): BrowserSigningWallet;
  importMnemonic(mnemonic: string): BrowserSigningWallet;
  validatePublicAddress(address: string): boolean;
}
