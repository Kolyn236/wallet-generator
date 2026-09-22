import { secp256k1 } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { bytesToHex, hexToBytes, concatBytes } from '@noble/hashes/utils.js';
import { createBase58check } from '@scure/base';
import { HDKey } from '@scure/bip32';
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

export const TRON_DERIVATION_PATH = "m/44'/195'/0'/0/0";
export const TRON_USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
export const TRON_USDT_CONTRACT_HEX = '41a614f803b6fd780986a42c78ec9c7f77e6ded13c';
const base58check = createBase58check(sha256);

export function createTronWallet(): TronWallet & { mnemonic: string } {
  const mnemonic = generateMnemonic(wordlist, 128);
  return { ...deriveTronWallet(mnemonic), mnemonic };
}

const ephemeralKeys = new Map<string, Uint8Array>();
export function registerTronSigningKey(address: string, privateKey: Uint8Array): void { ephemeralKeys.set(address, privateKey.slice()); }
export function signTronWallet(rawDataBytes: Uint8Array, address: string): ReturnType<typeof signTronRawData> {
  const key = ephemeralKeys.get(address);
  if (!key) throw new Error('signing_session_unavailable');
  return signTronRawData(rawDataBytes, key);
}

function assertBytes(v: Uint8Array, n: number, name: string) { if (v.length !== n) throw new Error(`invalid_${name}`); }
function hex(v: string): Uint8Array { if (!/^[0-9a-fA-F]*$/.test(v) || v.length % 2) throw new Error('invalid_hex'); return hexToBytes(v); }

export type TronWallet = { addressBase58: string; addressHex: string; publicKeyHex: string; privateKey: Uint8Array; derivationPath: string };
export function deriveTronWallet(mnemonic: string, path = TRON_DERIVATION_PATH): TronWallet {
  const normalized = mnemonic.trim().replace(/\s+/g, ' ');
  if (path !== TRON_DERIVATION_PATH || !validateMnemonic(normalized, wordlist)) throw new Error('invalid_mnemonic_or_path');
  const seed = mnemonicToSeedSync(normalized); const root = HDKey.fromMasterSeed(seed); const child = root.derive(path);
  if (!child.privateKey) throw new Error('derivation_failed');
  const privateKey = child.privateKey.slice(); const pub = secp256k1.getPublicKey(privateKey, false);
  const payload = concatBytes(Uint8Array.of(0x41), keccak_256(pub.subarray(1)).subarray(12));
  const addressBase58 = base58check.encode(payload); const addressHex = bytesToHex(payload);
  seed.fill(0); child.wipePrivateData(); root.wipePrivateData();
  return { addressBase58, addressHex, publicKeyHex: bytesToHex(pub), privateKey, derivationPath: path };
}

export function decodeTronAddress(value: string): { base58: string; hex: string; payload: Uint8Array } {
  if (typeof value !== 'string' || !value) throw new Error('invalid_address');
  let payload: Uint8Array; try { payload = base58check.decode(value); } catch { throw new Error('invalid_address'); }
  assertBytes(payload, 21, 'address'); if (payload[0] !== 0x41) throw new Error('invalid_network');
  return { base58: base58check.encode(payload), hex: bytesToHex(payload), payload };
}
export function encodeTronAddress(hexAddress: string): string { const p = hex(hexAddress); assertBytes(p, 21, 'address'); if (p[0] !== 0x41) throw new Error('invalid_network'); return base58check.encode(p); }

function uint256(v: bigint): Uint8Array { if (v < 1n || v >= (1n << 256n)) throw new Error('invalid_amount'); const out = new Uint8Array(32); for (let i=31, n=v; i>=0; i--, n >>= 8n) out[i] = Number(n & 255n); return out; }
export function encodeTrc20Transfer(toBase58: string, amountBaseUnits: bigint): { selector: 'a9059cbb'; dataHex: string } {
  const recipient = decodeTronAddress(toBase58).payload.subarray(1); return { selector: 'a9059cbb', dataHex: `a9059cbb${bytesToHex(new Uint8Array(12))}${bytesToHex(recipient)}${bytesToHex(uint256(amountBaseUnits))}` };
}
export function computeTronTxId(rawDataBytes: Uint8Array): string { return bytesToHex(sha256(rawDataBytes)); }

function varint(n: number | bigint): Uint8Array { let x = BigInt(n), a:number[]=[]; do { let b=Number(x&127n); x>>=7n; a.push(b|(x?128:0)); } while(x); return Uint8Array.from(a); }
function field(tag:number, value: Uint8Array): Uint8Array { return concatBytes(varint((tag<<3)|2),varint(value.length),value); }
function fixedField(tag:number, value: number | bigint): Uint8Array { return concatBytes(varint((tag<<3)|0),varint(value)); }
export function encodeTronRawData(input: { ownerAddressHex:string; contractAddressHex?:string; dataHex:string; refBlockBytesHex:string; refBlockHashHex:string; timestampMs:string; expirationMs:string; feeLimitSun:string }): Uint8Array {
  const owner=hex(input.ownerAddressHex), contract=hex(input.contractAddressHex ?? TRON_USDT_CONTRACT_HEX), data=hex(input.dataHex), ref=hex(input.refBlockBytesHex), hash=hex(input.refBlockHashHex);
  assertBytes(owner,21,'owner'); assertBytes(contract,21,'contract'); assertBytes(ref,2,'ref_block_bytes'); assertBytes(hash,8,'ref_block_hash'); if (data.length!==68) throw new Error('invalid_calldata');
  // TriggerSmartContract: owner_address=1, contract_address=2, data=4.
  // Contract: type=1 (TriggerSmartContract enum), parameter=2.
  const trigger=concatBytes(field(1,owner),field(2,contract),field(4,data)); const contractWrapper=concatBytes(fixedField(1,31),field(2,trigger));
  return concatBytes(field(1,contractWrapper),field(4,ref),field(5,hash),fixedField(8,BigInt(input.expirationMs)),fixedField(11,BigInt(input.timestampMs)),fixedField(18,BigInt(input.feeLimitSun)));
}
export function signTronRawData(rawDataBytes: Uint8Array, privateKey: Uint8Array): { signatureHex:string; txId:string; rawTransactionHex:string } {
  if (!secp256k1.utils.isValidSecretKey(privateKey)) throw new Error('invalid_private_key');
  const txId=computeTronTxId(rawDataBytes); const sig=secp256k1.sign(hex(txId),privateKey,{prehash:false,lowS:true,format:'recovered'}); if (sig.length!==65 || sig[0]>1) throw new Error('unsupported_recovery_id');
  const wire=concatBytes(sig.subarray(1),Uint8Array.of(sig[0])); return { signatureHex:bytesToHex(wire), txId, rawTransactionHex:bytesToHex(concatBytes(field(1,rawDataBytes),field(2,wire))) };
}
