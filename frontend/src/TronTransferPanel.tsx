import { useState } from 'react';
import type { AssetRouteTransferPanelProps } from './runtime/AssetRouteAdapter';
import { TRON_USDT_CONTRACT } from './wallet/tron';

export function TronTransferPanel(props: AssetRouteTransferPanelProps) {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  return <section className="transfer-card" id="transfer">
    <div className="transfer-copy"><span className="muted-label">USDT · {props.networkStandard}</span><h2>USDT TRC-20 transfer</h2><p>Prepare and review a Tron transfer before signing and broadcasting.</p></div>
    <form className="transfer-form" onSubmit={(event) => event.preventDefault()}>
      <label><span>From</span><input value={props.sourceAddress} readOnly /></label>
      <label><span>Recipient</span><input value={recipient} onChange={(event) => setRecipient(event.target.value)} autoComplete="off" /></label>
      <label><span>Amount</span><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" autoComplete="off" /><strong>USDT</strong></label>
      <small className="transfer-policy">Contract: {TRON_USDT_CONTRACT}. Network fee is paid in TRX.</small>
      {props.walletMode === 'watch-only' && <p className="transfer-notice">Watch-only wallets cannot sign locally.</p>}
      <button className="submit-button" type="submit" disabled={!recipient || !amount || props.walletMode !== 'local-signing'}>Review transfer</button>
    </form>
  </section>;
}
