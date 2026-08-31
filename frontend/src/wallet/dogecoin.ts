import { sha256 } from '@noble/hashes/sha2.js';
import { concatBytes } from '@noble/hashes/utils.js';
import { ripemd160 } from '@noble/hashes/legacy.js';
import { createBase58check } from '@scure/base';
import { HDKey } from '@scure/bip32';
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

const DOGECOIN_P2PKH_VERSION = 0x1e;
const DOGECOIN_WIF_VERSION = 0x9e;
const COMPRESSED_PUBLIC_KEY_FLAG = 0x01;
const DOGECOIN_DERIVATION_PATH = "m/44'/3'/0'/0/0";
const base58check = createBase58check(sha256);

export type CreatedDogecoinWallet = {
  address: string;
  mnemonic: string;
  wif: string;
  derivationPath: string;
};

export function createDogecoinWallet(): CreatedDogecoinWallet {
  return deriveDogecoinWalletFromMnemonic(generateMnemonic(wordlist, 128));
}

export function deriveDogecoinWalletFromMnemonic(mnemonic: string): CreatedDogecoinWallet {
  const normalizedMnemonic = mnemonic.trim().replace(/\s+/g, ' ');
  if (!validateMnemonic(normalizedMnemonic, wordlist)) {
    throw new Error('Invalid BIP39 mnemonic.');
  }

  const seed = mnemonicToSeedSync(normalizedMnemonic);
  const root = HDKey.fromMasterSeed(seed);
  const account = root.derive(DOGECOIN_DERIVATION_PATH);

  try {
    if (!account.privateKey || !account.publicKey) {
      throw new Error('Dogecoin child key derivation failed.');
    }

    const publicKeyHash = ripemd160(sha256(account.publicKey));
    const address = base58check.encode(
      concatBytes(Uint8Array.of(DOGECOIN_P2PKH_VERSION), publicKeyHash),
    );
    const wif = base58check.encode(
      concatBytes(
        Uint8Array.of(DOGECOIN_WIF_VERSION),
        account.privateKey,
        Uint8Array.of(COMPRESSED_PUBLIC_KEY_FLAG),
      ),
    );

    return {
      address,
      mnemonic: normalizedMnemonic,
      wif,
      derivationPath: DOGECOIN_DERIVATION_PATH,
    };
  } finally {
    seed.fill(0);
    account.wipePrivateData();
    root.wipePrivateData();
  }
}

export function isDogecoinMainnetAddress(address: string): boolean {
  try {
    const decoded = base58check.decode(address);
    return decoded.length === 21 && decoded[0] === DOGECOIN_P2PKH_VERSION;
  } catch {
    return false;
  }
}
