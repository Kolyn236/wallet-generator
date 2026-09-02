import { sha256 } from '@noble/hashes/sha2.js';
import { concatBytes } from '@noble/hashes/utils.js';
import { ripemd160 } from '@noble/hashes/legacy.js';
import { createBase58check } from '@scure/base';
import { HDKey } from '@scure/bip32';
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

const COMPRESSED_PUBLIC_KEY_FLAG = 0x01;
const base58check = createBase58check(sha256);

export type UtxoP2pkhProfile = {
  symbol: string;
  derivationPath: string;
  p2pkhVersion: number;
  wifVersion: number;
  dustSmallestUnit: bigint;
};

export type CreatedUtxoP2pkhWallet = {
  address: string;
  mnemonic: string;
  wif: string;
  derivationPath: string;
};

export function createUtxoP2pkhWallet(profile: UtxoP2pkhProfile): CreatedUtxoP2pkhWallet {
  return deriveUtxoP2pkhWalletFromMnemonic(profile, generateMnemonic(wordlist, 128));
}

export function deriveUtxoP2pkhWalletFromMnemonic(
  profile: UtxoP2pkhProfile,
  mnemonic: string,
): CreatedUtxoP2pkhWallet {
  const normalizedMnemonic = mnemonic.trim().replace(/\s+/g, ' ');
  if (!validateMnemonic(normalizedMnemonic, wordlist)) {
    throw new Error('Invalid BIP39 mnemonic.');
  }

  const seed = mnemonicToSeedSync(normalizedMnemonic);
  const root = HDKey.fromMasterSeed(seed);
  const account = root.derive(profile.derivationPath);

  try {
    if (!account.privateKey || !account.publicKey) {
      throw new Error(`${profile.symbol} child key derivation failed.`);
    }

    const publicKeyHash = ripemd160(sha256(account.publicKey));
    const address = base58check.encode(
      concatBytes(Uint8Array.of(profile.p2pkhVersion), publicKeyHash),
    );
    const wif = base58check.encode(
      concatBytes(
        Uint8Array.of(profile.wifVersion),
        account.privateKey,
        Uint8Array.of(COMPRESSED_PUBLIC_KEY_FLAG),
      ),
    );

    return { address, mnemonic: normalizedMnemonic, wif, derivationPath: profile.derivationPath };
  } finally {
    seed.fill(0);
    account.wipePrivateData();
    root.wipePrivateData();
  }
}

export function isUtxoP2pkhAddress(profile: UtxoP2pkhProfile, address: string): boolean {
  try {
    const decoded = base58check.decode(address);
    return decoded.length === 21 && decoded[0] === profile.p2pkhVersion;
  } catch {
    return false;
  }
}
