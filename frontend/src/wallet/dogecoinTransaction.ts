import { secp256k1 } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { concatBytes } from '@noble/hashes/utils.js';
import { ripemd160 } from '@noble/hashes/legacy.js';
import { createBase58check } from '@scure/base';
import { isDogecoinMainnetAddress } from './dogecoin';

const DOGECOIN_P2PKH_VERSION = 0x1e;
const DOGECOIN_WIF_VERSION = 0x9e;
const SIGHASH_ALL = 0x01;
const SEQUENCE_FINAL = 0xffffffff;
const KOINU_PER_DOGE = 100_000_000n;
const FEE_RATE_KOINU_PER_KB = 1_000_000n;
const SOFT_DUST_KOINU = 1_000_000n;
const MAX_INPUTS = 2000;
const base58check = createBase58check(sha256);

export type DogecoinUtxo = {
  txid: string;
  vout: number;
  valueSmallestUnit: string;
  scriptPubKey: string;
  confirmations: number;
};

export type SignedDogecoinTransfer = {
  rawTransaction: string;
  txid: string;
  sizeBytes: number;
  inputCount: number;
  outputCount: number;
  amountKoinu: string;
  amountDoge: string;
  feeKoinu: string;
  feeDoge: string;
  changeKoinu: string;
  changeDoge: string;
};

type SelectedUtxo = {
  txid: string;
  vout: number;
  value: bigint;
  scriptPubKey: Uint8Array;
};

type TxOutput = {
  value: bigint;
  scriptPubKey: Uint8Array;
};

export function parseDogeAmount(value: string): bigint {
  const normalized = value.trim();
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,8}))?$/.exec(normalized);
  if (!match) {
    throw new Error('invalid_amount');
  }

  const whole = BigInt(match[1]);
  const fraction = (match[2] ?? '').padEnd(8, '0');
  const koinu = whole * KOINU_PER_DOGE + BigInt(fraction || '0');

  if (koinu <= 0n) {
    throw new Error('invalid_amount');
  }
  if (koinu < SOFT_DUST_KOINU) {
    throw new Error('amount_below_dust');
  }

  return koinu;
}

export function formatDoge(koinu: bigint): string {
  const whole = koinu / KOINU_PER_DOGE;
  const fraction = (koinu % KOINU_PER_DOGE).toString().padStart(8, '0');
  return `${whole}.${fraction}`;
}

export function buildSignedDogecoinTransfer(params: {
  wif: string;
  sourceAddress: string;
  recipientAddress: string;
  amount: string;
  utxos: DogecoinUtxo[];
}): SignedDogecoinTransfer {
  const { wif, sourceAddress, recipientAddress } = params;

  if (!isDogecoinMainnetAddress(sourceAddress) || !isDogecoinMainnetAddress(recipientAddress)) {
    throw new Error('invalid_address');
  }
  if (sourceAddress === recipientAddress) {
    throw new Error('same_address');
  }

  const amount = parseDogeAmount(params.amount);
  const privateKey = privateKeyFromWif(wif);

  try {
    const publicKey = secp256k1.getPublicKey(privateKey, true);
    const derivedAddress = publicKeyToDogecoinAddress(publicKey);
    if (derivedAddress !== sourceAddress) {
      throw new Error('wallet_key_mismatch');
    }

    const sourceScript = p2pkhScriptPubKey(sourceAddress);
    const recipientScript = p2pkhScriptPubKey(recipientAddress);
    const expectedScriptHex = bytesToHex(sourceScript);
    const normalizedUtxos = normalizeUtxos(params.utxos, expectedScriptHex);

    let selected: SelectedUtxo[] = [];
    for (const utxo of normalizedUtxos) {
      selected = [...selected, utxo];
      const built = tryBuildSignedTransaction({
        privateKey,
        publicKey,
        sourceScript,
        recipientScript,
        amount,
        selected,
      });

      if (built) {
        return built;
      }
    }

    throw new Error('insufficient_funds');
  } finally {
    privateKey.fill(0);
  }
}

function normalizeUtxos(utxos: DogecoinUtxo[], expectedScriptHex: string): SelectedUtxo[] {
  if (utxos.length > MAX_INPUTS) {
    throw new Error('too_many_utxos');
  }

  return utxos.map((utxo) => {
    if (!/^[0-9a-fA-F]{64}$/.test(utxo.txid)
      || !Number.isInteger(utxo.vout)
      || utxo.vout < 0
      || !/^\d+$/.test(utxo.valueSmallestUnit)
      || utxo.confirmations < 1
      || !/^[0-9a-fA-F]+$/.test(utxo.scriptPubKey)
      || utxo.scriptPubKey.length % 2 !== 0
    ) {
      throw new Error('invalid_utxo');
    }

    if (utxo.scriptPubKey.toLowerCase() !== expectedScriptHex) {
      throw new Error('utxo_script_mismatch');
    }

    const value = BigInt(utxo.valueSmallestUnit);
    if (value <= 0n) {
      throw new Error('invalid_utxo');
    }

    return {
      txid: utxo.txid.toLowerCase(),
      vout: utxo.vout,
      value,
      scriptPubKey: hexToBytes(utxo.scriptPubKey),
    };
  }).sort((left, right) => {
    if (left.value === right.value) return 0;
    return left.value > right.value ? -1 : 1;
  });
}

function tryBuildSignedTransaction(params: {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  sourceScript: Uint8Array;
  recipientScript: Uint8Array;
  amount: bigint;
  selected: SelectedUtxo[];
}): SignedDogecoinTransfer | null {
  const { privateKey, publicKey, sourceScript, recipientScript, amount, selected } = params;
  const totalInput = selected.reduce((sum, utxo) => sum + utxo.value, 0n);
  let fee = recommendedFee(10 + selected.length * 148 + 2 * 34);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (totalInput <= amount + fee) {
      return null;
    }

    const availableChange = totalInput - amount - fee;
    const outputs: TxOutput[] = [{ value: amount, scriptPubKey: recipientScript }];
    let change = 0n;

    if (availableChange >= SOFT_DUST_KOINU) {
      change = availableChange;
      outputs.push({ value: change, scriptPubKey: sourceScript });
    }

    const scriptSigs = selected.map((_, inputIndex) => {
      const digest = signatureHash(selected, outputs, inputIndex, sourceScript);
      const derSignature = secp256k1.sign(digest, privateKey, {
        prehash: false,
        lowS: true,
        format: 'der',
      });
      const signatureWithHashType = concatBytes(derSignature, Uint8Array.of(SIGHASH_ALL));
      return concatBytes(pushData(signatureWithHashType), pushData(publicKey));
    });

    const raw = serializeTransaction(selected, outputs, scriptSigs);
    const requiredFee = recommendedFee(raw.length);
    const actualFee = totalInput - outputs.reduce((sum, output) => sum + output.value, 0n);

    if (actualFee >= requiredFee) {
      const txid = bytesToHex(reverseBytes(doubleSha256(raw)));
      return {
        rawTransaction: bytesToHex(raw),
        txid,
        sizeBytes: raw.length,
        inputCount: selected.length,
        outputCount: outputs.length,
        amountKoinu: amount.toString(),
        amountDoge: formatDoge(amount),
        feeKoinu: actualFee.toString(),
        feeDoge: formatDoge(actualFee),
        changeKoinu: change.toString(),
        changeDoge: formatDoge(change),
      };
    }

    fee = requiredFee;
  }

  throw new Error('fee_calculation_failed');
}

function signatureHash(
  inputs: SelectedUtxo[],
  outputs: TxOutput[],
  signingInputIndex: number,
  sourceScript: Uint8Array,
): Uint8Array {
  const scripts = inputs.map((_, index) => index === signingInputIndex ? sourceScript : new Uint8Array());
  const unsigned = serializeTransaction(inputs, outputs, scripts);
  return doubleSha256(concatBytes(unsigned, uint32LE(SIGHASH_ALL)));
}

function serializeTransaction(inputs: SelectedUtxo[], outputs: TxOutput[], scripts: Uint8Array[]): Uint8Array {
  if (inputs.length !== scripts.length) {
    throw new Error('transaction_input_script_mismatch');
  }

  return concatBytes(
    uint32LE(1),
    encodeVarInt(inputs.length),
    ...inputs.map((input, index) => serializeInput(input, scripts[index])),
    encodeVarInt(outputs.length),
    ...outputs.map(serializeOutput),
    uint32LE(0),
  );
}

function serializeInput(input: SelectedUtxo, scriptSig: Uint8Array): Uint8Array {
  return concatBytes(
    reverseBytes(hexToBytes(input.txid)),
    uint32LE(input.vout),
    encodeVarInt(scriptSig.length),
    scriptSig,
    uint32LE(SEQUENCE_FINAL),
  );
}

function serializeOutput(output: TxOutput): Uint8Array {
  return concatBytes(
    uint64LE(output.value),
    encodeVarInt(output.scriptPubKey.length),
    output.scriptPubKey,
  );
}

function p2pkhScriptPubKey(address: string): Uint8Array {
  const decoded = base58check.decode(address);
  if (decoded.length !== 21 || decoded[0] !== DOGECOIN_P2PKH_VERSION) {
    throw new Error('invalid_address');
  }

  return concatBytes(
    Uint8Array.of(0x76, 0xa9, 0x14),
    decoded.slice(1),
    Uint8Array.of(0x88, 0xac),
  );
}

function privateKeyFromWif(wif: string): Uint8Array {
  let decoded: Uint8Array;
  try {
    decoded = base58check.decode(wif.trim());
  } catch {
    throw new Error('invalid_wif');
  }

  if (decoded.length !== 34
    || decoded[0] !== DOGECOIN_WIF_VERSION
    || decoded[33] !== 0x01
  ) {
    throw new Error('invalid_wif');
  }

  return decoded.slice(1, 33);
}

function publicKeyToDogecoinAddress(publicKey: Uint8Array): string {
  const publicKeyHash = ripemd160(sha256(publicKey));
  return base58check.encode(concatBytes(Uint8Array.of(DOGECOIN_P2PKH_VERSION), publicKeyHash));
}

function recommendedFee(sizeBytes: number): bigint {
  return (BigInt(sizeBytes) * FEE_RATE_KOINU_PER_KB + 999n) / 1000n;
}

function pushData(data: Uint8Array): Uint8Array {
  if (data.length >= 0x4c) {
    throw new Error('pushdata_too_large');
  }
  return concatBytes(Uint8Array.of(data.length), data);
}

function encodeVarInt(value: number): Uint8Array {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('invalid_varint');
  }
  if (value < 0xfd) {
    return Uint8Array.of(value);
  }
  if (value <= 0xffff) {
    return Uint8Array.of(0xfd, value & 0xff, (value >>> 8) & 0xff);
  }
  if (value <= 0xffffffff) {
    return concatBytes(Uint8Array.of(0xfe), uint32LE(value));
  }
  return concatBytes(Uint8Array.of(0xff), uint64LE(BigInt(value)));
}

function uint32LE(value: number): Uint8Array {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error('uint32_out_of_range');
  }
  return Uint8Array.of(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  );
}

function uint64LE(value: bigint): Uint8Array {
  if (value < 0n || value > 0xffffffffffffffffn) {
    throw new Error('uint64_out_of_range');
  }

  const bytes = new Uint8Array(8);
  let remaining = value;
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return bytes;
}

function doubleSha256(data: Uint8Array): Uint8Array {
  return sha256(sha256(data));
}

function hexToBytes(value: string): Uint8Array {
  if (value.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(value)) {
    throw new Error('invalid_hex');
  }
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(value: Uint8Array): string {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function reverseBytes(value: Uint8Array): Uint8Array {
  return Uint8Array.from(value).reverse();
}
