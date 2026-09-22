import { secp256k1 } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { base58 } from '@scure/base';
import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

export const TRON_DERIVATION_PATH = "m/44'/195'/0'/0/0";
export const TRON_USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
export const TRON_USDT_CONTRACT_HEX = '41a614f803b6fd780986a42c78ec9c7f77e6ded13c';
export const TRC20_TRANSFER_SELECTOR = 'a9059cbb';
const U256_MAX = (1n << 256n) - 1n;
const concat = (...xs: Uint8Array[]) => { const out = new Uint8Array(xs.reduce((n, x) => n + x.length, 0)); let p=0; for (const x of xs) { out.set(x,p); p+=x.length; } return out; };
function varint(n:number|bigint): Uint8Array { let x=BigInt(n), a:number[]=[]; do { a.push(Number(x&127n)|(x>127n?128:0)); x>>=7n; } while(x); return Uint8Array.from(a); }
function field(no:number, wire:number, value:Uint8Array|number|bigint) { const v = value instanceof Uint8Array ? value : varint(value); return concat(varint((no<<3)|wire), wire===2 ? concat(varint(v.length),v) : v); }
function message(fields: Uint8Array[]) { return concat(...fields); }
function readVarint(b:Uint8Array, p:number): [bigint,number] { let x=0n,s=0; while(p<b.length && s<70) { const q=b[p++]; x|=BigInt(q&127)<<BigInt(s); if(!(q&128)) return [x,p]; s+=7; } throw new Error('invalid_protobuf'); }
function readFields(b:Uint8Array) { const out:{no:number;wire:number;value:Uint8Array|bigint}[]=[]; let p=0; while(p<b.length) { const [tag,np]=readVarint(b,p); p=np; const no=Number(tag>>3n), wire=Number(tag&7n); if(wire===2){const [l,q]=readVarint(b,p);p=q;const end=p+Number(l);if(end>b.length)throw Error('invalid_protobuf');out.push({no,wire,value:b.slice(p,end)});p=end;} else if(wire===0){const [v,q]=readVarint(b,p);out.push({no,wire,value:v});p=q;} else throw Error('unsupported_protobuf_wire');} return out; }
const bytes = (hex:string) => hexToBytes(hex);

export function decodeTronAddress(value:string): {base58:string;hex:string;payload:Uint8Array} {
  if(typeof value!=='string'||!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value)) throw Error('invalid_tron_address');
  let raw:Uint8Array; try { raw=base58.decode(value); } catch { throw Error('invalid_tron_address'); }
  if(raw.length!==25 || raw[0]!==0x41) throw Error('invalid_tron_address');
  const check=sha256(sha256(raw.slice(0,21))).slice(0,4); for(let i=0;i<4;i++) if(raw[21+i]!==check[i]) throw Error('invalid_tron_address');
  return {base58:value,hex:bytesToHex(raw.slice(0,21)),payload:raw.slice(0,21)};
}
export function encodeTronAddress(hex:string):string { if(!/^41[0-9a-f]{40}$/.test(hex)) throw Error('invalid_tron_address'); const p=bytes(hex), c=sha256(sha256(p)).slice(0,4); return base58.encode(concat(p,c)); }
export function tronAddressFromPrivateKey(privateKey:Uint8Array):{base58:string;hex:string} { if(!secp256k1.utils.isValidSecretKey(privateKey))throw Error('invalid_private_key'); const pub=secp256k1.getPublicKey(privateKey,false); const p=concat(Uint8Array.of(0x41),keccak_256(pub.slice(1)).slice(-20)); return {base58:encodeTronAddress(bytesToHex(p)),hex:bytesToHex(p)}; }
export function deriveTronWallet(mnemonic:string,path=TRON_DERIVATION_PATH) { if(path!==TRON_DERIVATION_PATH||!validateMnemonic(mnemonic.trim().replace(/\s+/g,' '),wordlist)) throw Error('invalid_mnemonic_or_path'); const seed=mnemonicToSeedSync(mnemonic.trim().replace(/\s+/g,' ')), root=HDKey.fromMasterSeed(seed), child=root.derive(path); if(!child.privateKey)throw Error('derivation_failed'); const key=child.privateKey.slice(), a=tronAddressFromPrivateKey(key), pub=bytesToHex(secp256k1.getPublicKey(key,false)); seed.fill(0);root.wipePrivateData();child.wipePrivateData(); return {addressBase58:a.base58,addressHex:a.hex,publicKeyHex:pub,privateKey:key,derivationPath:path}; }
export function encodeTrc20Transfer(toBase58:string,amountBaseUnits:bigint) { const to=decodeTronAddress(toBase58); if(amountBaseUnits<1n||amountBaseUnits>U256_MAX)throw Error('invalid_amount'); const addr=new Uint8Array(32);addr.set(to.payload.slice(1),12); const amt=hexToBytes(amountBaseUnits.toString(16).padStart(64,'0')); return {selector:TRC20_TRANSFER_SELECTOR as 'a9059cbb',dataHex:TRC20_TRANSFER_SELECTOR+bytesToHex(concat(addr,amt))}; }
export function computeTronTxId(rawDataBytes:Uint8Array):string { return bytesToHex(sha256(rawDataBytes)); }
export function buildTronRawData(fields:{ownerAddressHex:string;refBlockBytesHex:string;refBlockHashHex:string;timestampMs:bigint;expirationMs:bigint;dataHex:string;feeLimitSun:bigint}) { if(!/^41[0-9a-f]{40}$/.test(fields.ownerAddressHex)||!/^([0-9a-f]{4})$/.test(fields.refBlockBytesHex)||!/^[0-9a-f]{16}$/.test(fields.refBlockHashHex))throw Error('invalid_raw_data'); const c=message([field(1,2,bytes(fields.ownerAddressHex)),field(2,2,bytes(TRON_USDT_CONTRACT_HEX)),field(3,2,bytes(fields.dataHex)),field(4,0,0n)]); const wrapper=message([field(1,0,31),field(2,2,message([field(1,2,c)]))]); return message([field(1,2,bytes(fields.refBlockBytesHex)),field(4,2,bytes(fields.refBlockHashHex)),field(8,0,fields.expirationMs),field(11,2,wrapper),field(14,0,fields.timestampMs),field(18,0,fields.feeLimitSun)]); }
export function signTronRawData(rawDataBytes:Uint8Array,privateKey:Uint8Array) { if(!secp256k1.utils.isValidSecretKey(privateKey))throw Error('invalid_private_key'); const digest=sha256(rawDataBytes); const sig=secp256k1.sign(digest,privateKey,{lowS:true}); const compact=sig.toCompactRawBytes(), v=sig.recovery; if(v!==0&&v!==1)throw Error('invalid_recovery'); const owner=tronAddressFromPrivateKey(privateKey).base58; const recovered=tronAddressFromPrivateKey(secp256k1.Signature.fromCompact(compact).addRecoveryBit(v).recoverPublicKey(digest).toRawBytes(false)).base58; if(owner!==recovered)throw Error('signature_owner_mismatch'); const signature=concat(compact,Uint8Array.of(v)); const tx=message([field(1,2,rawDataBytes),field(2,2,signature)]); return {signatureHex:bytesToHex(signature),txId:bytesToHex(digest),rawTransactionHex:bytesToHex(tx)}; }
export function validateCanonicalTronRawData(raw:Uint8Array):boolean { const fields=readFields(raw); if(fields.some(f=>f.no!==1&&f.no!==4&&f.no!==8&&f.no!==11&&f.no!==14&&f.no!==18)||fields.filter(f=>f.no===11).length!==1)return false; return bytesToHex(message(fields.map(f=>field(f.no,f.wire,f.value)) as Uint8Array[]))===bytesToHex(raw); }
