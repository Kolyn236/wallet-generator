import { secp256k1 } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { concatBytes } from '@noble/hashes/utils.js';
import { ripemd160 } from '@noble/hashes/legacy.js';
import { createBase58check } from '@scure/base';
import { isUtxoP2pkhAddress, type UtxoP2pkhProfile } from './utxoP2pkh';

const SIGHASH_ALL = 0x01;
const SEQUENCE_FINAL = 0xffffffff;
const SMALLEST_UNITS_PER_COIN = 100_000_000n;
const MAX_INPUTS = 2000;
const base58check = createBase58check(sha256);

export type UtxoP2pkhUtxo = {
  txid: string;
  vout: number;
  valueSmallestUnit: string;
  scriptPubKey: string;
  confirmations: number;
};

export type SignedUtxoP2pkhTransfer = {
  rawTransaction: string;
  txid: string;
  sizeBytes: number;
  inputCount: number;
  outputCount: number;
  amountSmallestUnit: string;
  amount: string;
  feeSmallestUnit: string;
  fee: string;
  feeRateSmallestUnitPerKb: string;
  feeRate: string;
  changeSmallestUnit: string;
  change: string;
};

type SelectedUtxo = { txid: string; vout: number; value: bigint; scriptPubKey: Uint8Array };
type TxOutput = { value: bigint; scriptPubKey: Uint8Array };

export function parseUtxoCoinValue(value: string, errorCode: string): bigint {
  const normalized = value.trim();
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,8}))?$/.exec(normalized);
  if (!match) throw new Error(errorCode);
  const whole = BigInt(match[1]);
  const fraction = (match[2] ?? '').padEnd(8, '0');
  const smallest = whole * SMALLEST_UNITS_PER_COIN + BigInt(fraction || '0');
  if (smallest <= 0n) throw new Error(errorCode);
  return smallest;
}

export function formatUtxoCoin(smallest: bigint): string {
  const whole = smallest / SMALLEST_UNITS_PER_COIN;
  const fraction = (smallest % SMALLEST_UNITS_PER_COIN).toString().padStart(8, '0');
  return `${whole}.${fraction}`;
}

export function buildSignedUtxoP2pkhTransfer(profile: UtxoP2pkhProfile, params: {
  wif: string;
  sourceAddress: string;
  recipientAddress: string;
  amount: string;
  feeRatePerKb: string;
  utxos: UtxoP2pkhUtxo[];
}): SignedUtxoP2pkhTransfer {
  const { wif, sourceAddress, recipientAddress } = params;
  if (!isUtxoP2pkhAddress(profile, sourceAddress) || !isUtxoP2pkhAddress(profile, recipientAddress)) throw new Error('invalid_address');
  if (sourceAddress === recipientAddress) throw new Error('same_address');

  const amount = parseUtxoCoinValue(params.amount, 'invalid_amount');
  if (amount < profile.dustSmallestUnit) throw new Error('amount_below_dust');
  const feeRate = parseUtxoCoinValue(params.feeRatePerKb, 'invalid_fee_rate');
  const privateKey = privateKeyFromWif(profile, wif);

  try {
    const publicKey = secp256k1.getPublicKey(privateKey, true);
    if (publicKeyToAddress(profile, publicKey) !== sourceAddress) throw new Error('wallet_key_mismatch');
    const sourceScript = p2pkhScriptPubKey(profile, sourceAddress);
    const recipientScript = p2pkhScriptPubKey(profile, recipientAddress);
    const normalizedUtxos = normalizeUtxos(params.utxos, bytesToHex(sourceScript));

    let selected: SelectedUtxo[] = [];
    for (const utxo of normalizedUtxos) {
      selected = [...selected, utxo];
      const built = tryBuildSignedTransaction(profile, privateKey, publicKey, sourceScript, recipientScript, amount, feeRate, selected);
      if (built) return built;
    }
    throw new Error('insufficient_funds');
  } finally {
    privateKey.fill(0);
  }
}

function normalizeUtxos(utxos: UtxoP2pkhUtxo[], expectedScriptHex: string): SelectedUtxo[] {
  if (utxos.length > MAX_INPUTS) throw new Error('too_many_utxos');
  return utxos.map((utxo) => {
    if (!/^[0-9a-fA-F]{64}$/.test(utxo.txid) || !Number.isInteger(utxo.vout) || utxo.vout < 0 || !/^\d+$/.test(utxo.valueSmallestUnit) || utxo.confirmations < 1 || !/^[0-9a-fA-F]+$/.test(utxo.scriptPubKey) || utxo.scriptPubKey.length % 2 !== 0) throw new Error('invalid_utxo');
    if (utxo.scriptPubKey.toLowerCase() !== expectedScriptHex) throw new Error('utxo_script_mismatch');
    const value = BigInt(utxo.valueSmallestUnit);
    if (value <= 0n) throw new Error('invalid_utxo');
    return { txid: utxo.txid.toLowerCase(), vout: utxo.vout, value, scriptPubKey: hexToBytes(utxo.scriptPubKey) };
  }).sort((a, b) => a.value === b.value ? 0 : a.value > b.value ? -1 : 1);
}

function tryBuildSignedTransaction(profile: UtxoP2pkhProfile, privateKey: Uint8Array, publicKey: Uint8Array, sourceScript: Uint8Array, recipientScript: Uint8Array, amount: bigint, feeRate: bigint, selected: SelectedUtxo[]): SignedUtxoP2pkhTransfer | null {
  const totalInput = selected.reduce((sum, utxo) => sum + utxo.value, 0n);
  let fee = calculateFee(10 + selected.length * 148 + 2 * 34, feeRate);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (totalInput <= amount + fee) return null;
    const availableChange = totalInput - amount - fee;
    const outputs: TxOutput[] = [{ value: amount, scriptPubKey: recipientScript }];
    let change = 0n;
    if (availableChange >= profile.dustSmallestUnit) {
      change = availableChange;
      outputs.push({ value: change, scriptPubKey: sourceScript });
    }
    const scriptSigs = selected.map((_, inputIndex) => {
      const digest = signatureHash(selected, outputs, inputIndex, sourceScript);
      const derSignature = secp256k1.sign(digest, privateKey, { prehash: false, lowS: true, format: 'der' });
      return concatBytes(pushData(concatBytes(derSignature, Uint8Array.of(SIGHASH_ALL))), pushData(publicKey));
    });
    const raw = serializeTransaction(selected, outputs, scriptSigs);
    const requiredFee = calculateFee(raw.length, feeRate);
    const actualFee = totalInput - outputs.reduce((sum, output) => sum + output.value, 0n);
    if (actualFee >= requiredFee) {
      return {
        rawTransaction: bytesToHex(raw), txid: bytesToHex(reverseBytes(doubleSha256(raw))), sizeBytes: raw.length,
        inputCount: selected.length, outputCount: outputs.length,
        amountSmallestUnit: amount.toString(), amount: formatUtxoCoin(amount),
        feeSmallestUnit: actualFee.toString(), fee: formatUtxoCoin(actualFee),
        feeRateSmallestUnitPerKb: feeRate.toString(), feeRate: formatUtxoCoin(feeRate),
        changeSmallestUnit: change.toString(), change: formatUtxoCoin(change),
      };
    }
    fee = requiredFee;
  }
  throw new Error('fee_calculation_failed');
}

function signatureHash(inputs: SelectedUtxo[], outputs: TxOutput[], signingInputIndex: number, sourceScript: Uint8Array): Uint8Array {
  return doubleSha256(concatBytes(serializeTransaction(inputs, outputs, inputs.map((_, i) => i === signingInputIndex ? sourceScript : new Uint8Array())), uint32LE(SIGHASH_ALL)));
}

function serializeTransaction(inputs: SelectedUtxo[], outputs: TxOutput[], scripts: Uint8Array[]): Uint8Array {
  if (inputs.length !== scripts.length) throw new Error('transaction_input_script_mismatch');
  return concatBytes(uint32LE(1), encodeVarInt(inputs.length), ...inputs.map((input, i) => serializeInput(input, scripts[i])), encodeVarInt(outputs.length), ...outputs.map(serializeOutput), uint32LE(0));
}
function serializeInput(input: SelectedUtxo, scriptSig: Uint8Array): Uint8Array { return concatBytes(reverseBytes(hexToBytes(input.txid)), uint32LE(input.vout), encodeVarInt(scriptSig.length), scriptSig, uint32LE(SEQUENCE_FINAL)); }
function serializeOutput(output: TxOutput): Uint8Array { return concatBytes(uint64LE(output.value), encodeVarInt(output.scriptPubKey.length), output.scriptPubKey); }
function p2pkhScriptPubKey(profile: UtxoP2pkhProfile, address: string): Uint8Array {
  const decoded = base58check.decode(address);
  if (decoded.length !== 21 || decoded[0] !== profile.p2pkhVersion) throw new Error('invalid_address');
  return concatBytes(Uint8Array.of(0x76, 0xa9, 0x14), decoded.slice(1), Uint8Array.of(0x88, 0xac));
}
function privateKeyFromWif(profile: UtxoP2pkhProfile, wif: string): Uint8Array {
  let decoded: Uint8Array;
  try { decoded = base58check.decode(wif.trim()); } catch { throw new Error('invalid_wif'); }
  if (decoded.length !== 34 || decoded[0] !== profile.wifVersion || decoded[33] !== 0x01) throw new Error('invalid_wif');
  return decoded.slice(1, 33);
}
function publicKeyToAddress(profile: UtxoP2pkhProfile, publicKey: Uint8Array): string { return base58check.encode(concatBytes(Uint8Array.of(profile.p2pkhVersion), ripemd160(sha256(publicKey)))); }
function calculateFee(sizeBytes: number, feeRate: bigint): bigint { return (BigInt(sizeBytes) * feeRate + 999n) / 1000n; }
function pushData(data: Uint8Array): Uint8Array { if (data.length >= 0x4c) throw new Error('pushdata_too_large'); return concatBytes(Uint8Array.of(data.length), data); }
function encodeVarInt(value: number): Uint8Array { if (!Number.isSafeInteger(value) || value < 0) throw new Error('invalid_varint'); if (value < 0xfd) return Uint8Array.of(value); if (value <= 0xffff) return Uint8Array.of(0xfd, value & 0xff, (value >>> 8) & 0xff); if (value <= 0xffffffff) return concatBytes(Uint8Array.of(0xfe), uint32LE(value)); return concatBytes(Uint8Array.of(0xff), uint64LE(BigInt(value))); }
function uint32LE(value: number): Uint8Array { if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) throw new Error('uint32_out_of_range'); return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff); }
function uint64LE(value: bigint): Uint8Array { if (value < 0n || value > 0xffffffffffffffffn) throw new Error('uint64_out_of_range'); const bytes = new Uint8Array(8); let remaining = value; for (let i = 0; i < 8; i += 1) { bytes[i] = Number(remaining & 0xffn); remaining >>= 8n; } return bytes; }
function doubleSha256(data: Uint8Array): Uint8Array { return sha256(sha256(data)); }
function hexToBytes(value: string): Uint8Array { if (value.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(value)) throw new Error('invalid_hex'); const bytes = new Uint8Array(value.length / 2); for (let i = 0; i < bytes.length; i += 1) bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16); return bytes; }
function bytesToHex(value: Uint8Array): string { return Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join(''); }
function reverseBytes(value: Uint8Array): Uint8Array { return Uint8Array.from(value).reverse(); }
