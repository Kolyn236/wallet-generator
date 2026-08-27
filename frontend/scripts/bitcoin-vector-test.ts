import assert from 'node:assert/strict';
import { deriveBitcoinWalletFromMnemonic, isBitcoinMainnetAddress } from '../src/wallet/bitcoin.ts';

const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const wallet = deriveBitcoinWalletFromMnemonic(mnemonic);

assert.equal(wallet.derivationPath, "m/44'/0'/0'/0/0");
assert.equal(wallet.address, '1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA');
assert.equal(wallet.wif, 'L4p2b9VAf8k5aUahF1JCJUzZkgNEAqLfq8DDdQiyAprQAKSbu8hf');
assert.equal(isBitcoinMainnetAddress(wallet.address), true);
assert.equal(isBitcoinMainnetAddress('1BoatSLRHtKNngkdXEeobR76b53LETtpyU'), false);

console.log('Bitcoin BIP39/BIP44 deterministic vector passed.');
