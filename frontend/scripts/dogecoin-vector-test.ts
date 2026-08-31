import assert from 'node:assert/strict';
import { deriveDogecoinWalletFromMnemonic, isDogecoinMainnetAddress } from '../src/wallet/dogecoin.ts';
import { buildSignedDogecoinTransfer } from '../src/wallet/dogecoinTransaction.ts';

const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const wallet = deriveDogecoinWalletFromMnemonic(mnemonic);

assert.equal(wallet.derivationPath, "m/44'/3'/0'/0/0");
assert.equal(wallet.address, 'DBus3bamQjgJULBJtYXpEzDWQRwF5iwxgC');
assert.equal(wallet.wif, 'QPkeC1ZfHx3c9g7WTj9cQ8gnvk2iSAfAcbq1aVAWjNTwDAKfZUzx');
assert.equal(isDogecoinMainnetAddress(wallet.address), true);
assert.equal(isDogecoinMainnetAddress('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA'), false);

const signed = buildSignedDogecoinTransfer({
  wif: wallet.wif,
  sourceAddress: wallet.address,
  recipientAddress: 'DAcDAtJRztxBHyA6D6h8du1HguyTR43Mas',
  amount: '1.00000000',
  feeRateDogePerKb: '0.01000000',
  utxos: [{
    txid: '11'.repeat(32),
    vout: 0,
    valueSmallestUnit: '200000000',
    scriptPubKey: '76a9144a483568665dcdfa68dd58a1f62893448a64333988ac',
    confirmations: 1,
  }],
});

assert.equal(signed.sizeBytes, 225);
assert.equal(signed.amountKoinu, '100000000');
assert.equal(signed.feeKoinu, '226000');
assert.equal(signed.changeKoinu, '99774000');
assert.equal(signed.txid, 'd5999cea03d9f694d9631e466f524ead6a4450ca0fa67572f018a9137fffe598');
assert.equal(
  signed.rawTransaction,
  '01000000011111111111111111111111111111111111111111111111111111111111111111000000006a473044022033e7dfd8a429f8000a71157e8cb9df2fde45874559d276e1d5b71ff60823ecc402200e2d814735d2ca228b0fa012f3ffad1142b88b957ec61c996d5fb2a25aee7946012102cc6b0dc33aabcf3a23643e5e2919a80c50fb3dd2129ce409bbc5f0d4643d05e0ffffffff0200e1f505000000001976a9143bf96544e911ca728f5fabf5a4f3b65deab684c488ac306ef205000000001976a9144a483568665dcdfa68dd58a1f62893448a64333988ac00000000',
);

console.log('Dogecoin deterministic derivation and signing vectors passed.');
