import { secp256k1 } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { bytesToHex, concatBytes, hexToBytes } from '@noble/hashes/utils.js';
import { createBase58check } from '@scure/base';
import { HDKey } from '@scure/bip32';
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

export const TRON_DERIVATION_PATH = "m/44'/195'/0'/0/0";
export const TRON_USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
export const TRON_USDT_CONTRACT_HEX = '41a614f803b6fd780986a42c78ec9c7f77e6ded13c';
const base58check = createBase58check(sha256);
const UINT256_MAX = (1n << 256n) - 1n;

function tokenUnits(value: string): bigint {
  if (typeof value !== 'string' || value.length > 78 || !/^(0|[1-9]\d*)$/.test(value)) throw new Error('invalid_amount');
  const units = BigInt(value);
  if (units > UINT256_MAX) throw new Error('invalid_amount');
  return units;
}

export function parseUsdtTrc20Amount(amount: string): string {
  if (typeof amount !== 'string' || amount.length > 85) throw new Error('invalid_amount');
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,6}))?$/.exec(amount.trim());
  if (!match) throw new Error('invalid_amount');
  const units = BigInt(match[1]) * 1_000_000n + BigInt((match[2] ?? '').padEnd(6, '0'));
  if (units <= 0n || units > UINT256_MAX) throw new Error('invalid_amount');
  return units.toString();
}

export function formatUsdtTrc20Amount(value: string): string {
  const units = tokenUnits(value);
  const fraction = (units % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '');
  return `${units / 1_000_000n}${fraction ? `.${fraction}` : ''}`;
}

export function encodeTrc20Transfer(recipient: string, amountBaseUnits: string): string {
  const payload = decodeTronAddress(recipient);
  const units = tokenUnits(amountBaseUnits);
  if (units === 0n) throw new Error('invalid_amount');
  return `a9059cbb${bytesToHex(payload.subarray(1)).padStart(64, '0')}${units.toString(16).padStart(64, '0')}`;
}

export type TronWallet = {
  address: string;
  addressHex: string;
  publicKeyHex: string;
  privateKey: string;
  derivationPath: string;
};

export function deriveTronWallet(mnemonic: string): TronWallet {
  const normalized = mnemonic.trim().replace(/\s+/g, ' ');
  if (!validateMnemonic(normalized, wordlist)) throw new Error('invalid_mnemonic');
  const seed = mnemonicToSeedSync(normalized);
  const root = HDKey.fromMasterSeed(seed);
  const child = root.derive(TRON_DERIVATION_PATH);
  try {
    if (!child.privateKey) throw new Error('derivation_failed');
    const publicKey = secp256k1.getPublicKey(child.privateKey, false);
    const payload = concatBytes(Uint8Array.of(0x41), keccak_256(publicKey.subarray(1)).subarray(12));
    return {
      address: base58check.encode(payload), addressHex: bytesToHex(payload),
      publicKeyHex: bytesToHex(publicKey), privateKey: bytesToHex(child.privateKey),
      derivationPath: TRON_DERIVATION_PATH,
    };
  } finally {
    seed.fill(0);
    child.wipePrivateData();
    root.wipePrivateData();
  }
}

export function createTronWallet(): TronWallet & { mnemonic: string } {
  const mnemonic = generateMnemonic(wordlist, 128);
  return { ...deriveTronWallet(mnemonic), mnemonic };
}

export function decodeTronAddress(address: string): Uint8Array {
  if (typeof address !== 'string' || !/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) {
    throw new Error('invalid_address');
  }
  let payload: Uint8Array;
  try { payload = base58check.decode(address); } catch { throw new Error('invalid_address'); }
  if (payload.length !== 21 || payload[0] !== 0x41 || base58check.encode(payload) !== address) {
    throw new Error('invalid_address');
  }
  return payload;
}

// TRON addresses do not distinguish mainnet from testnets; network identity is
// enforced separately by the preparation envelope and gateway configuration.
export function isTronMainnetAddress(address: string): boolean {
  try { decodeTronAddress(address); return true; } catch { return false; }
}

export function normalizeTronPrivateKey(privateKey: string): Uint8Array {
  if (typeof privateKey !== 'string' || !/^(?:0x)?[0-9a-fA-F]{64}$/.test(privateKey)) throw new Error('invalid_private_key');
  const bytes = hexToBytes(privateKey.replace(/^0x/, ''));
  if (!secp256k1.utils.isValidSecretKey(bytes)) { bytes.fill(0); throw new Error('invalid_private_key'); }
  return bytes;
}

export function tronPrivateKeyMatchesAddress(privateKey: string, address: string): boolean {
  let bytes: Uint8Array | undefined;
  try {
    decodeTronAddress(address);
    bytes = normalizeTronPrivateKey(privateKey);
    const pub = secp256k1.getPublicKey(bytes, false);
    return base58check.encode(concatBytes(Uint8Array.of(0x41), keccak_256(pub.subarray(1)).subarray(12))) === address;
  } catch { return false; } finally { bytes?.fill(0); }
}
