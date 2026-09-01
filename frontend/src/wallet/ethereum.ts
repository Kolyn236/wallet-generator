import { secp256k1 } from '@noble/curves/secp256k1.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { HDKey } from '@scure/bip32';
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

const ETHEREUM_DERIVATION_PATH = "m/44'/60'/0'/0/0";

export type CreatedEthereumWallet = {
  address: string;
  mnemonic: string;
  privateKey: string;
  derivationPath: string;
};

export function createEthereumWallet(): CreatedEthereumWallet {
  return deriveEthereumWalletFromMnemonic(generateMnemonic(wordlist, 128));
}

export function deriveEthereumWalletFromMnemonic(mnemonic: string): CreatedEthereumWallet {
  const normalizedMnemonic = mnemonic.trim().replace(/\s+/g, ' ');
  if (!validateMnemonic(normalizedMnemonic, wordlist)) {
    throw new Error('Invalid BIP39 mnemonic.');
  }

  const seed = mnemonicToSeedSync(normalizedMnemonic);
  const root = HDKey.fromMasterSeed(seed);
  const account = root.derive(ETHEREUM_DERIVATION_PATH);
  let privateKeyBytes: Uint8Array | null = null;

  try {
    if (!account.privateKey) {
      throw new Error('Ethereum child key derivation failed.');
    }

    privateKeyBytes = account.privateKey.slice();

    return {
      address: ethereumAddressFromPrivateKey(privateKeyBytes),
      mnemonic: normalizedMnemonic,
      privateKey: `0x${bytesToHex(privateKeyBytes)}`,
      derivationPath: ETHEREUM_DERIVATION_PATH,
    };
  } finally {
    privateKeyBytes?.fill(0);
    seed.fill(0);
    account.wipePrivateData();
    root.wipePrivateData();
  }
}

export function isEthereumMainnetAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

export function normalizeEthereumPrivateKey(privateKey: string): Uint8Array {
  const normalized = privateKey.trim().replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error('invalid_private_key');
  }

  const bytes = hexToBytes(normalized);
  if (!secp256k1.utils.isValidSecretKey(bytes)) {
    bytes.fill(0);
    throw new Error('invalid_private_key');
  }

  return bytes;
}

export function ethereumAddressFromPrivateKey(privateKey: string | Uint8Array): string {
  const ownsPrivateKeyBytes = typeof privateKey === 'string';
  const privateKeyBytes = ownsPrivateKeyBytes
    ? normalizeEthereumPrivateKey(privateKey)
    : privateKey;

  try {
    if (!secp256k1.utils.isValidSecretKey(privateKeyBytes)) {
      throw new Error('invalid_private_key');
    }

    const uncompressedPublicKey = secp256k1.getPublicKey(privateKeyBytes, false);
    const addressBytes = keccak_256(uncompressedPublicKey.subarray(1)).subarray(12);

    return `0x${bytesToHex(addressBytes)}`;
  } finally {
    if (ownsPrivateKeyBytes) privateKeyBytes.fill(0);
  }
}

export function ethereumPrivateKeyMatchesAddress(privateKey: string, address: string): boolean {
  if (!isEthereumMainnetAddress(address)) return false;

  try {
    return ethereumAddressFromPrivateKey(privateKey).toLowerCase() === address.toLowerCase();
  } catch {
    return false;
  }
}
