import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from 'react';
import { BroadcastControls } from './broadcast/BroadcastControls';
import type { Language } from './i18n';
import type { BrowserSigningWallet, WalletMode } from './runtime/WalletNetworkAdapter';
import { tronMessages } from './tronI18n';
import { createTronTransferFlow } from './tronTransferFlow';

type Props = {
  language: Language; networkName: string; networkStandard: string; sourceAddress: string;
  walletMode: WalletMode; createdWallet: BrowserSigningWallet | null;
  flow?: ReturnType<typeof createTronTransferFlow>;
};

export function TronTransferPanel({language, networkName, networkStandard, sourceAddress, walletMode, createdWallet, flow: providedFlow}: Props) {
  // Identity changes synchronously replace the flow, so old review/bytes never render
  // for a new wallet. Cleanup also invalidates outstanding public requests.
  const flow = useMemo(() => providedFlow ?? createTronTransferFlow(), [providedFlow, sourceAddress, walletMode, createdWallet]);
  useEffect(() => () => flow.reset(), [flow]);
  const state = useSyncExternalStore(flow.subscribe, flow.getSnapshot, flow.getSnapshot);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const copy = tronMessages[language];
  const labels = copy.labels;
  const busy = state.phase === 'preparing' || state.phase === 'broadcasting';
  const review = state.review;
  const canSign = walletMode === 'local-signing' && createdWallet?.address === sourceAddress && createdWallet.signingMaterial.kind === 'private-key';
  const errorText = !state.error ? null
    : state.error === 'expired_unknown' ? copy.expiredUnknown
      : state.error === 'stale_preparation' ? copy.expired
      : state.error === 'broadcast_failed' ? copy.broadcastError
        : state.error === 'status_failed' ? copy.statusError
          : state.error === 'watch_only' ? copy.watch
            : state.error === 'wallet_key_mismatch' ? copy.mismatch
              : ['insufficient_funds', 'insufficient_token_funds'].includes(state.error) ? copy.funds : copy.error;
  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void flow.prepare(sourceAddress, recipient.trim(), amount.trim());
  }
  const rows: Array<[string, string | number]> = review ? [
    [labels.network, `${networkName} · mainnet · ${review.networkId}`], [labels.route, review.assetRouteId],
    [copy.from, review.from], [copy.to, review.to], [copy.amount, `${review.amount} USDT`],
    [labels.units, review.amountBaseUnits], [labels.contract, review.contractAddress], [labels.decimals, review.decimals],
    [labels.tokens, review.senderTokenBalanceBaseUnits], [labels.trx, review.senderTrxSun],
    [labels.recipientActive, review.recipientActive ? copy.active : copy.inactive],
    [labels.energy, review.energyEstimate], [labels.energyPrice, review.energyPriceSun], [labels.energyFee, review.estimatedEnergyFeeSun],
    [labels.feeLimit, review.feeLimitSun], [labels.bandwidth, review.bandwidthBytes], [labels.bandwidthPrice, review.bandwidthPriceSun],
    [labels.bandwidthFee, review.maxBandwidthFeeSun], [labels.maxFee, review.maxNetworkFeeSun], [labels.trxFee, review.maxNetworkFeeTrx],
    [labels.block, review.refBlockNumber], [labels.blockId, review.refBlockId], [labels.blockBytes, review.refBlockBytesHex], [labels.blockHash, review.refBlockHashHex],
    [labels.timestamp, review.timestampMs], [labels.expiration, review.expirationMs], [labels.txId, review.txId],
  ] : [];
  const statusText = state.status && ({unknown: copy.unknown, observed: copy.observed, included: copy.included,
    'included-solidified': copy.solidified, 'executed-success': copy.success, 'executed-failure': copy.failure})[state.status.state];
  return <section className="transfer-card" id="transfer">
    <div className="transfer-copy"><span className="muted-label">USDT · {networkStandard}</span><h2>{copy.title}</h2><p>{copy.description}</p><small className="transfer-policy">{copy.fees}</small></div>
    <form className="transfer-form" onSubmit={prepare}>
      <label><span>{copy.from}</span><input value={sourceAddress} readOnly autoComplete="off" spellCheck={false} /></label>
      <label><span>{copy.to}</span><input value={recipient} onChange={event => {flow.reset(); setRecipient(event.target.value);}} autoComplete="off" spellCheck={false} required disabled={busy} /></label>
      <label><span>{copy.amount}</span><input value={amount} onChange={event => {flow.reset(); setAmount(event.target.value);}} inputMode="decimal" autoComplete="off" required disabled={busy} /></label>
      {!canSign && <p className="transfer-notice">{copy.watch}</p>}
      <button className="submit-button" type="submit" disabled={busy || !sourceAddress}>{state.phase === 'preparing' ? copy.preparing : copy.prepare}</button>
    </form>
    {errorText && <p className="form-error" role="alert">{errorText}</p>}
    {review && <div className="transfer-preview">
      <div className="preview-header"><strong>{copy.review}</strong><span>{networkStandard}</span></div>
      <dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <p className="transfer-policy">{state.signed ? copy.signed : copy.unsigned}</p>
      {state.phase === 'review' && <button className="submit-button" type="button" disabled={!canSign} onClick={() => {
        if (canSign && createdWallet) flow.sign(createdWallet.signingMaterial.value, walletMode);
      }}>{copy.sign}</button>}
      {state.signed && <div className="broadcast-actions">
        <BroadcastControls language={language} kind="tron-http" rawTransaction={state.signed.rawTransactionHex} txid={state.signed.txId}
          busy={state.phase === 'broadcasting'} disabled={state.phase === 'submitted'} onBroadcast={flow.broadcast} />
        {state.phase === 'submitted' && <p className="transfer-notice" role="status">{copy.submitted}</p>}
        <button className="text-button" type="button" disabled={state.checking || state.phase === 'broadcasting'} onClick={() => void flow.checkStatus()}>{state.checking ? copy.checking : copy.check}</button>
        {state.status && <div role="status"><strong>{statusText}</strong><dl>
          <div><dt>{labels.txId}</dt><dd>{state.status.txId}</dd></div>
          {state.status.blockNumber !== undefined && <div><dt>{labels.blockNumber}</dt><dd>{state.status.blockNumber}</dd></div>}
          {state.status.feeSun !== undefined && <div><dt>{labels.actualFee}</dt><dd>{state.status.feeSun}</dd></div>}
          {state.status.energyUsed !== undefined && <div><dt>{labels.energyUsed}</dt><dd>{state.status.energyUsed}</dd></div>}
          {state.status.failureCode && <div><dt>{labels.failureCode}</dt><dd>{state.status.failureCode}</dd></div>}
        </dl></div>}
      </div>}
    </div>}
  </section>;
}
