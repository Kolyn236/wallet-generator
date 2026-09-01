import {
  createUtxoP2pkhWallet,
  deriveUtxoP2pkhWalletFromMnemonic,
  isUtxoP2pkhAddress,
  type CreatedUtxoP2pkhWallet,
  type UtxoP2pkhProfile,
} from './utxoP2pkh';

export const LITECOIN_MAINNET_P2PKH_PROFILE: UtxoP2pkhProfile = {
  symbol: 'LTC',
  derivationPath: "m/44'/2'/0'/0/0",
  p2pkhVersion: 0x30,
  wifVersion: 0xb0,
  dustSmallestUnit: 546n,
};

export type CreatedLitecoinWallet = CreatedUtxoP2pkhWallet;

export function createLitecoinWallet(): CreatedLitecoinWallet {
  return createUtxoP2pkhWallet(LITECOIN_MAINNET_P2PKH_PROFILE);
}

export function deriveLitecoinWalletFromMnemonic(mnemonic: string): CreatedLitecoinWallet {
  return deriveUtxoP2pkhWalletFromMnemonic(LITECOIN_MAINNET_P2PKH_PROFILE, mnemonic);
}

export function isLitecoinMainnetAddress(address: string): boolean {
  return isUtxoP2pkhAddress(LITECOIN_MAINNET_P2PKH_PROFILE, address);
}
