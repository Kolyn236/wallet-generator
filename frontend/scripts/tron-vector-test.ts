import assert from 'node:assert/strict';

// Public, unfunded BIP39 vector; independently checked with tronweb@6.0.4.
const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const tron = await import('../src/wallet/tron.ts').catch(() => null);
assert.ok(tron, 'TRON browser wallet primitives must exist');
const wallet = tron.deriveTronWallet(mnemonic);
assert.equal(wallet.address, 'TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH');
assert.equal(wallet.privateKey, 'b5a4cea271ff424d7c31dc12a3e43e401df7a40d7412a15750f3f0b6b5449a28');
assert.equal(wallet.derivationPath, "m/44'/195'/0'/0/0");
assert.equal('mnemonic' in wallet, false, 'recovery does not retain mnemonic');
assert.equal(tron.tronPrivateKeyMatchesAddress(wallet.privateKey, wallet.address), true);
assert.equal(tron.isTronMainnetAddress(wallet.address), true);
assert.equal(tron.isTronMainnetAddress(wallet.address.slice(0, -1) + 'X'), false);
assert.equal(tron.isTronMainnetAddress('0x' + '11'.repeat(20)), false);
assert.equal(tron.tronPrivateKeyMatchesAddress('00'.repeat(32), wallet.address), false);
assert.throws(() => tron.deriveTronWallet('abandon '.repeat(12)), /invalid_mnemonic/);
const created = tron.createTronWallet();
assert.equal(tron.deriveTronWallet(created.mnemonic).address, created.address);
assert.equal(typeof tron.parseUsdtTrc20Amount, 'function', 'TRC20 exact amount parser must exist');
assert.equal(tron.parseUsdtTrc20Amount('1.5'), '1500000');
assert.equal(tron.parseUsdtTrc20Amount('0.000001'), '1');
assert.equal(tron.formatUsdtTrc20Amount('1500000'), '1.5');
assert.equal(tron.formatUsdtTrc20Amount('0'), '0');
for (const amount of ['0', '-1', '01', '1e2', '.1', '1.0000001', '1.', 'NaN', (1n << 256n).toString()]) {
  assert.throws(() => tron.parseUsdtTrc20Amount(amount), /invalid_amount/);
}
for (const value of ['01', '-1', '1.1', (1n << 256n).toString()]) {
  assert.throws(() => tron.formatUsdtTrc20Amount(value), /invalid_amount/);
}
assert.equal(tron.encodeTrc20Transfer(tron.TRON_USDT_CONTRACT, '1500000'),
  'a9059cbb000000000000000000000000a614f803b6fd780986a42c78ec9c7f77e6ded13c000000000000000000000000000000000000000000000000000000000016e360');
assert.throws(() => tron.encodeTrc20Transfer('invalid', '1'), /invalid_address/);
assert.throws(() => tron.encodeTrc20Transfer(wallet.address, '0'), /invalid_amount/);
// Independent oracle: tronweb@6.0.4 generated protobuf Transaction.raw and
// signed this unfunded synthetic transaction. TronWeb emits v=27/28; our wire
// uses java-tron's canonical v=0/1. r/s and raw-data/TXID must match exactly.
// Schema: https://github.com/tronprotocol/protocol/blob/master/core/Tron.proto
// raw tags: ref bytes=1, ref hash=4, expiration=8, contract=11, timestamp=14,
// fee_limit=18. Contract.parameter is google.protobuf.Any, not bare trigger.
const EXPECTED_RAW = '0a0256782208112233445566778840e0a499ffbc315aae01081f12a9010a31747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e54726967676572536d617274436f6e747261637412740a1541c8599111f29c1e1e061265b4af93ea1f274ad78a121541a614f803b6fd780986a42c78ec9c7f77e6ded13c2244a9059cbb000000000000000000000000a614f803b6fd780986a42c78ec9c7f77e6ded13c000000000000000000000000000000000000000000000000000000000016e3607080d095ffbc3190018087a70e';
const EXPECTED_TXID = '977d736bfc49a7cae9cbbc9b88a5c4b747e063a34d03356cc4c148ada8fd8abf';
const EXPECTED_SIGNATURE = '20a267c2f7e6c66663d57962574fea47c733707e7a18faf2ae6563f9acc936ab2909c558e0d1f33902b062fb250bd92ca8dc8d84e7357ca7077f9ac5eefd4d0100';
const transaction = await import('../src/wallet/tronTransaction.ts').catch(() => null);
assert.ok(transaction, 'TRON transaction primitives must exist');
const prepared = {
  chain: 'tron' as const, network: 'mainnet' as const,
  networkId: 'tron-mainnet' as const, assetRouteId: 'usdt-tron-mainnet-trc20' as const,
  from: wallet.address, to: tron.TRON_USDT_CONTRACT, amountBaseUnits: '1500000',
  contractAddress: tron.TRON_USDT_CONTRACT, decimals: 6 as const,
  refBlockBytesHex: '5678', refBlockHashHex: '1122334455667788',
  refBlockNumber: '305419896',
  refBlockId: '00000000123456781122334455667788' + '00'.repeat(16),
  timestampMs: '1700000000000', expirationMs: '1700000060000',
  feeLimitSun: '30000000', energyEstimate: '65000', energyPriceSun: '100',
  bandwidthPriceSun: '1000', senderTrxSun: '100000000',
  senderTokenBalanceBaseUnits: '10000000', recipientActive: true,
};
const input = {
  privateKey: wallet.privateKey, sourceAddress: wallet.address,
  recipientAddress: prepared.to, amount: '1.5', prepared, nowMs: 1700000001000,
};
const signed = transaction.buildSignedTronTransfer(input);
assert.equal(signed.rawDataHex, EXPECTED_RAW);
assert.equal(signed.txId, EXPECTED_TXID);
assert.equal(signed.signatureHex, EXPECTED_SIGNATURE);
assert.equal(signed.rawTransactionHex, '0ad301' + EXPECTED_RAW + '1241' + EXPECTED_SIGNATURE);
assert.equal(transaction.buildSignedTronTransfer(input).rawTransactionHex, signed.rawTransactionHex);
const { secp256k1 } = await import('@noble/curves/secp256k1.js');
const { hexToBytes, bytesToHex } = await import('@noble/hashes/utils.js');
const recovered = secp256k1.recoverPublicKey(hexToBytes('00' + EXPECTED_SIGNATURE.slice(0, 128)), hexToBytes(EXPECTED_TXID), { prehash: false });
assert.equal(bytesToHex(secp256k1.Point.fromBytes(recovered).toBytes(false)), wallet.publicKeyHex);
for (const patch of [
  { chain: 'ethereum' }, { network: 'nile' }, { networkId: 'ethereum-mainnet' },
  { assetRouteId: 'usdt-ethereum-mainnet-erc20' }, { from: prepared.to }, { to: wallet.address },
  { amountBaseUnits: '1500001' }, { contractAddress: wallet.address }, { decimals: 18 },
]) {
  assert.throws(() => transaction.buildSignedTronTransfer({ ...input, prepared: { ...prepared, ...patch } as typeof prepared }), /prepared_transaction_mismatch/);
}
assert.throws(() => transaction.buildSignedTronTransfer({ ...input, privateKey: '01'.padStart(64, '0') }), /wallet_key_mismatch/);
assert.throws(() => transaction.buildSignedTronTransfer({ ...input, privateKey: '00'.repeat(32) }), /invalid_private_key/);
assert.throws(() => transaction.buildSignedTronTransfer({ ...input, recipientAddress: 'invalid' }), /invalid_recipient/);
assert.throws(() => transaction.buildSignedTronTransfer({ ...input, sourceAddress: 'invalid' }), /invalid_sender/);
assert.throws(() => transaction.buildSignedTronTransfer({ ...input, recipientAddress: wallet.address }), /same_address/);
assert.throws(() => transaction.buildSignedTronTransfer({ ...input, prepared: { ...prepared, rawDataHex: '00' } }), /prepared_transaction_mismatch/);
assert.equal(transaction.buildSignedTronTransfer({ ...input, prepared: { ...prepared, rawDataHex: EXPECTED_RAW } }).txId, EXPECTED_TXID);
assert.equal(transaction.buildSignedTronTransfer({ ...input, prepared: { ...prepared, expirationMs: '1700000600000' } }).expirationMs, '1700000600000');
for (const patch of [
  { timestampMs: '1699999800000' }, { timestampMs: '1700000020000' },
  { expirationMs: '1700000001000' }, { expirationMs: '1700003600000' },
  { expirationMs: prepared.timestampMs },
]) {
  assert.throws(() => transaction.buildSignedTronTransfer({ ...input, prepared: { ...prepared, ...patch } }), /stale_preparation/);
}
for (const patch of [
  { refBlockNumber: '305419897' }, { refBlockBytesHex: '1234' }, { refBlockHashHex: '00'.repeat(8) },
  { refBlockId: '00'.repeat(32) }, { refBlockBytesHex: '0x5678' },
  { refBlockHashHex: '11' }, { refBlockId: '0000000012345678A122334455667788' + '00'.repeat(16) },
]) {
  assert.throws(() => transaction.buildSignedTronTransfer({ ...input, prepared: { ...prepared, ...patch } }), /invalid_tapos/);
}
for (const field of ['refBlockNumber', 'timestampMs', 'expirationMs', 'feeLimitSun', 'energyEstimate', 'energyPriceSun', 'bandwidthPriceSun', 'senderTrxSun', 'senderTokenBalanceBaseUnits']) {
  for (const value of ['01', '-1', '1.0', '1e3', '', ' ', 100, null, '9'.repeat(100)]) {
    assert.throws(() => transaction.buildSignedTronTransfer({ ...input, prepared: { ...prepared, [field]: value } as typeof prepared }), /invalid_quantity/);
  }
}
for (const nowMs of [NaN, Infinity, -1, 1700000001000.5]) {
  assert.throws(() => transaction.buildSignedTronTransfer({ ...input, nowMs }), /invalid_time/);
}
for (const patch of [
  { feeLimitSun: '0' }, { feeLimitSun: '100000001' }, { feeLimitSun: '6499999' },
  { energyEstimate: '0' }, { energyEstimate: '10000001' },
  { energyPriceSun: '0' }, { energyPriceSun: '100001' },
  { bandwidthPriceSun: '0' }, { bandwidthPriceSun: '1000001' },
]) {
  assert.throws(() => transaction.buildSignedTronTransfer({ ...input, prepared: { ...prepared, ...patch } }), /invalid_fee/);
}
assert.throws(() => transaction.buildSignedTronTransfer({ ...input, prepared: { ...prepared, senderTokenBalanceBaseUnits: '1499999' } }), /insufficient_token_funds/);
assert.throws(() => transaction.buildSignedTronTransfer({ ...input, prepared: { ...prepared, senderTrxSun: '30000000' } }), /insufficient_funds/);
assert.throws(() => transaction.buildSignedTronTransfer({ ...input, prepared: { ...prepared, recipientActive: 'yes' as unknown as boolean } }), /invalid_resources/);
assert.equal(transaction.buildSignedTronTransfer({ ...input, prepared: { ...prepared, recipientActive: false } }).recipientActive, false);
assert.equal(signed.estimatedEnergyFeeSun, '6500000');
assert.equal(signed.bandwidthBytes, '345');
assert.equal(signed.maxBandwidthFeeSun, '345000');
assert.equal(signed.maxNetworkFeeSun, '30345000');
assert.equal(signed.maxNetworkFeeTrx, '30.345');
assert.equal(signed.amount, '1.5');
console.log('TRON independent vectors, intent, quantities, TAPOS, freshness and resource safety passed.');
