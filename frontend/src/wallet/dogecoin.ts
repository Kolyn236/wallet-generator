import { secp256k1 } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { concatBytes } from '@noble/hashes/utils.js';
import { ripemd160 } from '@noble/hashes/legacy.js';
import { createBase58check } from '@scure/base';
import { HDKey } from '@scure/bip32';
import { generateMnemonic, mnemonicToSeedSync } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

const DOGECOIN_P2PKH_VERSION = 0x1e;
const DOGECOIN_WIF_VERSION = 0x9e;
const COMPRESSED_PUBLIC_KEY_FLAG = 0x01;
const DOGECOIN_DERIVATION_PATH = "m/44'/3'/0'/0/0";
const base58check = createBase58check(sha256);

export type CreatedDogecoinWallet = {
  origin: 'created';
  address: string;
  mnemonic: string;
  wif: string;
  derivationPath: string;
};

export type ExistingDogecoinSigningWallet = {
  origin: 'existing-wif';
  address: string;
  wif: string;
  mnemonic: null;
  derivationPath: null;
};

export type DogecoinSigningWallet = CreatedDogecoinWallet | ExistingDogecoinSigningWallet;

export type DogecoinWifKey = {
  privateKey: Uint8Array;
  compressed: boolean;
};

export function createDogecoinWallet(): CreatedDogecoinWallet {
  const mnemonic = generateMnemonic(wordlist, 128);
  const seed = mnemonicToSeedSync(mnemonic);
  const root = HDKey.fromMasterSeed(seed);
  const account = root.derive(DOGECOIN_DERIVATION_PATH);

  try {
    if (!account.privateKey || !account.publicKey) {
      throw new Error('Dogecoin child key derivation failed.');
    }

    const address = publicKeyToDogecoinAddress(account.publicKey);
    const wif = base58check.encode(
      concatBytes(
        Uint8Array.of(DOGECOIN_WIF_VERSION),
        account.privateKey,
        Uint8Array.of(COMPRESSED_PUBLIC_KEY_FLAG),
      ),
    );

    return {
      origin: 'created',
      address,
      mnemonic,
      wif,
      derivationPath: DOGECOIN_DERIVATION_PATH,
    };
  } finally {
    seed.fill(0);
    account.wipePrivateData();
    root.wipePrivateData();
  }
}

export function connectDogecoinWalletFromWif(wif: string): ExistingDogecoinSigningWallet {
  const normalizedWif = wif.trim();
  const decoded = decodeDogecoinWif(normalizedWif);

  try {
    const publicKey = secp256k1.getPublicKey(decoded.privateKey, decoded.compressed);

    return {
      origin: 'existing-wif',
      address: publicKeyToDogecoinAddress(publicKey),
      wif: normalizedWif,
      mnemonic: null,
      derivationPath: null,
    };
  } finally {
    decoded.privateKey.fill(0);
  }
}

export function decodeDogecoinWif(wif: string): DogecoinWifKey {
  let decoded: Uint8Array;
  try {
    decoded = base58check.decode(wif.trim());
  } catch {
    throw new Error('invalid_wif');
  }

  if (decoded[0] !== DOGECOIN_WIF_VERSION) {
    throw new Error('invalid_wif');
  }

  if (decoded.length === 33) {
    return {
      privateKey: decoded.slice(1, 33),
      compressed: false,
    };
  }

  if (decoded.length === 34 && decoded[33] === COMPRESSED_PUBLIC_KEY_FLAG) {
    return {
      privateKey: decoded.slice(1, 33),
      compressed: true,
    };
  }

  throw new Error('invalid_wif');
}

export function isDogecoinMainnetAddress(address: string): boolean {
  try {
    const decoded = base58check.decode(address);
    return decoded.length === 21 && decoded[0] === DOGECOIN_P2PKH_VERSION;
  } catch {
    return false;
  }
}

function publicKeyToDogecoinAddress(publicKey: Uint8Array): string {
  const publicKeyHash = ripemd160(sha256(publicKey));
  return base58check.encode(
    concatBytes(Uint8Array.of(DOGECOIN_P2PKH_VERSION), publicKeyHash),
  );
}
