import assert from 'node:assert/strict';
import {
  deriveBitcoinWalletFromMnemonic,
  isBitcoinMainnetAddress,
  isBitcoinMainnetP2wpkhAddress,
  isBitcoinMainnetTransferRecipientAddress,
  isBitcoinMainnetWatchOnlyAddress,
} from '../src/wallet/bitcoin.ts';
import { buildSignedBitcoinTransfer } from '../src/wallet/bitcoinTransaction.ts';

const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const wallet = deriveBitcoinWalletFromMnemonic(mnemonic);

assert.equal(wallet.derivationPath, "m/44'/0'/0'/0/0");
assert.equal(wallet.address, '1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA');
assert.equal(wallet.wif, 'L4p2b9VAf8k5aUahF1JCJUzZkgNEAqLfq8DDdQiyAprQAKSbu8hf');
assert.equal(isBitcoinMainnetAddress(wallet.address), true);
assert.equal(isBitcoinMainnetAddress('1BoatSLRHtKNngkdXEeobR76b53LETtpyU'), false);
assert.equal(isBitcoinMainnetWatchOnlyAddress(wallet.address), true);
assert.equal(isBitcoinMainnetAddress('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy'), false);
assert.equal(isBitcoinMainnetWatchOnlyAddress('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy'), true);

const p2wpkhRecipient = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
assert.equal(isBitcoinMainnetAddress(p2wpkhRecipient), false);
assert.equal(isBitcoinMainnetP2wpkhAddress(p2wpkhRecipient), true);
assert.equal(isBitcoinMainnetTransferRecipientAddress(p2wpkhRecipient), true);
assert.equal(isBitcoinMainnetP2wpkhAddress('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'), false);
assert.equal(isBitcoinMainnetTransferRecipientAddress('bc1p5cyxnuxmeuwuvkwfem96llyxf4l7r3k7s0rj9d'), false);

const signed = buildSignedBitcoinTransfer({
  wif: wallet.wif,
  sourceAddress: wallet.address,
  recipientAddress: '1BoatSLRHtKNngkdXEeobR76b53LETtpyT',
  amount: '0.00050000',
  feeRateBtcPerKb: '0.00010000',
  utxos: [{
    txid: '11'.repeat(32),
    vout: 0,
    valueSmallestUnit: '100000',
    scriptPubKey: '76a914d986ed01b7a22225a70edbf2ba7cfb63a15cb3aa88ac',
    confirmations: 1,
  }],
});

assert.equal(signed.sizeBytes, 226);
assert.equal(signed.amountSatoshis, '50000');
assert.equal(signed.feeSatoshis, '2260');
assert.equal(signed.changeSatoshis, '47740');
assert.equal(signed.txid, '6b306a8d523908410151804d26b604b488f5af819d9f22e204921adf28556d5e');
assert.equal(
  signed.rawTransaction,
  '01000000011111111111111111111111111111111111111111111111111111111111111111000000006b483045022100959391e4e023e1967739363a8c21e84984b77e08905ce3994247f5d65348ea7602206eede82971e02f28571e9eed6aa266e8eefb5413d1d57b9a42e9c4a5d8a67af9012103aaeb52dd7494c361049de67cc680e83ebcbbbdbeb13637d92cd845f70308af5effffffff0250c30000000000001976a9147680adec8eabcabac676be9e83854ade0bd22cdb88ac7cba0000000000001976a914d986ed01b7a22225a70edbf2ba7cfb63a15cb3aa88ac00000000',
);

const p2wpkhSigned = buildSignedBitcoinTransfer({
  wif: wallet.wif,
  sourceAddress: wallet.address,
  recipientAddress: p2wpkhRecipient,
  amount: '0.00050000',
  feeRateBtcPerKb: '0.00010000',
  utxos: [{
    txid: '11'.repeat(32),
    vout: 0,
    valueSmallestUnit: '100000',
    scriptPubKey: '76a914d986ed01b7a22225a70edbf2ba7cfb63a15cb3aa88ac',
    confirmations: 1,
  }],
});

assert.equal(p2wpkhSigned.sizeBytes, 223);
assert.equal(p2wpkhSigned.amountSatoshis, '50000');
assert.equal(p2wpkhSigned.feeSatoshis, '2230');
assert.equal(p2wpkhSigned.changeSatoshis, '47770');
assert.equal(p2wpkhSigned.txid, '5709ec938467955f93862140900b68ec57b3148d02d7a2dd67d3ddc4fc06ade1');
assert.equal(
  p2wpkhSigned.rawTransaction,
  '01000000011111111111111111111111111111111111111111111111111111111111111111000000006b483045022100cad633b8c5d3db5e9522db2cc2fc0027a0c983df2bcf8e53b393b178a2956fac022078faef3e75bf3348edb05919a1aded63270d9204fb743ffa4a80d825ce524e2b012103aaeb52dd7494c361049de67cc680e83ebcbbbdbeb13637d92cd845f70308af5effffffff0250c3000000000000160014751e76e8199196d454941c45d1b3a323f1433bd69aba0000000000001976a914d986ed01b7a22225a70edbf2ba7cfb63a15cb3aa88ac00000000',
);

console.log('Bitcoin deterministic derivation and P2PKH/P2WPKH recipient signing vectors passed.');
