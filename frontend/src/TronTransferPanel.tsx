import { useState, type FormEvent } from 'react';
import type { AssetRouteTransferPanelProps } from './runtime/AssetRouteAdapter';
import { TRON_USDT_CONTRACT, computeTronTxId, signTronRawData } from './wallet/tron';

const PREPARE = '/api/chains/tron/mainnet/usdt-trc20/prepare';
const BROADCAST = '/api/chains/tron/mainnet/usdt-trc20/broadcast';

function bytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) throw new Error('invalid_raw_data');
  return Uint8Array.from(hex.match(/../g) ?? [], pair => Number.parseInt(pair, 16));
}
function amountBaseUnits(value: string): string {
  if (!/^\d+(\.\d{1,6})?$/.test(value)) throw new Error('invalid_amount');
  const [whole, fraction = ''] = value.split('.');
  const result = `${whole}${fraction.padEnd(6, '0')}`.replace(/^0+(?=\d)/, '');
  if (/^0+$/.test(result)) throw new Error('invalid_amount');
  return result;
}

export function TronTransferPanel(props: AssetRouteTransferPanelProps) {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [prepared, setPrepared] = useState<{ rawDataHex: string; txId?: string; feeLimitSun: string; energyEstimate: string | null; accountActivationRequired: boolean } | null>(null);
  const [signed, setSigned] = useState<{ txId: string; rawTransactionHex: string } | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  async function prepare(event: FormEvent) {
    event.preventDefault(); setError(''); setSigned(null); setStatus('Preparing');
    try {
      const response = await fetch(PREPARE, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ assetRouteId: 'usdt-tron-mainnet-trc20', from: props.sourceAddress, to: recipient, amountBaseUnits: amountBaseUnits(amount) }) });
      const value = await response.json() as typeof prepared & { error?: { message?: string } };
      if (!response.ok || !value?.rawDataHex) throw new Error(value.error?.message ?? 'Preparation failed');
      setPrepared(value); setStatus('Ready to sign');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Preparation failed'); setStatus(''); }
  }
  function sign() {
    if (!prepared || !props.createdWallet || props.createdWallet.signingMaterial.kind !== 'private-key') return;
    try {
      const result = signTronRawData(bytes(prepared.rawDataHex), bytes(props.createdWallet.signingMaterial.value));
      setSigned({ txId: result.txId, rawTransactionHex: result.rawTransactionHex }); setStatus('Signed/not broadcast');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Signing failed'); }
  }
  async function broadcast() {
    if (!signed) return; setError(''); setStatus('Broadcasting');
    try {
      const response = await fetch(BROADCAST, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ assetRouteId: 'usdt-tron-mainnet-trc20', txId: signed.txId, rawTransactionHex: signed.rawTransactionHex }) });
      const value = await response.json() as { state?: string; error?: { message?: string } };
      if (!response.ok) throw new Error(value.error?.message ?? 'Broadcast failed');
      setStatus(value.state === 'accepted-for-broadcast' ? 'Accepted for broadcast' : 'Rejected');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Broadcast failed'); setStatus('Signed/not broadcast'); }
  }
  return <section className="transfer-card" id="transfer">
    <div className="transfer-copy"><span className="muted-label">USDT · {props.networkStandard}</span><h2>USDT TRC-20 transfer</h2><p>Review the intent, sign locally, then explicitly broadcast.</p></div>
    <form className="transfer-form" onSubmit={prepare}>
      <label><span>From</span><input value={props.sourceAddress} readOnly /></label>
      <label><span>Recipient</span><input value={recipient} onChange={event => setRecipient(event.target.value)} autoComplete="off" /></label>
      <label><span>Amount</span><input value={amount} onChange={event => setAmount(event.target.value)} inputMode="decimal" autoComplete="off" /><strong>USDT</strong></label>
      <small className="transfer-policy">Contract: {TRON_USDT_CONTRACT}. Fee is paid in TRX; energy and bandwidth are estimated before signing.</small>
      {prepared && <div className="transfer-review"><p>Fee cap: {prepared.feeLimitSun} sun{prepared.energyEstimate ? ` · Energy: ${prepared.energyEstimate}` : ''}</p>{prepared.accountActivationRequired && <p className="transfer-notice">Recipient account activation is required.</p>}<p>Raw transaction identity: {signed?.txId ?? computeTronTxId(bytes(prepared.rawDataHex))}</p></div>}
      {props.walletMode === 'watch-only' && <p className="transfer-notice">Watch-only wallets cannot sign locally.</p>}
      {error && <p className="form-error">{error}</p>}{status && <p className="transfer-notice">{status}</p>}
      {!prepared && <button className="submit-button" type="submit" disabled={!recipient || !amount || props.walletMode !== 'local-signing'}>Review transfer</button>}
      {prepared && !signed && <button className="submit-button" type="button" onClick={sign} disabled={props.walletMode !== 'local-signing'}>Sign locally</button>}
      {signed && <button className="submit-button" type="button" onClick={broadcast}>Broadcast signed transaction</button>}
    </form>
  </section>;
}
