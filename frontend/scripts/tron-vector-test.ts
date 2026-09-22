import assert from 'node:assert/strict';
import { decodeTronAddress, deriveTronWallet, encodeTrc20Transfer, encodeTronAddress } from '../src/wallet/tron.ts';

// Public, unfunded deterministic fixture from the implementation research artifact.
const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const wallet = deriveTronWallet(mnemonic);
assert.equal(wallet.derivationPath, "m/44'/195'/0'/0/0");
assert.equal(wallet.addressBase58, 'TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH');
assert.equal(encodeTronAddress(wallet.addressHex), wallet.addressBase58);
assert.equal(decodeTronAddress(wallet.addressBase58).hex, wallet.addressHex);
const transfer = encodeTrc20Transfer(wallet.addressBase58, 1234567n);
assert.equal(transfer.selector, 'a9059cbb');
assert.equal(transfer.dataHex.length, 136);
assert.equal(transfer.dataHex.slice(0, 8), 'a9059cbb');
assert.throws(() => encodeTrc20Transfer(wallet.addressBase58, 0n), /invalid_amount/);
assert.throws(() => decodeTronAddress(wallet.addressBase58.slice(0, -1) + '1'), /invalid_tron_address/);
console.log('Tron deterministic wallet, Base58Check and TRC-20 ABI vectors passed.');
