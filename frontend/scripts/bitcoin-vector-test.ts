import assert from 'node:assert/strict';
import { deriveBitcoinWalletFromMnemonic, isBitcoinMainnetAddress } from '../src/wallet/bitcoin.ts';
import { buildSignedBitcoinTransfer } from '../src/wallet/bitcoinTransaction.ts';

const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const wallet = deriveBitcoinWalletFromMnemonic(mnemonic);

assert.equal(wallet.derivationPath, "m/44'/0'/0'/0/0");
assert.equal(wallet.address, '1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA');
assert.equal(wallet.wif, 'L4p2b9VAf8k5aUahF1JCJUzZkgNEAqLfq8DDdQiyAprQAKSbu8hf');
assert.equal(isBitcoinMainnetAddress(wallet.address), true);
assert.equal(isBitcoinMainnetAddress('1BoatSLRHtKNngkdXEeobR76b53LETtpyU'), false);

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

console.log('Bitcoin deterministic derivation and signing vectors passed.');
