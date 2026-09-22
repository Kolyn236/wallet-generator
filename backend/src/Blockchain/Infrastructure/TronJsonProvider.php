<?php

declare(strict_types=1);
namespace App\Blockchain\Infrastructure;
use App\Blockchain\Application\TronProviderException;
use App\Blockchain\Application\TronReadProvider;
final class TronJsonProvider implements TronReadProvider
{
 public function __construct(private string $url) {}
 public function networkIdentity(): array { return $this->call('getnowblock', [], ['blockID','block_header']); }
 public function latestBlock(): array { return $this->networkIdentity(); }
 public function account(string $address): array { return $this->call('getaccount', ['address'=>$address,'visible'=>false]); }
 public function accountResources(string $address): array { return $this->call('getaccountresource', ['address'=>$address,'visible'=>false]); }
 public function chainParameters(): array { return $this->call('getchainparameters'); }
 public function tokenBalance(string $contractHex, string $address): string { $r=$this->call('triggerconstantcontract',['owner_address'=>$address,'contract_address'=>$contractHex,'data'=>'70a08231'.str_pad(substr($address,-40),64,'0',STR_PAD_LEFT),'visible'=>false]); $x=$r['constant_result'][0]??null; if (!is_string($x)||!preg_match('/^[0-9a-fA-F]{64}$/',$x)) throw new TronProviderException('Invalid token balance.'); return self::hexToDecimal($x); }
 public function estimateEnergy(string $ownerHex,string $contractHex,string $dataHex): ?string { $r=$this->call('triggerconstantcontract',['owner_address'=>$ownerHex,'contract_address'=>$contractHex,'data'=>$dataHex,'visible'=>false]); return isset($r['energy_used'])&&is_numeric($r['energy_used'])?(string)$r['energy_used']:null; }
 public function prepareTransfer(string $ownerHex,string $contractHex,string $dataHex,int $expirationMs,int $timestampMs,int $feeLimitSun): array { return $this->call('triggersmartcontract',['owner_address'=>$ownerHex,'contract_address'=>$contractHex,'data'=>$dataHex,'call_value'=>0,'fee_limit'=>$feeLimitSun,'visible'=>false]); }
 public function broadcast(array $signedTransaction): array { return $this->call('broadcasttransaction',$signedTransaction); }
 public function transactionById(string $txId): array { return $this->call('gettransactionbyid',['value'=>$txId]); }
 public function transactionInfoById(string $txId): array { return $this->call('gettransactioninfobyid',['value'=>$txId]); }
 private static function hexToDecimal(string $hex): string { $digits=[0]; foreach(str_split(ltrim($hex,'0')?:'0') as $c){$carry=hexdec($c);for($i=count($digits)-1;$i>=0;--$i){$n=$digits[$i]*16+$carry;$digits[$i]=$n%10;$carry=intdiv($n,10);}while($carry){array_unshift($digits,$carry%10);$carry=intdiv($carry,10);}}return implode('',$digits);}
 private function call(string $method,array $params=[],array $required=[]): array { if (''===$this->url||!in_array(parse_url($this->url,PHP_URL_SCHEME),['http','https'],true)) throw new TronProviderException('Provider unavailable.',true,'PROVIDER_UNAVAILABLE'); $ctx=stream_context_create(['http'=>['method'=>'POST','timeout'=>10,'ignore_errors'=>true,'header'=>"Content-Type: application/json\r\nAccept: application/json\r\n",'content'=>json_encode($params,JSON_THROW_ON_ERROR)]]); $body=@file_get_contents(rtrim($this->url,'/').'/wallet/'.$method,false,$ctx); if(false===$body) throw new TronProviderException('Provider unavailable.',true,'PROVIDER_UNAVAILABLE'); try{$json=json_decode($body,true,flags:JSON_THROW_ON_ERROR);}catch(\JsonException){throw new TronProviderException('Invalid provider response.');} if(!is_array($json)||isset($json['Error'])||isset($json['error'])||isset($json['result'])&&false===$json['result']) throw new TronProviderException('Provider rejected request.'); foreach($required as $k)if(!array_key_exists($k,$json))throw new TronProviderException('Missing provider field.'); return $json; }
}
