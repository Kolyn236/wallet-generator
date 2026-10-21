<?php

declare(strict_types=1);

namespace App\Tests\Blockchain;

use App\Blockchain\Application\TronProviderFailed;
use App\Blockchain\Infrastructure\TronHttpTransport;
use App\Blockchain\Infrastructure\TronRpcClient;
use App\Blockchain\Infrastructure\TronUsdtBalance;
use PHPUnit\Framework\TestCase;

final class TronPublicBackendTest extends TestCase
{
    public const GENESIS = '00000000000000001ebf88508a03865c71d452e25f4d51194196a1d22b6653dc';
    public const ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

    public function testBalanceUsesFixedContractAndExactUint256(): void
    {
        $transport = new TronFixtureTransport([
            '/wallet/getblockbynum' => ['blockID' => self::GENESIS],
            '/wallet/triggerconstantcontract' => ['result' => ['result' => true], 'constant_result' => [str_repeat('f', 64)]],
        ]);
        $balance = (new TronUsdtBalance(new TronRpcClient('https://node.invalid', $transport)))->read(self::ADDRESS);
        self::assertSame('115792089237316195423570985008687907853269984665640564039457584007913129639935', $balance);
        self::assertSame('41a614f803b6fd780986a42c78ec9c7f77e6ded13c', $transport->calls[1][1]['contract_address']);
        self::assertSame('balanceOf(address)', $transport->calls[1][1]['function_selector']);
    }

    public function testPreparationReturnsOnlyPublicSnapshotFromSolidBlock(): void
    {
        $responses = self::preparationResponses();
        $transport = new TronFixtureTransport($responses);
        $preparer = new \App\Blockchain\Infrastructure\TronTransferPreparation(new TronRpcClient('https://node.invalid', $transport), new TronFixedClock());
        $snapshot = $preparer->prepare(['assetRouteId' => 'usdt-tron-mainnet-trc20', 'from' => self::ADDRESS, 'to' => self::ADDRESS, 'amountBaseUnits' => '1']);
        self::assertSame('1700000600000', $snapshot['expirationMs']);
        self::assertSame('0001', $snapshot['refBlockBytesHex']);
        self::assertSame('1111111111111111', $snapshot['refBlockHashHex']);
        self::assertSame('12000000', $snapshot['feeLimitSun']);
        self::assertSame('1000', $snapshot['senderTokenBalanceBaseUnits']);
        self::assertArrayNotHasKey('rawDataHex', $snapshot);
        self::assertTrue($snapshot['recipientActive']);
        self::assertSame('transfer(address,uint256)', $transport->calls[5][1]['function_selector']);
    }

    /** @return array<string,array<string,mixed>> */
    public static function preparationResponses(): array
    {
        return [
            '/wallet/getblockbynum' => ['blockID' => self::GENESIS],
            '/walletsolidity/getnowblock' => ['blockID' => '0000000000000001'.str_repeat('1', 48), 'block_header' => ['raw_data' => ['number' => 1, 'timestamp' => 1700000000000]]],
            '/wallet/getaccount' => ['address' => '41a614f803b6fd780986a42c78ec9c7f77e6ded13c', 'balance' => 1000000000],
            '/wallet/getaccountresource' => ['EnergyLimit' => 0, 'EnergyUsed' => 0, 'freeNetLimit' => 600, 'freeNetUsed' => 0],
            '/wallet/getchainparameters' => ['chainParameter' => [
                ['key' => 'getEnergyFee', 'value' => 100],
                ['key' => 'getTransactionFee', 'value' => 1000],
                ['key' => 'getMaxFeeLimit', 'value' => 15000000000],
            ]],
            '/wallet/triggerconstantcontract' => ['result' => ['result' => true], 'constant_result' => [str_pad('3e8', 64, '0', \STR_PAD_LEFT)], 'energy_used' => 100000],
            '/wallet/triggerconstantcontract:transfer(address,uint256)' => ['result' => ['result' => true], 'constant_result' => [str_repeat('0', 63).'1'], 'energy_used' => 100000],
        ];
    }

    public function testStatusDoesNotConfuseInclusionWithSolidity(): void
    {
        $txId = hash('sha256', "\x00");
        $transport = new TronFixtureTransport([
            '/wallet/getblockbynum' => ['blockID' => self::GENESIS],
            '/wallet/gettransactionbyid' => ['txID' => $txId, 'raw_data_hex' => '00'],
            '/wallet/gettransactioninfobyid' => ['id' => $txId, 'blockNumber' => 3, 'receipt' => ['result' => 'SUCCESS']],
            '/walletsolidity/gettransactionbyid' => [],
            '/walletsolidity/gettransactioninfobyid' => [],
        ]);
        $reader = new \App\Blockchain\Infrastructure\TronTransactionStatus(new TronRpcClient('https://node.invalid', $transport));
        self::assertSame('included', $reader->read($txId)['state']);
        $transport->responses['/walletsolidity/gettransactioninfobyid'] = ['id' => $txId, 'blockNumber' => 3, 'receipt' => ['result' => 'SUCCESS']];
        self::assertSame('executed-success', $reader->read($txId)['state']);
        $transport->responses['/walletsolidity/gettransactioninfobyid']['receipt']['result'] = 'REVERT';
        $transport->responses['/wallet/gettransactioninfobyid']['receipt']['result'] = 'REVERT';
        self::assertSame('executed-failure', $reader->read($txId)['state']);
        foreach (array_keys($transport->responses) as $path) {
            if ('/wallet/getblockbynum' !== $path) {
                $transport->responses[$path] = [];
            }
        }
        self::assertSame('unknown', $reader->read($txId)['state']);
    }

    public function testRegisteredCapabilitiesAndStrictHttpBoundary(): void
    {
        $rpc = new TronRpcClient('https://node.invalid', new TronFixtureTransport(self::preparationResponses()));
        $adapter = new \App\Blockchain\Infrastructure\TronMainnetAdapter(new TronUsdtBalance($rpc), new \App\Blockchain\Infrastructure\TronTransferPreparation($rpc, new TronFixedClock()), new \App\Blockchain\Infrastructure\TronTransactionStatus($rpc));
        $registry = new \App\Blockchain\Application\ChainAdapterRegistry([$adapter]);
        self::assertSame($adapter, $registry->requireCapability('tron', 'mainnet', \App\Blockchain\Application\TronTokenBalanceCapability::class));
        self::assertSame($adapter, $registry->requireCapability('tron', 'mainnet', \App\Blockchain\Application\TronPreparationCapability::class));
        self::assertSame($adapter, $registry->requireCapability('tron', 'mainnet', \App\Blockchain\Application\TronStatusCapability::class));
        $controller = new \App\Blockchain\Presentation\Http\TronController($registry);
        $valid = ['assetRouteId' => 'usdt-tron-mainnet-trc20', 'from' => self::ADDRESS, 'to' => self::ADDRESS, 'amountBaseUnits' => '1'];
        self::assertSame(200, $controller->prepare(new \Symfony\Component\HttpFoundation\Request(content: json_encode($valid, \JSON_THROW_ON_ERROR)))->getStatusCode());
        foreach (['rawTransaction', 'privateKey', 'signature', 'feeLimitSun', 'contractAddress'] as $field) {
            $request = new \Symfony\Component\HttpFoundation\Request(content: json_encode($valid + [$field => 'anything'], \JSON_THROW_ON_ERROR));
            self::assertSame(400, $controller->prepare($request)->getStatusCode());
        }
        self::assertSame(400, $controller->balance('invalid')->getStatusCode());
        self::assertSame(400, $controller->status('invalid')->getStatusCode());
        $this->expectException(\App\Blockchain\Application\UnsupportedChainCapability::class);
        $registry->requireCapability('tron', 'mainnet', \App\Blockchain\Application\Erc20BalanceCapability::class);
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('executionFailures')]
    public function testAllProtocolExecutionFailuresRemainFailures(string $failure): void
    {
        $txId = hash('sha256', "\x00");
        $info = ['id' => $txId, 'blockNumber' => 3, 'receipt' => ['result' => $failure]];
        $tx = ['txID' => $txId, 'raw_data_hex' => '00', 'ret' => [['contractRet' => $failure]]];
        $transport = new TronFixtureTransport([
            '/wallet/getblockbynum' => ['blockID' => self::GENESIS],
            '/wallet/gettransactionbyid' => $tx, '/wallet/gettransactioninfobyid' => $info,
            '/walletsolidity/gettransactionbyid' => $tx, '/walletsolidity/gettransactioninfobyid' => $info,
        ]);
        $status = (new \App\Blockchain\Infrastructure\TronTransactionStatus(new TronRpcClient('https://node.invalid', $transport)))->read($txId);
        self::assertSame('executed-failure', $status['state']);
        self::assertSame($failure, $status['failureCode']);
        self::assertTrue($status['solidified']);
    }

    /** @return iterable<string,array{string}> */
    public static function executionFailures(): iterable
    {
        // protocol/core/Tron.proto Transaction.Result.contractResult, excluding DEFAULT/SUCCESS.
        foreach (['REVERT', 'BAD_JUMP_DESTINATION', 'OUT_OF_MEMORY', 'PRECOMPILED_CONTRACT', 'STACK_TOO_SMALL', 'STACK_TOO_LARGE', 'ILLEGAL_OPERATION', 'STACK_OVERFLOW', 'OUT_OF_ENERGY', 'OUT_OF_TIME', 'JVM_STACK_OVER_FLOW', 'UNKNOWN', 'TRANSFER_FAILED', 'INVALID_CODE'] as $failure) {
            yield $failure => [$failure];
        }
    }

    public function testMalformedResourceObjectFailsClosed(): void
    {
        $responses = self::preparationResponses();
        $responses['/wallet/getaccountresource'] = ['unexpected' => 'anything'];
        $preparer = new \App\Blockchain\Infrastructure\TronTransferPreparation(new TronRpcClient('https://node.invalid', new TronFixtureTransport($responses)), new TronFixedClock());
        $this->expectException(TronProviderFailed::class);
        $preparer->prepare(['assetRouteId' => 'usdt-tron-mainnet-trc20', 'from' => self::ADDRESS, 'to' => self::ADDRESS, 'amountBaseUnits' => '1']);
    }

    public function testStatusRejectsContradictoryExecutionReceipt(): void
    {
        $txId = hash('sha256', "\x00");
        $transport = new TronFixtureTransport([
            '/wallet/getblockbynum' => ['blockID' => self::GENESIS],
            '/wallet/gettransactionbyid' => ['txID' => $txId, 'raw_data_hex' => '00', 'ret' => [['contractRet' => 'REVERT']]],
            '/wallet/gettransactioninfobyid' => ['id' => $txId, 'blockNumber' => 3, 'receipt' => ['result' => 'SUCCESS']],
            '/walletsolidity/gettransactionbyid' => [],
            '/walletsolidity/gettransactioninfobyid' => ['id' => $txId, 'blockNumber' => 3, 'receipt' => ['result' => 'SUCCESS']],
        ]);
        $this->expectException(TronProviderFailed::class);
        (new \App\Blockchain\Infrastructure\TronTransactionStatus(new TronRpcClient('https://node.invalid', $transport)))->read($txId);
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('badIntentValues')]
    public function testBadPublicIntentRejectedBeforeProvider(string $field, mixed $value): void
    {
        $input = ['assetRouteId' => 'usdt-tron-mainnet-trc20', 'from' => self::ADDRESS, 'to' => self::ADDRESS, 'amountBaseUnits' => '1'];
        $input[$field] = $value;
        $transport = new TronFixtureTransport([]);
        try {
            (new \App\Blockchain\Infrastructure\TronTransferPreparation(new TronRpcClient('https://node.invalid', $transport), new TronFixedClock()))->prepare($input);
            self::fail('Invalid public intent accepted.');
        } catch (\InvalidArgumentException) {
            self::assertSame([], $transport->calls);
        }
    }

    /** @return iterable<string,array{string,mixed}> */
    public static function badIntentValues(): iterable
    {
        foreach (['0', '01', '-1', '1.0', '1e6', ' 1', '115792089237316195423570985008687907853269984665640564039457584007913129639936', 1, 1.1, null, [], true] as $index => $value) {
            yield 'amount-'.$index => ['amountBaseUnits', $value];
        }
        yield 'route' => ['assetRouteId', 'usdt-ethereum-mainnet-erc20'];
        yield 'checksum' => ['from', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6u'];
        yield 'hex-address' => ['to', '41a614f803b6fd780986a42c78ec9c7f77e6ded13c'];
        yield 'address-type' => ['from', []];
    }

    /** @param array<string,mixed> $replacement */
    #[\PHPUnit\Framework\Attributes\DataProvider('badPreparationData')]
    public function testMalformedPreparationDataFailsClosed(string $path, array $replacement): void
    {
        $responses = self::preparationResponses();
        $responses[$path] = $replacement;
        $preparer = new \App\Blockchain\Infrastructure\TronTransferPreparation(new TronRpcClient('https://node.invalid', new TronFixtureTransport($responses)), new TronFixedClock());
        $this->expectException(TronProviderFailed::class);
        $preparer->prepare(['assetRouteId' => 'usdt-tron-mainnet-trc20', 'from' => self::ADDRESS, 'to' => self::ADDRESS, 'amountBaseUnits' => '1']);
    }

    /** @return iterable<string,array{string,array<string,mixed>}> */
    public static function badPreparationData(): iterable
    {
        yield 'reference-height' => ['/walletsolidity/getnowblock', ['blockID' => '0000000000000001'.str_repeat('1', 48), 'block_header' => ['raw_data' => ['number' => 2, 'timestamp' => 1700000000000]]]];
        yield 'stale-reference' => ['/walletsolidity/getnowblock', ['blockID' => '0000000000000001'.str_repeat('1', 48), 'block_header' => ['raw_data' => ['number' => 1, 'timestamp' => 1699999000000]]]];
        yield 'browser-stale-reference' => ['/walletsolidity/getnowblock', ['blockID' => '0000000000000001'.str_repeat('1', 48), 'block_header' => ['raw_data' => ['number' => 1, 'timestamp' => 1699999850000]]]];
        yield 'browser-future-reference' => ['/walletsolidity/getnowblock', ['blockID' => '0000000000000001'.str_repeat('1', 48), 'block_header' => ['raw_data' => ['number' => 1, 'timestamp' => 1700000020000]]]];
        yield 'browser-fee-policy' => ['/wallet/getchainparameters', ['chainParameter' => [
            ['key' => 'getEnergyFee', 'value' => 1000],
            ['key' => 'getTransactionFee', 'value' => 1000],
            ['key' => 'getMaxFeeLimit', 'value' => 15000000000],
        ]]];
        yield 'future-reference' => ['/walletsolidity/getnowblock', ['blockID' => '0000000000000001'.str_repeat('1', 48), 'block_header' => ['raw_data' => ['number' => 1, 'timestamp' => 1700000040000]]]];
        yield 'missing-account' => ['/wallet/getaccount', []];
        yield 'account-identity' => ['/wallet/getaccount', ['address' => '41'.str_repeat('0', 40), 'balance' => 1000000000]];
        yield 'float-balance' => ['/wallet/getaccount', ['address' => '41a614f803b6fd780986a42c78ec9c7f77e6ded13c', 'balance' => 1.5]];
        yield 'insufficient-trx' => ['/wallet/getaccount', ['address' => '41a614f803b6fd780986a42c78ec9c7f77e6ded13c', 'balance' => 1]];
        yield 'negative-resource' => ['/wallet/getaccountresource', ['EnergyLimit' => -1]];
        yield 'float-resource' => ['/wallet/getaccountresource', ['EnergyUsed' => 0.5]];
        yield 'missing-price' => ['/wallet/getchainparameters', ['chainParameter' => []]];
        yield 'bad-energy' => ['/wallet/triggerconstantcontract:transfer(address,uint256)', ['result' => ['result' => true], 'constant_result' => [str_repeat('0', 63).'1'], 'energy_used' => '1e5']];
        yield 'insufficient-token' => ['/wallet/triggerconstantcontract', ['result' => ['result' => true], 'constant_result' => [str_repeat('0', 64)], 'energy_used' => 100000]];
        yield 'simulation-failure' => ['/wallet/triggerconstantcontract:transfer(address,uint256)', ['result' => ['result' => false]]];
        yield 'simulation-false-return' => ['/wallet/triggerconstantcontract:transfer(address,uint256)', ['result' => ['result' => true], 'constant_result' => [str_repeat('0', 64)], 'energy_used' => 100000]];
    }

    /** @param array<string,mixed> $transaction
     * @param array<string,mixed> $info
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('badStatusData')]
    public function testStatusRejectsUntrustedIdentitiesAndReceipts(array $transaction, array $info): void
    {
        $txId = hash('sha256', "\x00");
        $transport = new TronFixtureTransport([
            '/wallet/getblockbynum' => ['blockID' => self::GENESIS],
            '/wallet/gettransactionbyid' => $transaction,
            '/wallet/gettransactioninfobyid' => $info,
            '/walletsolidity/gettransactionbyid' => [],
            '/walletsolidity/gettransactioninfobyid' => [],
        ]);
        $this->expectException(TronProviderFailed::class);
        (new \App\Blockchain\Infrastructure\TronTransactionStatus(new TronRpcClient('https://node.invalid', $transport)))->read($txId);
    }

    /** @return iterable<string,array{array<string,mixed>,array<string,mixed>}> */
    public static function badStatusData(): iterable
    {
        $id = hash('sha256', "\x00");
        yield 'wrong-txid' => [['txID' => str_repeat('a', 64), 'raw_data_hex' => '00'], []];
        yield 'wrong-hash' => [['txID' => $id, 'raw_data_hex' => '01'], []];
        yield 'missing-raw' => [['txID' => $id], []];
        yield 'wrong-receipt-id' => [[], ['id' => str_repeat('a', 64), 'blockNumber' => 1]];
        yield 'invalid-block' => [[], ['id' => $id, 'blockNumber' => 1.5]];
        yield 'unknown-receipt-code' => [[], ['id' => $id, 'blockNumber' => 1, 'receipt' => ['result' => 'PROVIDER_MADE_UP']]];
        yield 'conflicting-result' => [[], ['id' => $id, 'blockNumber' => 1, 'result' => 'FAILED', 'receipt' => ['result' => 'SUCCESS']]];
    }

    /** @param array<string,mixed> $response */
    #[\PHPUnit\Framework\Attributes\DataProvider('badBalanceResults')]
    public function testBalanceRejectsMalformedWords(array $response): void
    {
        $transport = new TronFixtureTransport(['/wallet/getblockbynum' => ['blockID' => self::GENESIS], '/wallet/triggerconstantcontract' => $response]);
        $this->expectException(TronProviderFailed::class);
        (new TronUsdtBalance(new TronRpcClient('https://node.invalid', $transport)))->read(self::ADDRESS);
    }

    /** @return iterable<string,array{array<string,mixed>}> */
    public static function badBalanceResults(): iterable
    {
        yield 'short-word' => [['result' => ['result' => true], 'constant_result' => ['01']]];
        yield 'bad-hex' => [['result' => ['result' => true], 'constant_result' => [str_repeat('z', 64)]]];
        yield 'multiple-words' => [['result' => ['result' => true], 'constant_result' => [str_repeat('0', 64), str_repeat('0', 64)]]];
        yield 'unsuccessful-call' => [['result' => ['result' => false], 'constant_result' => [str_repeat('0', 64)]]];
        yield 'missing-result' => [['constant_result' => [str_repeat('0', 64)]]];
    }

    public function testProviderDoesNotLeakTransportInternals(): void
    {
        $transport = new class implements TronHttpTransport {
            public function post(string $url, string $payload): string
            {
                throw new \RuntimeException('credentials-and-internals');
            }
        };
        try {
            (new TronRpcClient('https://node.invalid', $transport))->assertMainnet();
            self::fail('Expected provider failure.');
        } catch (TronProviderFailed $error) {
            self::assertSame('provider_unavailable', $error->reason);
            self::assertSame('provider_unavailable', $error->getMessage());
        }
    }

    public function testWrongNetworkFailsBeforeBalance(): void
    {
        $transport = new TronFixtureTransport(['/wallet/getblockbynum' => ['blockID' => str_repeat('0', 64)]]);
        $this->expectException(TronProviderFailed::class);
        (new TronUsdtBalance(new TronRpcClient('https://node.invalid', $transport)))->read(self::ADDRESS);
    }
}

final class TronFixtureTransport implements TronHttpTransport
{
    /** @var list<array{string,array<string,mixed>}> */
    public array $calls = [];

    /** @param array<string,array<string,mixed>> $responses */
    public function __construct(public array $responses)
    {
    }

    public function post(string $url, string $payload): string
    {
        $path = parse_url($url, \PHP_URL_PATH);
        $input = json_decode($payload, true, 32, \JSON_THROW_ON_ERROR);
        if (!\is_string($path) || !\is_array($input)) {
            throw new \LogicException('Invalid fixture request.');
        }
        $this->calls[] = [$path, $input];
        if (($input['function_selector'] ?? '') === 'transfer(address,uint256)') {
            $path .= ':transfer(address,uint256)';
        }
        if (!isset($this->responses[$path])) {
            throw new \LogicException('Unexpected read: '.$path);
        }
        $response = $this->responses[$path];

        return json_encode((object) $response, \JSON_THROW_ON_ERROR);
    }
}
