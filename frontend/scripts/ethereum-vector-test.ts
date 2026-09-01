import assert from 'node:assert/strict';
import {
  deriveEthereumWalletFromMnemonic,
  ethereumAddressFromPrivateKey,
} from '../src/wallet/ethereum.ts';
import {
  formatWeiToEth,
  formatWeiToGwei,
  hashRawEthereumTransaction,
  parseEthToWei,
  serializeEip1559Transaction,
} from '../src/wallet/ethereumTransaction.ts';

const HARDHAT_MNEMONIC = 'test test test test test test test test test test test junk';
const HARDHAT_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const HARDHAT_ADDRESS = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';

const wallet = deriveEthereumWalletFromMnemonic(HARDHAT_MNEMONIC);
assert.equal(wallet.derivationPath, "m/44'/60'/0'/0/0");
assert.equal(wallet.privateKey, HARDHAT_PRIVATE_KEY);
assert.equal(wallet.address, HARDHAT_ADDRESS);
assert.equal(ethereumAddressFromPrivateKey(HARDHAT_PRIVATE_KEY), HARDHAT_ADDRESS);

assert.equal(parseEthToWei('1'), '1000000000000000000');
assert.equal(parseEthToWei('1.000000000000000001'), '1000000000000000001');
assert.equal(parseEthToWei('0.000000000000000001'), '1');
assert.equal(formatWeiToEth('1000000000000000001'), '1.000000000000000001');
assert.equal(formatWeiToGwei('41000000000'), '41');
assert.throws(() => parseEthToWei('0'), /invalid_amount/);
assert.throws(() => parseEthToWei('0.0000000000000000001'), /invalid_amount/);

// Public EIP-1559 / Geth-Clef serialization vector. This validates the exact
// 0x02 || RLP([chainId, nonce, fees, gas, to, value, data, accessList, yParity, r, s]) encoding.
const expectedRaw = '0x02f891018085174876e80085174876e80083033333948a8eafb1cf62bfbeb1741769dae1a9dd4799619210a44401a6e40000000000000000000000000000000000000000000000000000000000000012c080a0c8b59180c6e0c154284402b52d772f1afcf8ec2d245cf75bfb3212ebe676135ba02c660aaebf92d5e314fc2ba4c70f018915d174c3c1fc6e4e38d00ebf1a5bb69f';
const expectedHash = '0x8e096eb11ea89aa83900e6816fb182ff0adb2c85d270998ca2dd2394ec6c5a73';

const raw = serializeEip1559Transaction({
  chainId: '1',
  nonce: '0',
  maxPriorityFeePerGasWei: '100000000000',
  maxFeePerGasWei: '100000000000',
  gasLimit: '209715',
  to: '0x8A8eAFb1cf62BfBeb1741769DAE1a9dd47996192',
  valueWei: '16',
  data: '0x4401a6e40000000000000000000000000000000000000000000000000000000000000012',
}, {
  yParity: 0,
  r: '0xc8b59180c6e0c154284402b52d772f1afcf8ec2d245cf75bfb3212ebe676135b',
  s: '0x2c660aaebf92d5e314fc2ba4c70f018915d174c3c1fc6e4e38d00ebf1a5bb69f',
});

assert.equal(raw, expectedRaw);
assert.equal(hashRawEthereumTransaction(raw), expectedHash);

console.log('Ethereum deterministic wallet and Type-2 vectors passed.');
