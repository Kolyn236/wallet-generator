import assert from 'node:assert/strict';
import { deriveLitecoinWalletFromMnemonic, isLitecoinMainnetAddress } from '../src/wallet/litecoin.ts';

const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const first = deriveLitecoinWalletFromMnemonic(mnemonic);
const second = deriveLitecoinWalletFromMnemonic(mnemonic);

assert.equal(first.derivationPath, "m/44'/2'/0'/0/0");
assert.equal(first.address, second.address);
assert.equal(first.wif, second.wif);
assert.ok(first.address.startsWith('L'));
assert.ok(isLitecoinMainnetAddress(first.address));
assert.ok(first.wif.startsWith('T'));
assert.equal(first.mnemonic, mnemonic);

console.log(`Litecoin vector OK: ${first.address}`);
