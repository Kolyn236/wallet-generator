import { sha256 } from '@noble/hashes/sha2.js';
import { concatBytes } from '@noble/hashes/utils.js';
import { ripemd160 } from '@noble/hashes/legacy.js';
import { createBase58check } from '@scure/base';
import { HDKey } from '@scure/bip32';
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

const BITCOIN_P2PKH_VERSION = 0x00;
const BITCOIN_WIF_VERSION = 0x80;
const COMPRESSED_PUBLIC_KEY_FLAG = 0x01;
const BITCOIN_DERIVATION_PATH = "m/44'/0'/0'/0/0";
const base58check = createBase58check(sha256);

export type CreatedBitcoinWallet = {
  address: string;
  mnemonic: string;
  wif: string;
  derivationPath: string;
};

export function createBitcoinWallet(): CreatedBitcoinWallet {
  return deriveBitcoinWalletFromMnemonic(generateMnemonic(wordlist, 128));
}

export function deriveBitcoinWalletFromMnemonic(mnemonic: string): CreatedBitcoinWallet {
  const normalizedMnemonic = mnemonic.trim().replace(/\s+/g, ' ');
  if (!validateMnemonic(normalizedMnemonic, wordlist)) {
    throw new Error('Invalid BIP39 mnemonic.');
  }

  const seed = mnemonicToSeedSync(normalizedMnemonic);
  const root = HDKey.fromMasterSeed(seed);
  const account = root.derive(BITCOIN_DERIVATION_PATH);

  try {
    if (!account.privateKey || !account.publicKey) {
      throw new Error('Bitcoin child key derivation failed.');
    }

    const publicKeyHash = ripemd160(sha256(account.publicKey));
    const address = base58check.encode(
      concatBytes(Uint8Array.of(BITCOIN_P2PKH_VERSION), publicKeyHash),
    );
    const wif = base58check.encode(
      concatBytes(
        Uint8Array.of(BITCOIN_WIF_VERSION),
        account.privateKey,
        Uint8Array.of(COMPRESSED_PUBLIC_KEY_FLAG),
      ),
    );

    return {
      address,
      mnemonic: normalizedMnemonic,
      wif,
      derivationPath: BITCOIN_DERIVATION_PATH,
    };
  } finally {
    seed.fill(0);
    account.wipePrivateData();
    root.wipePrivateData();
  }
}

export function isBitcoinMainnetAddress(address: string): boolean {
  try {
    const decoded = base58check.decode(address);
    return decoded.length === 21 && decoded[0] === BITCOIN_P2PKH_VERSION;
  } catch {
    return false;
  }
}
