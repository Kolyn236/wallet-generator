import { bech32 } from '@scure/base';
import {
  createUtxoP2pkhWallet,
  deriveUtxoP2pkhWalletFromMnemonic,
  isUtxoBase58Address,
  isUtxoP2pkhAddress,
  type CreatedUtxoP2pkhWallet,
  type UtxoP2pkhProfile,
} from './utxoP2pkh';

const BITCOIN_MAINNET_P2SH_VERSION = 0x05;
const BITCOIN_MAINNET_BECH32_HRP = 'bc';
const BITCOIN_MAINNET_P2WPKH_WITNESS_VERSION = 0;
const BITCOIN_MAINNET_P2WPKH_PROGRAM_LENGTH = 20;

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

export function isBitcoinMainnetWatchOnlyAddress(address: string): boolean {
  return isUtxoBase58Address(address, [
    BITCOIN_MAINNET_P2PKH_PROFILE.p2pkhVersion,
    BITCOIN_MAINNET_P2SH_VERSION,
  ]);
}

export function decodeBitcoinMainnetP2wpkhProgram(address: string): Uint8Array | null {
  try {
    const decoded = bech32.decode(address, 90);
    if (decoded.prefix.toLowerCase() !== BITCOIN_MAINNET_BECH32_HRP
      || decoded.words[0] !== BITCOIN_MAINNET_P2WPKH_WITNESS_VERSION
    ) {
      return null;
    }

    const program = bech32.fromWords(decoded.words.slice(1));
    return program.length === BITCOIN_MAINNET_P2WPKH_PROGRAM_LENGTH
      ? Uint8Array.from(program)
      : null;
  } catch {
    return null;
  }
}

export function isBitcoinMainnetP2wpkhAddress(address: string): boolean {
  return decodeBitcoinMainnetP2wpkhProgram(address) !== null;
}

export function isBitcoinMainnetTransferRecipientAddress(address: string): boolean {
  return isBitcoinMainnetAddress(address) || isBitcoinMainnetP2wpkhAddress(address);
}
