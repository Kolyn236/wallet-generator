import {
  assertPreparedIntent,
  signPreparedEip1559Transaction,
  type PreparedEthereumTransactionData,
  type SignedEip1559Transaction,
} from './ethereumTransaction';
import {
  ethereumPrivateKeyMatchesAddress,
  isEthereumMainnetAddress,
  normalizeEthereumPrivateKey,
} from './ethereum';

export const USDT_ERC20_CONTRACT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
export const USDT_ERC20_DECIMALS = 6;
export const USDT_ERC20_TRANSFER_SELECTOR = 'a9059cbb';

const USDT_BASE_UNITS = 1_000_000n;
const UINT256_MAX = (1n << 256n) - 1n;

export type SignedUsdtErc20Transfer = SignedEip1559Transaction & {
  recipientAddress: string;
  amountUsdt: string;
  amountSmallestUnit: string;
  tokenBalanceSmallestUnit: string;
};

export function parseUsdtToSmallestUnit(amount: string): string {
  const normalized = amount.trim();
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,6}))?$/.exec(normalized);
  if (!match) throw new Error('invalid_amount');

  const whole = BigInt(match[1]);
  const fraction = (match[2] ?? '').padEnd(USDT_ERC20_DECIMALS, '0');
  const value = whole * USDT_BASE_UNITS + BigInt(fraction || '0');

  if (value <= 0n || value > UINT256_MAX) throw new Error('invalid_amount');
  return value.toString();
}

export function formatUsdtSmallestUnit(value: string): string {
  if (!/^(0|[1-9]\d*)$/.test(value)) throw new Error('invalid_token_amount');
  const amount = BigInt(value);
  if (amount > UINT256_MAX) throw new Error('invalid_token_amount');

  const whole = amount / USDT_BASE_UNITS;
  const remainder = amount % USDT_BASE_UNITS;
  if (remainder === 0n) return whole.toString();

  const fraction = remainder
    .toString()
    .padStart(USDT_ERC20_DECIMALS, '0')
    .replace(/0+$/, '');
  return `${whole}.${fraction}`;
}

export function buildUsdtErc20TransferData(recipientAddress: string, amountSmallestUnit: string): string {
  if (!isEthereumMainnetAddress(recipientAddress)) throw new Error('invalid_recipient');
  if (!/^(0|[1-9]\d*)$/.test(amountSmallestUnit)) throw new Error('invalid_amount');

  const amount = BigInt(amountSmallestUnit);
  if (amount <= 0n || amount > UINT256_MAX) throw new Error('invalid_amount');

  const recipientWord = recipientAddress.slice(2).toLowerCase().padStart(64, '0');
  const amountWord = amount.toString(16).padStart(64, '0');

  return `0x${USDT_ERC20_TRANSFER_SELECTOR}${recipientWord}${amountWord}`;
}

export function buildSignedUsdtErc20Transfer(input: {
  privateKey: string;
  sourceAddress: string;
  recipientAddress: string;
  amountUsdt: string;
  tokenBalanceSmallestUnit: string;
  prepared: PreparedEthereumTransactionData;
}): SignedUsdtErc20Transfer {
  const source = input.sourceAddress.trim();
  const recipient = input.recipientAddress.trim();
  if (!isEthereumMainnetAddress(source)) throw new Error('invalid_sender');
  if (!isEthereumMainnetAddress(recipient)) throw new Error('invalid_recipient');
  if (source.toLowerCase() === recipient.toLowerCase()) throw new Error('same_address');

  if (!ethereumPrivateKeyMatchesAddress(input.privateKey, source)) {
    normalizeEthereumPrivateKey(input.privateKey);
    throw new Error('wallet_key_mismatch');
  }

  const amountSmallestUnit = parseUsdtToSmallestUnit(input.amountUsdt);
  if (!/^(0|[1-9]\d*)$/.test(input.tokenBalanceSmallestUnit)) {
    throw new Error('invalid_token_balance');
  }
  const tokenBalance = BigInt(input.tokenBalanceSmallestUnit);
  if (BigInt(amountSmallestUnit) > tokenBalance) throw new Error('insufficient_token_funds');

  const data = buildUsdtErc20TransferData(recipient, amountSmallestUnit);
  assertPreparedIntent(input.prepared, source, USDT_ERC20_CONTRACT, '0', data);

  const signed = signPreparedEip1559Transaction({
    privateKey: input.privateKey,
    sourceAddress: source,
    prepared: input.prepared,
  });

  return {
    ...signed,
    recipientAddress: recipient,
    amountUsdt: formatUsdtSmallestUnit(amountSmallestUnit),
    amountSmallestUnit,
    tokenBalanceSmallestUnit: tokenBalance.toString(),
  };
}
