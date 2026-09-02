import { FormEvent, useEffect, useMemo, useState } from 'react';
import { broadcastLitecoinTransaction, getLitecoinFeePolicy, getLitecoinUtxos, WalletApiError } from './api';
import { getAsset } from './assets';
import { type Language, messages } from './i18n';
import { isLitecoinMainnetAddress, type CreatedLitecoinWallet } from './wallet/litecoin';
import { buildSignedLitecoinTransfer, type SignedLitecoinTransfer } from './wallet/litecoinTransaction';

type WalletMode = 'none' | 'created' | 'watch-only';
type TransferState = 'idle' | 'preparing' | 'prepared' | 'broadcasting' | 'broadcasted';
type FeePolicyState = 'idle' | 'loading' | 'loaded' | 'error';
type TransferError = 'form' | 'sender-invalid' | 'recipient-invalid' | 'wif-required' | 'wif-invalid' | 'wif-mismatch' | 'fee-rate-invalid' | 'fee-policy' | 'utxo' | 'insufficient-funds' | 'amount-below-dust' | 'same-address' | 'signing' | 'broadcast';

type Props = { language: Language; networkName: string; networkStandard: string; sourceAddress: string; walletMode: WalletMode; createdWallet: CreatedLitecoinWallet | null };

export function LitecoinTransferPanel({ language, networkName, networkStandard, sourceAddress, walletMode, createdWallet }: Props) {
  const copy = messages[language];
  const network = getAsset('ltc').networks.find((candidate) => candidate.standard === networkStandard);
  const feePolicy = network?.feePolicy?.kind === 'utxo-rate-per-kb' ? network.feePolicy : null;
  const feeUnit = feePolicy?.unit ?? '';
  const [sender, setSender] = useState(sourceAddress);
  const [wif, setWif] = useState(createdWallet?.wif ?? '');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [recommendedFeeRate, setRecommendedFeeRate] = useState('');
  const [feeRate, setFeeRate] = useState('');
  const [feePolicyState, setFeePolicyState] = useState<FeePolicyState>('idle');
  const [state, setState] = useState<TransferState>('idle');
  const [error, setError] = useState<TransferError | null>(null);
  const [signedTransfer, setSignedTransfer] = useState<SignedLitecoinTransfer | null>(null);
  const [broadcastTxid, setBroadcastTxid] = useState<string | null>(null);

  useEffect(() => {
    if (!feePolicy) { setFeePolicyState('idle'); return; }
    const controller = new AbortController();
    setFeePolicyState('loading'); setRecommendedFeeRate(''); setFeeRate('');
    getLitecoinFeePolicy(controller.signal).then((policy) => {
      if (policy.kind !== feePolicy.kind || policy.unit !== feePolicy.unit || !policy.recommendedRate) throw new Error('invalid_fee_policy_response');
      setRecommendedFeeRate(policy.recommendedRate); setFeeRate(policy.recommendedRate); setFeePolicyState('loaded');
    }).catch((caught: unknown) => {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      setFeePolicyState('error');
    });
    return () => controller.abort();
  }, [feePolicy, networkStandard]);

  const busy = state === 'preparing' || state === 'broadcasting';
  const canPrepare = feePolicy !== null && feePolicyState === 'loaded';
  const customFeeRate = feePolicyState === 'loaded' && feeRate.trim() !== recommendedFeeRate;
  const errorMessage = useMemo(() => {
    switch (error) {
      case 'form': return copy.formError; case 'sender-invalid': return copy.senderInvalid; case 'recipient-invalid': return copy.recipientInvalid;
      case 'wif-required': return copy.wifRequired; case 'wif-invalid': return copy.wifInvalid; case 'wif-mismatch': return copy.wifMismatch;
      case 'fee-rate-invalid': return copy.feeRateInvalid; case 'fee-policy': return copy.transferUnavailable; case 'utxo': return copy.utxoError;
      case 'insufficient-funds': return copy.insufficientFunds; case 'amount-below-dust': return copy.amountBelowDust; case 'same-address': return copy.sameAddress;
      case 'signing': return copy.signingError; case 'broadcast': return copy.broadcastError; default: return null;
    }
  }, [copy, error]);

  function resetResult() { setSignedTransfer(null); setBroadcastTxid(null); setState('idle'); setError(null); }

  async function prepareTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); resetResult();
    if (!feePolicy || feePolicyState !== 'loaded') { setError('fee-policy'); return; }
    const source = sender.trim(); const destination = recipient.trim(); const signingWif = wif.trim(); const selectedFeeRate = feeRate.trim();
    if (!source || !destination || !amount.trim()) { setError('form'); return; }
    if (!signingWif) { setError('wif-required'); return; }
    if (!selectedFeeRate) { setError('fee-rate-invalid'); return; }
    if (!isLitecoinMainnetAddress(source)) { setError('sender-invalid'); return; }
    if (!isLitecoinMainnetAddress(destination)) { setError('recipient-invalid'); return; }
    setState('preparing');
    try {
      const response = await getLitecoinUtxos(source);
      const built = buildSignedLitecoinTransfer({ wif: signingWif, sourceAddress: source, recipientAddress: destination, amount, feeRateLtcPerKb: selectedFeeRate, utxos: response.utxos });
      setSignedTransfer(built); setState('prepared');
    } catch (caught: unknown) {
      setState('idle');
      if (caught instanceof WalletApiError) { setError('utxo'); return; }
      if (caught instanceof Error) {
        if (caught.message === 'invalid_wif') setError('wif-invalid'); else if (caught.message === 'wallet_key_mismatch') setError('wif-mismatch');
        else if (caught.message === 'invalid_fee_rate') setError('fee-rate-invalid'); else if (caught.message === 'invalid_address') setError('sender-invalid');
        else if (caught.message === 'invalid_amount') setError('form'); else if (caught.message === 'amount_below_dust') setError('amount-below-dust');
        else if (caught.message === 'same_address') setError('same-address'); else if (caught.message === 'insufficient_funds') setError('insufficient-funds'); else setError('signing');
        return;
      }
      setError('signing');
    }
  }

  async function broadcastPreparedTransfer() {
    if (!signedTransfer || state !== 'prepared') return;
    setState('broadcasting'); setError(null);
    try {
      const result = await broadcastLitecoinTransaction(signedTransfer.rawTransaction);
      if (result.txid.toLowerCase() !== signedTransfer.txid.toLowerCase()) throw new Error('broadcast_txid_mismatch');
      setBroadcastTxid(result.txid); setState('broadcasted');
    } catch { setState('prepared'); setError('broadcast'); }
  }

  return <section className="transfer-card" id="transfer">
    <div className="transfer-copy"><span className="muted-label">LTC · {networkStandard}</span><h2>{copy.transferTitle}</h2><p>{copy.transferText}</p><small className="transfer-policy">{copy.confirmedOnly}</small></div>
    <form className="transfer-form" onSubmit={prepareTransfer}>
      <label><span>{copy.from}</span><input value={sender} onChange={(e) => { setSender(e.target.value); resetResult(); }} placeholder={copy.fromPlaceholder} autoComplete="off" spellCheck={false} disabled={busy} /></label>
      <label><span>{copy.wifInput}</span><input type="password" value={wif} onChange={(e) => { setWif(e.target.value); resetResult(); }} placeholder={copy.wifPlaceholder} autoComplete="off" spellCheck={false} disabled={busy} /><small className="transfer-policy">{copy.wifHint}</small></label>
      <label><span>{copy.recipient}</span><input value={recipient} onChange={(e) => { setRecipient(e.target.value); resetResult(); }} placeholder={copy.recipientPlaceholder} autoComplete="off" spellCheck={false} disabled={busy} /></label>
      <div className="form-row"><label><span>{copy.amount}</span><div className="amount-field"><input value={amount} onChange={(e) => { setAmount(e.target.value); resetResult(); }} inputMode="decimal" placeholder={copy.amountPlaceholder} autoComplete="off" disabled={busy} /><strong>LTC</strong></div></label>
      <label><span>{copy.feeRate}</span><div className="amount-field"><input value={feeRate} onChange={(e) => { setFeeRate(e.target.value); resetResult(); }} inputMode="decimal" placeholder={recommendedFeeRate || '—'} autoComplete="off" disabled={busy || feePolicyState !== 'loaded'} /><strong>{feeUnit}</strong></div>{feePolicyState === 'loading' && <small className="transfer-policy">{copy.checking}</small>}{feePolicyState === 'loaded' && <small className="transfer-policy">{copy.recommendedFeeRate}: {recommendedFeeRate} {feeUnit}</small>}{feePolicyState === 'error' && <small className="form-error">{copy.transferUnavailable}</small>}</label></div>
      {customFeeRate && <><p className="transfer-notice">{copy.customFeeWarning}</p><button className="text-button" type="button" onClick={() => { setFeeRate(recommendedFeeRate); resetResult(); }} disabled={busy}>{copy.useRecommendedFeeRate}</button></>}
      {walletMode === 'watch-only' && <p className="transfer-notice">{copy.transferWatchOnly}</p>}{walletMode === 'none' && <p className="transfer-notice">{copy.transferAnySender}</p>}{errorMessage && <p className="form-error">{errorMessage}</p>}
      <button className="submit-button" type="submit" disabled={busy || !canPrepare}>{state === 'preparing' ? copy.preparingTransfer : copy.previewTransfer}</button>
    </form>
    {signedTransfer && <div className="transfer-preview"><div className="preview-header"><strong>{copy.preview}</strong><span>{networkStandard}</span></div><dl>
      <div><dt>{copy.from}</dt><dd>{sender.trim()}</dd></div><div><dt>{copy.recipient}</dt><dd>{recipient.trim()}</dd></div><div><dt>{copy.amount}</dt><dd>{signedTransfer.amount} LTC</dd></div><div><dt>{copy.feeRate}</dt><dd>{signedTransfer.feeRate} {feeUnit}</dd></div><div><dt>{copy.fee}</dt><dd>{signedTransfer.fee} LTC</dd></div><div><dt>{copy.change}</dt><dd>{signedTransfer.change} LTC</dd></div><div><dt>{copy.inputCount}</dt><dd>{signedTransfer.inputCount}</dd></div><div className="preview-txid"><dt>{copy.txid}</dt><dd>{signedTransfer.txid}</dd></div><div><dt>{copy.network}</dt><dd>{networkName}</dd></div>
    </dl><small>{copy.previewSignedLocal}</small><div className="broadcast-actions"><button className="broadcast-button" type="button" onClick={() => void broadcastPreparedTransfer()} disabled={state === 'broadcasting' || state === 'broadcasted'}>{state === 'broadcasting' ? copy.broadcasting : copy.sendToNetwork}</button>{state === 'broadcasted' && broadcastTxid && <div className="broadcast-success"><strong>{copy.broadcastSuccess}</strong><span>{copy.broadcastedTxid}: <code>{broadcastTxid}</code></span></div>}</div></div>}
  </section>;
}
