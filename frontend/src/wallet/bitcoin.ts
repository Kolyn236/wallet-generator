import {
  createUtxoP2pkhWallet,
  deriveUtxoP2pkhWalletFromMnemonic,
  isUtxoP2pkhAddress,
  type CreatedUtxoP2pkhWallet,
  type UtxoP2pkhProfile,
} from './utxoP2pkh';

export const BITCOIN_MAINNET_P2PKH_PROFILE: UtxoP2pkhProfile = {
  symbol: 'BTC',
  derivationPath: "m/44'/0'/0'/0/0",
  p2pkhVersion: 0x00,
  wifVersion: 0x80,
  dustSmallestUnit: 546n,
};

export type CreatedBitcoinWallet = CreatedUtxoP2pkhWallet;

export function createBitcoinWallet(): CreatedBitcoinWallet {
  return createUtxoP2pkhWallet(BITCOIN_MAINNET_P2PKH_PROFILE);
}

export function deriveBitcoinWalletFromMnemonic(mnemonic: string): CreatedBitcoinWallet {
  return deriveUtxoP2pkhWalletFromMnemonic(BITCOIN_MAINNET_P2PKH_PROFILE, mnemonic);
}

export function isBitcoinMainnetAddress(address: string): boolean {
  return isUtxoP2pkhAddress(BITCOIN_MAINNET_P2PKH_PROFILE, address);
}
