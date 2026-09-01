import assert from 'node:assert/strict';
import {
  buildSignedUsdtErc20Transfer,
  buildUsdtErc20TransferData,
  formatUsdtSmallestUnit,
  parseUsdtToSmallestUnit,
  USDT_ERC20_CONTRACT,
} from '../src/wallet/usdtErc20.ts';

const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const SOURCE = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';
const RECIPIENT = '0x2222222222222222222222222222222222222222';
const AMOUNT = '1.5';
const AMOUNT_SMALLEST_UNIT = '1500000';
const EXPECTED_TRANSFER_DATA = '0xa9059cbb0000000000000000000000002222222222222222222222222222222222222222000000000000000000000000000000000000000000000000000000000016e360';

assert.equal(parseUsdtToSmallestUnit('1'), '1000000');
assert.equal(parseUsdtToSmallestUnit('1.000001'), '1000001');
assert.equal(parseUsdtToSmallestUnit(AMOUNT), AMOUNT_SMALLEST_UNIT);
assert.equal(formatUsdtSmallestUnit('1000001'), '1.000001');
assert.equal(formatUsdtSmallestUnit(AMOUNT_SMALLEST_UNIT), AMOUNT);
assert.throws(() => parseUsdtToSmallestUnit('0'), /invalid_amount/);
assert.throws(() => parseUsdtToSmallestUnit('0.0000001'), /invalid_amount/);
assert.equal(
  buildUsdtErc20TransferData(RECIPIENT, AMOUNT_SMALLEST_UNIT),
  EXPECTED_TRANSFER_DATA,
);

const prepared = {
  chain: 'ethereum' as const,
  network: 'mainnet' as const,
  chainId: 1 as const,
  from: SOURCE,
  to: USDT_ERC20_CONTRACT,
  valueWei: '0',
  data: EXPECTED_TRANSFER_DATA,
  senderBalanceWei: '1000000000000000000',
  nonce: '7',
  gasLimit: '65000',
  feePolicy: {
    kind: 'eip1559' as const,
    baseFeePerGasWei: '15000000000',
    maxPriorityFeePerGasWei: '1000000000',
    maxFeePerGasWei: '31000000000',
  },
};

const first = buildSignedUsdtErc20Transfer({
  privateKey: PRIVATE_KEY,
  sourceAddress: SOURCE,
  recipientAddress: RECIPIENT,
  amountUsdt: AMOUNT,
  tokenBalanceSmallestUnit: '10000000',
  prepared,
});
const second = buildSignedUsdtErc20Transfer({
  privateKey: PRIVATE_KEY,
  sourceAddress: SOURCE,
  recipientAddress: RECIPIENT,
  amountUsdt: AMOUNT,
  tokenBalanceSmallestUnit: '10000000',
  prepared,
});

assert.equal(first.to.toLowerCase(), USDT_ERC20_CONTRACT.toLowerCase());
assert.equal(first.valueWei, '0');
assert.equal(first.data, EXPECTED_TRANSFER_DATA);
assert.equal(first.recipientAddress, RECIPIENT);
assert.equal(first.amountUsdt, AMOUNT);
assert.equal(first.amountSmallestUnit, AMOUNT_SMALLEST_UNIT);
assert.equal(first.maxNetworkFeeWei, '2015000000000000');
assert.equal(first.maxNetworkFeeEth, '0.002015');
assert.match(first.rawTransaction, /^0x02[0-9a-f]+$/);
assert.match(first.txHash, /^0x[0-9a-f]{64}$/);
assert.equal(second.rawTransaction, first.rawTransaction);
assert.equal(second.txHash, first.txHash);

assert.throws(
  () => buildSignedUsdtErc20Transfer({
    privateKey: PRIVATE_KEY,
    sourceAddress: SOURCE,
    recipientAddress: RECIPIENT,
    amountUsdt: '11',
    tokenBalanceSmallestUnit: '10000000',
    prepared: {
      ...prepared,
      data: buildUsdtErc20TransferData(RECIPIENT, '11000000'),
    },
  }),
  /insufficient_token_funds/,
);

console.log('USDT ERC-20 amount, calldata and Type-2 signing vectors passed.');
