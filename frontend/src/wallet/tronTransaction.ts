import { secp256k1 } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, concatBytes, hexToBytes } from '@noble/hashes/utils.js';
import {
  decodeTronAddress, encodeTrc20Transfer, formatUsdtTrc20Amount,
  normalizeTronPrivateKey, parseUsdtTrc20Amount, TRON_USDT_CONTRACT_HEX,
  TRON_USDT_CONTRACT, isTronMainnetAddress, tronPrivateKeyMatchesAddress,
} from './tron';

export type PreparedTronTransactionData = {
  chain: 'tron'; network: 'mainnet'; networkId: 'tron-mainnet';
  assetRouteId: 'usdt-tron-mainnet-trc20';
  from: string; to: string; amountBaseUnits: string; contractAddress: string; decimals: 6;
  refBlockBytesHex: string; refBlockHashHex: string; refBlockNumber: string; refBlockId: string;
  timestampMs: string; expirationMs: string; feeLimitSun: string;
  energyEstimate: string; energyPriceSun: string; bandwidthPriceSun: string;
  senderTrxSun: string; senderTokenBalanceBaseUnits: string; recipientActive: boolean;
  rawDataHex?: string;
};

export type SignedTronTransfer = PreparedTronTransactionData & {
  rawTransactionHex: string; rawDataHex: string; txId: string; signatureHex: string;
  amount: string; estimatedEnergyFeeSun: string; bandwidthBytes: string;
  maxBandwidthFeeSun: string; maxNetworkFeeSun: string; maxNetworkFeeTrx: string;
};

export type UnsignedTronTransfer = Omit<SignedTronTransfer, 'rawTransactionHex' | 'signatureHex'>;
type TronTransferInput = {
  sourceAddress: string; recipientAddress: string;
  amount: string; prepared: PreparedTronTransactionData; nowMs?: number;
};

/** Public-only serialization/validation for immutable review before explicit signing. */
export function prepareUnsignedTronTransfer(input: TronTransferInput): UnsignedTronTransfer {
  const p = input.prepared;
  if (!isTronMainnetAddress(input.sourceAddress)) throw new Error('invalid_sender');
  if (!isTronMainnetAddress(input.recipientAddress)) throw new Error('invalid_recipient');
  if (input.sourceAddress === input.recipientAddress) throw new Error('same_address');
  const amountBaseUnits = parseUsdtTrc20Amount(input.amount);
  if (!p || p.chain !== 'tron' || p.network !== 'mainnet' || p.networkId !== 'tron-mainnet'
    || p.assetRouteId !== 'usdt-tron-mainnet-trc20' || p.from !== input.sourceAddress
    || p.to !== input.recipientAddress || p.amountBaseUnits !== amountBaseUnits
    || p.contractAddress !== TRON_USDT_CONTRACT || p.decimals !== 6) {
    throw new Error('prepared_transaction_mismatch');
  }
  validateSnapshot(p, input.nowMs ?? Date.now());
  // protocol.TriggerSmartContract: no native value, token ID, or permission override.
  const trigger = concatBytes(
    bytesField(1, decodeTronAddress(input.sourceAddress)),
    bytesField(2, hexToBytes(TRON_USDT_CONTRACT_HEX)),
    bytesField(4, hexToBytes(encodeTrc20Transfer(input.recipientAddress, amountBaseUnits))),
  );
  const parameter = concatBytes(
    bytesField(1, new TextEncoder().encode('type.googleapis.com/protocol.TriggerSmartContract')),
    bytesField(2, trigger),
  );
  const contract = concatBytes(intField(1, 31n), bytesField(2, parameter));
  // Authoritative schema: tronprotocol/protocol core/Tron.proto Transaction.raw.
  const raw = concatBytes(
    bytesField(1, hexToBytes(p.refBlockBytesHex)),
    bytesField(4, hexToBytes(p.refBlockHashHex)),
    intField(8, BigInt(p.expirationMs)), bytesField(11, contract),
    intField(14, BigInt(p.timestampMs)), intField(18, BigInt(p.feeLimitSun)),
  );
  if (p.rawDataHex !== undefined && p.rawDataHex !== bytesToHex(raw)) throw new Error('prepared_transaction_mismatch');
  // java-tron reserves MAX_RESULT_SIZE_IN_TX (64 bytes) for bandwidth.
  // Charge all bytes conservatively, without trusting claimed free/staked resources.
  const bandwidthBytes = BigInt(bytesField(1, raw).length + bytesField(2, new Uint8Array(65)).length + 64);
  const maxBandwidthFee = bandwidthBytes * BigInt(p.bandwidthPriceSun);
  const maxNetworkFee = BigInt(p.feeLimitSun) + maxBandwidthFee;
  if (BigInt(p.senderTrxSun) < maxNetworkFee) throw new Error('insufficient_funds');
  return {
    ...p, rawDataHex: bytesToHex(raw), txId: bytesToHex(sha256(raw)),
    amount: formatUsdtTrc20Amount(amountBaseUnits),
    estimatedEnergyFeeSun: (BigInt(p.energyEstimate) * BigInt(p.energyPriceSun)).toString(),
    bandwidthBytes: bandwidthBytes.toString(), maxBandwidthFeeSun: maxBandwidthFee.toString(),
    maxNetworkFeeSun: maxNetworkFee.toString(), maxNetworkFeeTrx: formatUsdtTrc20Amount(maxNetworkFee.toString()),
  };
}

export function buildSignedTronTransfer(input: TronTransferInput & { privateKey: string }): SignedTronTransfer {
  // Preserve the signer validation order and verify the selected identity locally.
  if (!isTronMainnetAddress(input.sourceAddress)) throw new Error('invalid_sender');
  if (!isTronMainnetAddress(input.recipientAddress)) throw new Error('invalid_recipient');
  if (input.sourceAddress === input.recipientAddress) throw new Error('same_address');
  const checkedKey = normalizeTronPrivateKey(input.privateKey);
  checkedKey.fill(0);
  if (!tronPrivateKeyMatchesAddress(input.privateKey, input.sourceAddress)) throw new Error('wallet_key_mismatch');
  const reviewed = prepareUnsignedTronTransfer(input);
  const raw = hexToBytes(reviewed.rawDataHex);
  const digest = hexToBytes(reviewed.txId);
  const key = normalizeTronPrivateKey(input.privateKey);
  try {
    const sig = secp256k1.sign(digest, key, { prehash: false, lowS: true, format: 'recovered' });
    if (sig.length !== 65 || sig[0] > 1) throw new Error('unsupported_recovery_id');
    const publicKey = secp256k1.getPublicKey(key);
    if (!secp256k1.verify(sig.subarray(1), digest, publicKey, { prehash: false, lowS: true, format: 'compact' })
      || bytesToHex(secp256k1.recoverPublicKey(sig, digest, { prehash: false })) !== bytesToHex(publicKey)) {
      throw new Error('signing_failed');
    }
    const signature = concatBytes(sig.subarray(1), sig.subarray(0, 1));
    const wire = concatBytes(bytesField(1, raw), bytesField(2, signature));
    return {
      ...reviewed, rawTransactionHex: bytesToHex(wire), signatureHex: bytesToHex(signature),
    };
  } finally { key.fill(0); }
}

// These are wallet freshness policies, not claims that an untrusted provider
// proves mainnet inclusion. The gateway must independently enforce its network.
function validateSnapshot(p: PreparedTronTransactionData, nowMs: number): void {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new Error('invalid_time');
  for (const value of [p.refBlockNumber, p.timestampMs, p.expirationMs, p.feeLimitSun,
    p.energyEstimate, p.energyPriceSun, p.bandwidthPriceSun, p.senderTrxSun]) quantity(value);
  quantity(p.senderTokenBalanceBaseUnits, (1n << 256n) - 1n);
  const fee = BigInt(p.feeLimitSun);
  const energy = BigInt(p.energyEstimate);
  const energyPrice = BigInt(p.energyPriceSun);
  const bandwidthPrice = BigInt(p.bandwidthPriceSun);
  // Explicit wallet spending/resource limits, not chain protocol constants.
  if (fee <= 0n || fee > 100_000_000n || energy <= 0n || energy > 10_000_000n
    || energyPrice <= 0n || energyPrice > 100_000n
    || bandwidthPrice <= 0n || bandwidthPrice > 1_000_000n
    || energy * energyPrice > fee) throw new Error('invalid_fee');
  if (typeof p.recipientActive !== 'boolean') throw new Error('invalid_resources');
  if (BigInt(p.senderTokenBalanceBaseUnits) < BigInt(p.amountBaseUnits)) throw new Error('insufficient_token_funds');
  const timestamp = BigInt(p.timestampMs);
  const expiration = BigInt(p.expirationMs);
  const now = BigInt(nowMs);
  // Reference timestamp is at most two minutes old, at most 15 seconds ahead;
  // transaction lifetime <= ten minutes, with at least 15 seconds to review.
  if (timestamp <= 0n || timestamp < now - 120_000n || timestamp > now + 15_000n
    || expiration <= timestamp || expiration > timestamp + 600_000n
    || expiration <= now + 15_000n) throw new Error('stale_preparation');
  if (typeof p.refBlockBytesHex !== 'string' || !/^[0-9a-f]{4}$/.test(p.refBlockBytesHex)
    || typeof p.refBlockHashHex !== 'string' || !/^[0-9a-f]{16}$/.test(p.refBlockHashHex)
    || typeof p.refBlockId !== 'string' || !/^[0-9a-f]{64}$/.test(p.refBlockId)) throw new Error('invalid_tapos');
  const block = BigInt(p.refBlockNumber);
  if (block === 0n || BigInt(`0x${p.refBlockId.slice(0, 16)}`) !== block
    || p.refBlockBytesHex !== (block & 65535n).toString(16).padStart(4, '0')
    || p.refBlockHashHex !== p.refBlockId.slice(16, 32)) throw new Error('invalid_tapos');
}

function quantity(value: string, max = (1n << 63n) - 1n): bigint {
  if (typeof value !== 'string' || value.length > 78 || !/^(0|[1-9]\d*)$/.test(value)) throw new Error('invalid_quantity');
  const number = BigInt(value);
  if (number > max) throw new Error('invalid_quantity');
  return number;
}

function varint(value: bigint): Uint8Array {
  const out: number[] = [];
  do { const byte = Number(value & 127n); value >>= 7n; out.push(byte | (value ? 128 : 0)); } while (value);
  return Uint8Array.from(out);
}
function bytesField(tag: number, value: Uint8Array): Uint8Array {
  return concatBytes(varint(BigInt(tag * 8 + 2)), varint(BigInt(value.length)), value);
}
function intField(tag: number, value: bigint): Uint8Array {
  return concatBytes(varint(BigInt(tag * 8)), varint(value));
}
