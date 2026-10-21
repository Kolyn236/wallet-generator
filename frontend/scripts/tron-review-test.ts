import assert from 'node:assert/strict';
import * as transaction from '../src/wallet/tronTransaction.ts';
import {deriveTronWallet, TRON_USDT_CONTRACT} from '../src/wallet/tron.ts';
assert.equal(typeof transaction.prepareUnsignedTronTransfer, 'function', 'review must serialize and validate without signing');
const wallet = deriveTronWallet('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
export const now = 1700000001000;
export const prepared = {
  chain: 'tron' as const, network: 'mainnet' as const, networkId: 'tron-mainnet' as const, assetRouteId: 'usdt-tron-mainnet-trc20' as const,
  from: wallet.address, to: TRON_USDT_CONTRACT, amountBaseUnits: '1500000', contractAddress: TRON_USDT_CONTRACT, decimals: 6 as const,
  refBlockBytesHex: '5678', refBlockHashHex: '1122334455667788', refBlockNumber: '305419896', refBlockId: '00000000123456781122334455667788' + '00'.repeat(16),
  timestampMs: '1700000000000', expirationMs: '1700000060000', feeLimitSun: '30000000', energyEstimate: '65000', energyPriceSun: '100', bandwidthPriceSun: '1000', senderTrxSun: '100000000', senderTokenBalanceBaseUnits: '10000000', recipientActive: true,
};
export const input = {sourceAddress: wallet.address, recipientAddress: prepared.to, amount: '1.5', prepared, nowMs: now};
const review = transaction.prepareUnsignedTronTransfer(input);
assert.equal('signatureHex' in review, false);
assert.equal('rawTransactionHex' in review, false);
assert.equal('privateKey' in review, false);
const signed = transaction.buildSignedTronTransfer({...input, privateKey: wallet.privateKey});
for (const [field, value] of Object.entries(review)) assert.deepEqual(signed[field], value, `signed bytes must match review: ${field}`);
assert.throws(() => transaction.prepareUnsignedTronTransfer({...input, prepared: {...prepared, to: wallet.address}}), /prepared_transaction_mismatch/);
assert.throws(() => transaction.prepareUnsignedTronTransfer({...input, nowMs: Number(prepared.expirationMs)}), /stale_preparation/);
assert.throws(() => transaction.prepareUnsignedTronTransfer({...input, prepared: {...prepared, senderTrxSun: '1'}}), /insufficient_funds/);
console.log('TRON unsigned review matches signed raw data/TXID and validates before signing.');
