import assert from 'node:assert/strict';
import {
  deriveTronWallet,
  decodeTronAddress,
  encodeTronAddress,
  encodeTrc20Transfer,
  encodeTronRawData,
  computeTronTxId,
  signTronRawData,
  TRON_USDT_CONTRACT_HEX,
} from '../src/wallet/tron.ts';

const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const wallet = deriveTronWallet(mnemonic);
assert.equal(wallet.derivationPath, "m/44'/195'/0'/0/0");
assert.deepEqual(decodeTronAddress(wallet.addressBase58).payload, decodeTronAddress(encodeTronAddress(wallet.addressHex)).payload);
assert.throws(() => decodeTronAddress(wallet.addressBase58.slice(0, -1) + '1'), /invalid_address/);
const transfer = encodeTrc20Transfer(wallet.addressBase58, 1234567n);
assert.equal(transfer.selector, 'a9059cbb');
assert.equal(transfer.dataHex.length, 136);
assert.throws(() => encodeTrc20Transfer(wallet.addressBase58, 0n), /invalid_amount/);
const raw = encodeTronRawData({
  ownerAddressHex: wallet.addressHex,
  contractAddressHex: TRON_USDT_CONTRACT_HEX,
  dataHex: transfer.dataHex,
  refBlockBytesHex: '1234',
  refBlockHashHex: '0011223344556677',
  timestampMs: '1700000000000',
  expirationMs: '1700000600000',
  feeLimitSun: '100000000',
});
const signed = signTronRawData(raw, wallet.privateKey);
assert.equal(signed.txId, computeTronTxId(raw));
assert.equal(signed.signatureHex.length, 130);
assert.equal(signed.rawTransactionHex.length > raw.length * 2, true);
console.log('Tron deterministic wallet, ABI, protobuf and signing vectors passed.');
