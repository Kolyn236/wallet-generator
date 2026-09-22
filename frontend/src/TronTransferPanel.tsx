import { useEffect, useState, type FormEvent } from 'react';
import type { AssetRouteTransferPanelProps } from './runtime/AssetRouteAdapter';
import { TRON_USDT_CONTRACT, computeTronTxId, signTronWallet } from './wallet/tron';
import { tronMessages } from './tronI18n';

const PREPARE = '/api/chains/tron/mainnet/usdt-trc20/prepare';
const BROADCAST = '/api/chains/tron/mainnet/usdt-trc20/broadcast';
function bytes(hex: string): Uint8Array { if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) throw new Error('invalid_raw_data'); return Uint8Array.from(hex.match(/../g) ?? [], pair => Number.parseInt(pair, 16)); }
function amountBaseUnits(value: string): string { if (!/^\d+(\.\d{1,6})?$/.test(value)) throw new Error('invalid_amount'); const [whole, fraction = ''] = value.split('.'); const result = `${whole}${fraction.padEnd(6, '0')}`.replace(/^0+(?=\d)/, ''); if (/^0+$/.test(result)) throw new Error('invalid_amount'); return result; }

type Prepared = { rawDataHex: string; txId?: string; feeLimitSun: string; energyEstimate: string | null; accountActivationRequired: boolean };
type Signed = { txId: string; rawTransactionHex: string };

export function TronTransferPanel(props: AssetRouteTransferPanelProps) {
  const copy = tronMessages[props.language];
  const [recipient, setRecipient] = useState(''); const [amount, setAmount] = useState('');
  const [prepared, setPrepared] = useState<Prepared | null>(null); const [signed, setSigned] = useState<Signed | null>(null);
  const [status, setStatus] = useState(''); const [error, setError] = useState(''); const [preparedAt, setPreparedAt] = useState(0);
  useEffect(() => { setPrepared(null); setSigned(null); setStatus(''); setError(''); }, [props.sourceAddress, props.assetId, props.networkStandard]);

  async function prepare(event: FormEvent) {
    event.preventDefault(); setError(''); setSigned(null); setStatus(copy.preparing);
    try { const response = await fetch(PREPARE, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ assetRouteId: 'usdt-tron-mainnet-trc20', from: props.sourceAddress, to: recipient, amountBaseUnits: amountBaseUnits(amount) }) }); const value = await response.json() as Prepared & { error?: { message?: string } }; if (!response.ok || !value?.rawDataHex) throw new Error(value.error?.message ?? copy.prepareError); setPrepared(value); setPreparedAt(Date.now()); setStatus(copy.readyToSign); } catch (reason) { setError(reason instanceof Error ? reason.message : copy.prepareError); setStatus(''); }
  }
  function sign() {
    if (!prepared || !props.createdWallet || props.createdWallet.signingMaterial.kind !== 'private-key' || Date.now() - preparedAt > 600000) { setError('Preparation expired; review again.'); return; }
    try { const result = signTronWallet(bytes(prepared.rawDataHex), props.createdWallet.address); if (result.txId !== computeTronTxId(bytes(prepared.rawDataHex))) throw new Error('transaction_identity_mismatch'); setSigned({ txId: result.txId, rawTransactionHex: result.rawTransactionHex }); setStatus(copy.signedNotBroadcast); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Signing failed'); }
  }
  async function lookupStatus(txId: string) { try { const response = await fetch(`/api/chains/tron/mainnet/transactions/${txId}`, { headers: { Accept: 'application/json' }, cache: 'no-store' }); const value = await response.json() as { state?: string }; if (response.ok && value.state) setStatus(value.state); } catch { /* status lookup is explicitly retryable */ } }
  async function broadcast() { if (!signed) return; setError(''); setStatus('Broadcasting'); try { const response = await fetch(BROADCAST, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ assetRouteId: 'usdt-tron-mainnet-trc20', txId: signed.txId, rawTransactionHex: signed.rawTransactionHex }) }); const value = await response.json() as { state?: string; error?: { message?: string } }; if (!response.ok) throw new Error(value.error?.message ?? copy.broadcastError); setStatus(value.state === 'accepted-for-broadcast' ? copy.acceptedForBroadcast : 'Rejected'); void lookupStatus(signed.txId); } catch (reason) { setError(reason instanceof Error ? reason.message : copy.broadcastError); setStatus(copy.signedNotBroadcast); } }

  return <section className="transfer-card" id="transfer"><div className="transfer-copy"><span className="muted-label">{copy.route} · {props.networkStandard}</span><h2>{copy.amountLabel}</h2><p>{copy.transferText}</p></div><form className="transfer-form" onSubmit={prepare}><label><span>From</span><input value={props.sourceAddress} readOnly /></label><label><span>Recipient</span><input value={recipient} onChange={event => setRecipient(event.target.value)} autoComplete="off" /></label><label><span>{copy.amountLabel}</span><input value={amount} onChange={event => setAmount(event.target.value)} inputMode="decimal" autoComplete="off" /><strong>USDT</strong></label><small className="transfer-policy">{copy.contractLabel}: {TRON_USDT_CONTRACT}. {copy.feeModel}</small>{prepared && <div className="transfer-review"><p>{copy.feeLimitLabel}: {prepared.feeLimitSun} sun{prepared.energyEstimate ? ` · Energy: ${prepared.energyEstimate}` : ''}</p>{prepared.accountActivationRequired && <p className="transfer-notice">{copy.activationWarning}</p>}<p>Raw transaction identity: {signed?.txId ?? computeTronTxId(bytes(prepared.rawDataHex))}</p></div>}{props.walletMode === 'watch-only' && <p className="transfer-notice">Watch-only wallets cannot sign locally.</p>}{error && <p className="form-error">{error}</p>}{status && <p className="transfer-notice">{status}</p>}{!prepared && <button className="submit-button" type="submit" disabled={!recipient || !amount || props.walletMode !== 'local-signing'}>Review transfer</button>}{prepared && !signed && <button className="submit-button" type="button" onClick={sign} disabled={props.walletMode !== 'local-signing'}>Sign locally</button>}{signed && <><button className="submit-button" type="button" onClick={broadcast}>Broadcast signed transaction</button><button type="button" onClick={() => void lookupStatus(signed.txId)}>{copy.statusLookup}</button></>}</form></section>;
}
