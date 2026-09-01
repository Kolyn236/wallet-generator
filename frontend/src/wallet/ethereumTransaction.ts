import { secp256k1 } from '@noble/curves/secp256k1.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { bytesToHex, concatBytes, hexToBytes } from '@noble/hashes/utils.js';
import {
  ethereumPrivateKeyMatchesAddress,
  isEthereumMainnetAddress,
  normalizeEthereumPrivateKey,
} from './ethereum';

const ETHEREUM_CHAIN_ID = 1n;
const WEI_PER_ETH = 1_000_000_000_000_000_000n;
const WEI_PER_GWEI = 1_000_000_000n;
const UINT256_MAX = (1n << 256n) - 1n;

export type PreparedEthereumTransactionData = {
  chain: 'ethereum';
  network: 'mainnet';
  chainId: 1;
  from: string;
  to: string;
  valueWei: string;
  data: string;
  senderBalanceWei: string;
  nonce: string;
  gasLimit: string;
  feePolicy: {
    kind: 'eip1559';
    baseFeePerGasWei: string;
    maxPriorityFeePerGasWei: string;
    maxFeePerGasWei: string;
  };
};

export type Eip1559TransactionFields = {
  chainId: string;
  nonce: string;
  maxPriorityFeePerGasWei: string;
  maxFeePerGasWei: string;
  gasLimit: string;
  to: string;
  valueWei: string;
  data: string;
};

export type Eip1559Signature = {
  yParity: 0 | 1;
  r: string;
  s: string;
};

export type SignedEip1559Transaction = Eip1559TransactionFields & {
  from: string;
  senderBalanceWei: string;
  baseFeePerGasWei: string;
  maxPriorityFeePerGasGwei: string;
  maxFeePerGasGwei: string;
  maxNetworkFeeWei: string;
  maxNetworkFeeEth: string;
  maxTotalWei: string;
  maxTotalEth: string;
  rawTransaction: string;
  txHash: string;
};

export type SignedEthereumTransfer = SignedEip1559Transaction & {
  amountEth: string;
};

type RlpValue = Uint8Array | RlpValue[];

export function parseEthToWei(amount: string): string {
  const normalized = amount.trim();
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,18}))?$/.exec(normalized);
  if (!match) throw new Error('invalid_amount');

  const whole = BigInt(match[1]);
  const fraction = (match[2] ?? '').padEnd(18, '0');
  const wei = whole * WEI_PER_ETH + BigInt(fraction || '0');

  if (wei <= 0n || wei > UINT256_MAX) throw new Error('invalid_amount');
  return wei.toString();
}

export function formatWeiToEth(valueWei: string): string {
  return formatUnit(valueWei, WEI_PER_ETH, 18);
}

export function formatWeiToGwei(valueWei: string): string {
  return formatUnit(valueWei, WEI_PER_GWEI, 9);
}

export function hashRawEthereumTransaction(rawTransaction: string): string {
  const bytes = strictHexBytes(rawTransaction, 'invalid_transaction');
  if (bytes.length === 0 || bytes[0] !== 0x02) throw new Error('invalid_transaction');

  return `0x${bytesToHex(keccak_256(bytes))}`;
}

export function serializeEip1559Transaction(
  fields: Eip1559TransactionFields,
  signature: Eip1559Signature,
): string {
  const encoded = rlpEncode([
    decimalIntegerBytes(fields.chainId, 'invalid_chain_id'),
    decimalIntegerBytes(fields.nonce, 'invalid_nonce'),
    decimalIntegerBytes(fields.maxPriorityFeePerGasWei, 'invalid_fee'),
    decimalIntegerBytes(fields.maxFeePerGasWei, 'invalid_fee'),
    decimalIntegerBytes(fields.gasLimit, 'invalid_gas_limit'),
    ethereumAddressBytes(fields.to),
    decimalIntegerBytes(fields.valueWei, 'invalid_amount'),
    strictHexBytes(fields.data, 'invalid_data'),
    [],
    integerBytes(BigInt(signature.yParity)),
    signatureScalarBytes(signature.r),
    signatureScalarBytes(signature.s),
  ]);

  return `0x02${bytesToHex(encoded)}`;
}

export function signPreparedEip1559Transaction(input: {
  privateKey: string;
  sourceAddress: string;
  prepared: PreparedEthereumTransactionData;
}): SignedEip1559Transaction {
  const source = input.sourceAddress.trim();
  if (!isEthereumMainnetAddress(source)) throw new Error('invalid_sender');
  if (!ethereumPrivateKeyMatchesAddress(input.privateKey, source)) {
    normalizeEthereumPrivateKey(input.privateKey);
    throw new Error('wallet_key_mismatch');
  }

  assertPreparedEnvelope(input.prepared, source);

  const nonce = decimalBigInt(input.prepared.nonce, 'invalid_nonce');
  const gasLimit = decimalBigInt(input.prepared.gasLimit, 'invalid_gas_limit');
  const valueWei = decimalBigInt(input.prepared.valueWei, 'invalid_amount');
  const maxPriorityFeePerGas = decimalBigInt(input.prepared.feePolicy.maxPriorityFeePerGasWei, 'invalid_fee');
  const maxFeePerGas = decimalBigInt(input.prepared.feePolicy.maxFeePerGasWei, 'invalid_fee');
  const senderBalance = decimalBigInt(input.prepared.senderBalanceWei, 'invalid_balance');

  if (gasLimit <= 0n || maxFeePerGas <= 0n || maxPriorityFeePerGas < 0n) {
    throw new Error('invalid_fee');
  }
  if (maxFeePerGas < maxPriorityFeePerGas) throw new Error('invalid_fee');

  const maxNetworkFee = gasLimit * maxFeePerGas;
  const maxTotal = valueWei + maxNetworkFee;
  if (maxTotal > senderBalance) throw new Error('insufficient_funds');

  const fields: Eip1559TransactionFields = {
    chainId: ETHEREUM_CHAIN_ID.toString(),
    nonce: nonce.toString(),
    maxPriorityFeePerGasWei: maxPriorityFeePerGas.toString(),
    maxFeePerGasWei: maxFeePerGas.toString(),
    gasLimit: gasLimit.toString(),
    to: input.prepared.to,
    valueWei: valueWei.toString(),
    data: input.prepared.data,
  };

  const signingPayload = concatBytes(Uint8Array.of(0x02), rlpEncode(unsignedFields(fields)));
  const signingHash = keccak_256(signingPayload);
  const privateKeyBytes = normalizeEthereumPrivateKey(input.privateKey);

  try {
    const recoveredSignature = secp256k1.sign(signingHash, privateKeyBytes, {
      prehash: false,
      lowS: true,
      format: 'recovered',
    });
    if (recoveredSignature.length !== 65) throw new Error('signing_failed');

    const recovery = recoveredSignature[0];
    if (recovery !== 0 && recovery !== 1) throw new Error('unsupported_recovery_id');

    const rawTransaction = serializeEip1559Transaction(fields, {
      yParity: recovery,
      r: `0x${bytesToHex(recoveredSignature.subarray(1, 33))}`,
      s: `0x${bytesToHex(recoveredSignature.subarray(33, 65))}`,
    });

    return {
      ...fields,
      from: source,
      senderBalanceWei: senderBalance.toString(),
      baseFeePerGasWei: input.prepared.feePolicy.baseFeePerGasWei,
      maxPriorityFeePerGasGwei: formatWeiToGwei(maxPriorityFeePerGas.toString()),
      maxFeePerGasGwei: formatWeiToGwei(maxFeePerGas.toString()),
      maxNetworkFeeWei: maxNetworkFee.toString(),
      maxNetworkFeeEth: formatWeiToEth(maxNetworkFee.toString()),
      maxTotalWei: maxTotal.toString(),
      maxTotalEth: formatWeiToEth(maxTotal.toString()),
      rawTransaction,
      txHash: hashRawEthereumTransaction(rawTransaction),
    };
  } finally {
    privateKeyBytes.fill(0);
  }
}

export function buildSignedEthereumTransfer(input: {
  privateKey: string;
  sourceAddress: string;
  recipientAddress: string;
  amountEth: string;
  prepared: PreparedEthereumTransactionData;
}): SignedEthereumTransfer {
  const source = input.sourceAddress.trim();
  const recipient = input.recipientAddress.trim();
  if (!isEthereumMainnetAddress(source)) throw new Error('invalid_sender');
  if (!isEthereumMainnetAddress(recipient)) throw new Error('invalid_recipient');
  if (source.toLowerCase() === recipient.toLowerCase()) throw new Error('same_address');

  const valueWei = parseEthToWei(input.amountEth);
  assertPreparedIntent(input.prepared, source, recipient, valueWei, '0x');
  const signed = signPreparedEip1559Transaction({
    privateKey: input.privateKey,
    sourceAddress: source,
    prepared: input.prepared,
  });

  return {
    ...signed,
    amountEth: formatWeiToEth(valueWei),
  };
}

export function assertPreparedIntent(
  prepared: PreparedEthereumTransactionData,
  source: string,
  to: string,
  valueWei: string,
  data: string,
): void {
  assertPreparedEnvelope(prepared, source);

  if (prepared.to.toLowerCase() !== to.toLowerCase()
    || prepared.valueWei !== valueWei
    || prepared.data.toLowerCase() !== data.toLowerCase()
  ) {
    throw new Error('prepared_transaction_mismatch');
  }
}

function assertPreparedEnvelope(prepared: PreparedEthereumTransactionData, source: string): void {
  if (prepared.chain !== 'ethereum'
    || prepared.network !== 'mainnet'
    || prepared.chainId !== 1
    || prepared.feePolicy.kind !== 'eip1559'
    || prepared.from.toLowerCase() !== source.toLowerCase()
    || !isEthereumMainnetAddress(prepared.to)
  ) {
    throw new Error('prepared_transaction_mismatch');
  }

  strictHexBytes(prepared.data, 'prepared_transaction_mismatch');
}

function unsignedFields(fields: Eip1559TransactionFields): RlpValue[] {
  return [
    decimalIntegerBytes(fields.chainId, 'invalid_chain_id'),
    decimalIntegerBytes(fields.nonce, 'invalid_nonce'),
    decimalIntegerBytes(fields.maxPriorityFeePerGasWei, 'invalid_fee'),
    decimalIntegerBytes(fields.maxFeePerGasWei, 'invalid_fee'),
    decimalIntegerBytes(fields.gasLimit, 'invalid_gas_limit'),
    ethereumAddressBytes(fields.to),
    decimalIntegerBytes(fields.valueWei, 'invalid_amount'),
    strictHexBytes(fields.data, 'invalid_data'),
    [],
  ];
}

function formatUnit(value: string, divisor: bigint, decimals: number): string {
  const amount = decimalBigInt(value, 'invalid_quantity');
  const whole = amount / divisor;
  const remainder = amount % divisor;
  if (remainder === 0n) return whole.toString();

  const fraction = remainder.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole}.${fraction}`;
}

function decimalBigInt(value: string, error: string): bigint {
  if (!/^(0|[1-9]\d*)$/.test(value)) throw new Error(error);
  const result = BigInt(value);
  if (result > UINT256_MAX) throw new Error(error);
  return result;
}

function decimalIntegerBytes(value: string, error: string): Uint8Array {
  return integerBytes(decimalBigInt(value, error));
}

function integerBytes(value: bigint): Uint8Array {
  if (value < 0n) throw new Error('invalid_integer');
  if (value === 0n) return new Uint8Array();

  let hex = value.toString(16);
  if (hex.length % 2 !== 0) hex = `0${hex}`;
  return hexToBytes(hex);
}

function ethereumAddressBytes(address: string): Uint8Array {
  if (!isEthereumMainnetAddress(address)) throw new Error('invalid_recipient');
  return hexToBytes(address.slice(2));
}

function strictHexBytes(value: string, error: string): Uint8Array {
  if (!/^0x(?:[0-9a-fA-F]{2})*$/.test(value)) throw new Error(error);
  return value.length === 2 ? new Uint8Array() : hexToBytes(value.slice(2));
}

function signatureScalarBytes(value: string): Uint8Array {
  if (!/^0x[0-9a-fA-F]{1,64}$/.test(value)) throw new Error('invalid_signature');
  const scalar = BigInt(value);
  if (scalar <= 0n || scalar > UINT256_MAX) throw new Error('invalid_signature');
  return integerBytes(scalar);
}

function rlpEncode(value: RlpValue): Uint8Array {
  if (Array.isArray(value)) {
    const payload = concatBytes(...value.map(rlpEncode));
    return concatBytes(rlpLengthPrefix(payload.length, 0xc0), payload);
  }

  if (value.length === 1 && value[0] < 0x80) return value;
  return concatBytes(rlpLengthPrefix(value.length, 0x80), value);
}

function rlpLengthPrefix(length: number, offset: number): Uint8Array {
  if (length <= 55) return Uint8Array.of(offset + length);

  const lengthBytes = integerBytes(BigInt(length));
  return concatBytes(Uint8Array.of(offset + 55 + lengthBytes.length), lengthBytes);
}
