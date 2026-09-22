<?php

declare(strict_types=1);

namespace App\Blockchain\Application;

use App\Blockchain\Domain\TronAddress;

final class TronTransferService
{
    /** @var array<string,array<string,string>> */
    private array $preparedIntents = [];
    public const NETWORK_ID = 'tron-mainnet';
    public const ROUTE_ID = 'usdt-tron-mainnet-trc20';
    public const CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
    public const CONTRACT_HEX = '41a614f803b6fd780986a42c78ec9c7f77e6ded13c';
    public const DECIMALS = 6;

    public function __construct(private TronReadProvider $provider, private TronTransactionValidator $validator)
    {
    }

    /** @return array<string,mixed> */
    public function balance(string $address): array
    {
        $parsed = TronAddress::fromString($address);
        $balance = $this->provider->tokenBalance(self::CONTRACT_HEX, $parsed->hex);
        self::decimal($balance);
        return [
            'networkId' => self::NETWORK_ID, 'assetRouteId' => self::ROUTE_ID,
            'address' => $parsed->base58, 'balanceBaseUnits' => $balance,
            'decimals' => self::DECIMALS, 'contractAddress' => self::CONTRACT,
            'observedAt' => (new \DateTimeImmutable())->format(DATE_ATOM),
        ];
    }

    /** @param array<string,mixed> $input
     * @return array<string,mixed>
     */
    public function prepare(array $input): array
    {
        self::fields($input, ['assetRouteId', 'from', 'to', 'amountBaseUnits']);
        if ($input['assetRouteId'] !== self::ROUTE_ID) throw new \InvalidArgumentException('invalid route');
        $from = TronAddress::fromString($input['from']);
        $to = TronAddress::fromString($input['to']);
        $amount = self::decimal($input['amountBaseUnits']);
        if ($amount === '0' || self::greaterThanMaxUint256($amount)) throw new \InvalidArgumentException('invalid amount');
        $data = 'a9059cbb'.str_repeat('0', 24).$to->payloadHex().str_pad(self::decimalToHex($amount), 64, '0', STR_PAD_LEFT);
        $now = (int) floor(microtime(true) * 1000);
        $expiration = $now + 600000;
        $account = $this->provider->account($from->hex);
        $feeLimit = 1000000000;
        $block = $this->provider->latestBlock();
        $blockId = strtolower((string) ($block['blockID'] ?? ''));
        $number = $block['block_header']['raw_data']['number'] ?? null;
        if (!is_string($blockId) || !preg_match('/^[0-9a-f]{64}$/', $blockId) || !is_int($number) && !is_string($number)) throw new TronProviderException('Provider returned invalid reference block.', false, 'PROVIDER_INVALID_RESPONSE');
        $numberHex = str_pad(dechex((int) $number), 16, '0', STR_PAD_LEFT);
        $rawBytes = self::encodeRawData($from->hex, self::CONTRACT_HEX, $data, substr($numberHex, 12, 4), substr($blockId, 16, 16), $expiration, $now, $feeLimit);
        $raw = bin2hex($rawBytes);
        if (strlen($rawBytes) > 65536) throw new TronProviderException('Transaction exceeds provider bounds.', false, 'INVALID_INTENT');
        $providerTx = $this->provider->prepareTransfer($from->hex, self::CONTRACT_HEX, $data, $expiration, $now, $feeLimit);
        $transaction = $providerTx['transaction'] ?? $providerTx;
        if (!is_array($transaction)) throw new TronProviderException('Provider returned invalid transaction.', false, 'PROVIDER_INVALID_RESPONSE');
        $this->validator->validatePrepared($transaction, $raw, $from->hex, self::CONTRACT_HEX, $data, $now, $expiration, $feeLimit);
        $providerRaw = $transaction['raw_data_hex'] ?? null;
        if (!is_string($providerRaw) || !preg_match('/^[0-9a-f]{2,131072}$/i', $providerRaw) || false === ($providerBytes = hex2bin($providerRaw))) throw new TronProviderException('Provider returned invalid raw data.', false, 'PROVIDER_INVALID_RESPONSE');
        $raw = strtolower($providerRaw); $rawBytes = $providerBytes;
        $energy = $this->provider->estimateEnergy($from->hex, self::CONTRACT_HEX, $data);
        $recipientAccount = $this->provider->account($to->hex);
        $active = $recipientAccount !== [];
        $txId = hash('sha256', $rawBytes);
        $this->preparedIntents[$txId] = ['from'=>$from->hex, 'to'=>$to->hex, 'amount'=>$amount, 'contract'=>self::CONTRACT_HEX];
        return [
            'networkId' => self::NETWORK_ID, 'assetRouteId' => self::ROUTE_ID,
            'intent' => ['from'=>$from->base58, 'to'=>$to->base58, 'amountBaseUnits'=>$amount, 'contractAddress'=>self::CONTRACT, 'decimals'=>self::DECIMALS],
            'rawDataHex' => $raw, 'rawDataBytesHash' => hash('sha256', $rawBytes),
            'refBlockBytesHex' => substr($numberHex, 12, 4),
            'refBlockHashHex' => substr($blockId, 16, 16),
            'timestampMs' => (string) $now,
            'expirationMs' => (string) $expiration,
            'feeLimitSun' => (string) $feeLimit,
            'bandwidthBytes' => (string) max(1, intdiv(strlen($raw), 2)),
            'energyEstimate' => $energy === null ? null : self::decimal((string)$energy),
            'senderTrxSun' => self::decimal((string)($account['balance'] ?? 0)),
            'recipientActive' => $active, 'accountActivationRequired' => !$active,
            'expiresAt' => (new \DateTimeImmutable('@'.(int) floor($expiration / 1000)))->format(DATE_ATOM),
        ];
    }

    /** @param array<string,mixed> $input
     * @return array<string,mixed>
     */
    public function broadcast(array $input): array
    {
        self::fields($input, ['assetRouteId', 'txId', 'rawTransactionHex']);
        if ($input['assetRouteId'] !== self::ROUTE_ID || !preg_match('/^[0-9a-fA-F]+$/', $input['rawTransactionHex']) || !preg_match('/^[0-9a-f]{64}$/', $input['txId'])) throw new \InvalidArgumentException('invalid broadcast');
        $raw = strtolower($input['rawTransactionHex']);
        $signed = self::decodeSignedTransaction($raw);
        $localTxId = hash('sha256', hex2bin($signed['raw_data_hex']));
        if ($localTxId !== strtolower($input['txId'])) throw new \InvalidArgumentException('transaction identity mismatch');
        $result = $this->provider->broadcast($signed['transaction']);
        $providerId = $result['txid'] ?? $result['txID'] ?? null;
        if ($providerId !== null && strtolower((string)$providerId) !== strtolower($input['txId'])) throw new TronProviderException('Provider transaction identity mismatch.', false, 'PROVIDER_INVALID_RESPONSE');
        $accepted = ($result['result'] ?? false) === true || ($result['code'] ?? '') === 'SUCCESS';
        return ['networkId'=>self::NETWORK_ID, 'assetRouteId'=>self::ROUTE_ID, 'txId'=>strtolower($input['txId']), 'state'=>$accepted ? 'accepted-for-broadcast' : 'rejected', ...(($result['code'] ?? null) !== null ? ['providerCode'=>(string) $result['code']] : [])];
    }

    /** @return array<string,mixed> */
    public function status(string $txId): array
    {
        if (!preg_match('/^[0-9a-fA-F]{64}$/', $txId)) throw new \InvalidArgumentException('invalid txid');
        $tx = $this->provider->transactionById(strtolower($txId));
        $info = $this->provider->transactionInfoById(strtolower($txId));
        if ($tx === [] && $info === []) return ['networkId'=>self::NETWORK_ID, 'txId'=>strtolower($txId), 'state'=>'expired-unknown'];
        $confirmed = isset($info['blockNumber']) || isset($info['block_num']);
        $receipt = $info['receipt']['result'] ?? null;
        $state = $receipt === 'SUCCESS' ? 'executed-success' : ($receipt !== null ? 'executed-failure' : ($confirmed ? 'included-solidified' : ($tx !== [] ? 'observed' : 'confirmation_unknown')));
        $result = ['networkId'=>self::NETWORK_ID, 'txId'=>strtolower($txId), 'state'=>$state];
        if (($block = $info['blockNumber'] ?? $info['block_num'] ?? null) !== null) $result['blockNumber'] = (string)$block;
        foreach (['fee'=>'feeSun','energy_usage_total'=>'energyUsed'] as $source=>$target) if (isset($info[$source]) && (is_int($info[$source]) || is_string($info[$source]))) $result[$target] = (string)$info[$source];
        if (is_string($info['resMessage'] ?? null) && $state === 'executed-failure') $result['failureCode'] = $info['resMessage'];
        return $result;
    }

    /** @param array<string,mixed> $value @param list<string> $allowed */
    private static function fields(array $value, array $allowed): void
    { if (array_diff(array_keys($value), $allowed) !== [] || array_diff($allowed, array_keys($value)) !== []) throw new \InvalidArgumentException('invalid request'); foreach ($value as $item) if (!is_string($item)) throw new \InvalidArgumentException('invalid request'); }
    private static function decimal(string $value): string
    { if (!preg_match('/^(0|[1-9][0-9]*)$/', $value)) throw new \InvalidArgumentException('invalid integer'); return $value; }
    private static function greaterThanMaxUint256(string $value): bool
    { $max='115792089237316195423570985008687907853269984665640564039457584007913129639935'; return strlen($value)>strlen($max) || (strlen($value)===strlen($max) && strcmp($value,$max)>0); }
    private static function decimalToHex(string $value): string
    { $out=''; while ($value !== '0') { $carry=0; $next=''; foreach (str_split($value) as $digit) { $n=$carry*10+(int)$digit; $q=intdiv($n,16); $carry=$n%16; if ($next!==''||$q>0) $next.=(string)$q; } $out=dechex($carry).$out; $value=$next===''?'0':$next; } return $out===''?'0':$out; }
    /** @param array<string,mixed> $array */ private static function stringField(array $array, string $key, string $default): string { return is_string($array[$key] ?? null) ? strtolower($array[$key]) : $default; }

    private static function varint(int $value): string { $out=''; do { $byte=$value & 127; $value=intdiv($value,128); $out.=chr($byte|($value?128:0)); } while($value); return $out; }
    private static function field(int $tag, string $value): string { return self::varint(($tag<<3)|2).self::varint(strlen($value)).$value; }
    private static function rawField(int $tag, int $value): string { return self::varint($tag<<3).self::varint($value); }
    private static function encodeRawData(string $owner, string $contract, string $data, string $refBytes, string $refHash, int $expiration, int $timestamp, int $fee): string {
        $trigger=self::field(1,hex2bin($owner)).self::field(2,hex2bin($contract)).self::field(4,hex2bin($data));
        $contractWrapper=self::rawField(1,31).self::field(2,$trigger);
        return self::field(1,self::field(1,$contractWrapper)).self::field(4,hex2bin($refBytes)).self::field(5,hex2bin($refHash)).self::rawField(8,$expiration).self::rawField(11,$timestamp).self::rawField(18,$fee);
    }
    /** @return array{raw_data_hex:string,transaction:array<string,mixed>} */
    private static function decodeSignedTransaction(string $hex): array {
        $bytes=hex2bin($hex); if(false===$bytes) throw new \InvalidArgumentException('invalid signed transaction');
        $offset=0; $raw=''; $signature=[];
        while($offset<strlen($bytes)){ $key=self::readVarint($bytes,$offset); $tag=intdiv($key,8); $wire=$key&7; if(2!==$wire) throw new \InvalidArgumentException('noncanonical signed transaction'); $len=self::readVarint($bytes,$offset); $value=substr($bytes,$offset,$len); if(strlen($value)!==$len) throw new \InvalidArgumentException('truncated signed transaction'); $offset+=$len; if(1===$tag) $raw=$value; elseif(2===$tag) $signature[]=bin2hex($value); else throw new \InvalidArgumentException('unknown signed transaction field'); }
        if(''===$raw || count($signature)!==1) throw new \InvalidArgumentException('signed transaction must contain one signature');
        $fields=self::parseFields($raw); $wrapper=$fields[1][0] ?? null;
        if (!is_array($wrapper)) throw new \InvalidArgumentException('missing contract');
        $parameter=self::parseFields($wrapper[2][0] ?? ''); $value=self::parseFields($parameter[2][0] ?? '');
        if (!isset($value[1][0],$value[2][0],$value[4][0]) || !is_string($value[1][0]) || !is_string($value[2][0]) || !is_string($value[4][0])) throw new \InvalidArgumentException('invalid trigger contract');
        $rawData=['contract'=>[['type'=>'TriggerSmartContract','parameter'=>['type'=>'protocol.TriggerSmartContract','value'=>['owner_address'=>bin2hex($value[1][0]),'contract_address'=>bin2hex($value[2][0]),'data'=>bin2hex($value[4][0])]]]]];
        foreach ([4=>'ref_block_bytes',5=>'ref_block_hash'] as $tag=>$name) if (isset($fields[$tag][0])) $rawData[$name]=bin2hex((string) $fields[$tag][0]);
        foreach ([8=>'expiration',11=>'timestamp',18=>'fee_limit'] as $tag=>$name) if (isset($fields[$tag][0])) $rawData[$name]=(int) $fields[$tag][0];
        return ['raw_data_hex'=>bin2hex($raw),'transaction'=>['raw_data'=>$rawData,'raw_data_hex'=>bin2hex($raw),'signature'=>$signature]];
    }
    /** @return array<int,list<string|int>> */
    private static function parseFields(string $bytes): array { $offset=0;$fields=[]; while($offset<strlen($bytes)){ $key=self::readVarint($bytes,$offset);$tag=intdiv($key,8);$wire=$key&7;if(2===$wire){$len=self::readVarint($bytes,$offset);$value=substr($bytes,$offset,$len);if(strlen($value)!==$len)throw new \InvalidArgumentException('truncated protobuf');$offset+=$len;$fields[$tag][]=$value;}elseif(0===$wire){$fields[$tag][]=self::readVarint($bytes,$offset);}else throw new \InvalidArgumentException('unsupported protobuf wire type');}return $fields; }
    private static function readVarint(string $bytes,int &$offset): int { $out=0;$shift=0; while($offset<strlen($bytes)&&$shift<63){$b=ord($bytes[$offset++]);$out|=($b&127)<<$shift;if(0==($b&128))return $out;$shift+=7;} throw new \InvalidArgumentException('invalid protobuf varint'); }
}
