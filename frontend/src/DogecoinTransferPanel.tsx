import { FormEvent, useMemo, useState } from 'react';
import {
  broadcastDogecoinTransaction,
  getDogecoinUtxos,
  WalletApiError,
} from './api';
import { getAsset, type AssetId } from './assets';
import { type Language, messages } from './i18n';
import { isDogecoinMainnetAddress, type CreatedDogecoinWallet } from './wallet/dogecoin';
import {
  buildSignedDogecoinTransfer,
  type SignedDogecoinTransfer,
} from './wallet/dogecoinTransaction';

type DogecoinWalletMode = 'none' | 'created' | 'watch-only';
type TransferState = 'idle' | 'preparing' | 'prepared' | 'broadcasting' | 'broadcasted';
type TransferError =
  | 'form'
  | 'sender-invalid'
  | 'recipient-invalid'
  | 'wif-required'
  | 'wif-invalid'
  | 'wif-mismatch'
  | 'fee-rate-invalid'
  | 'unavailable'
  | 'utxo'
  | 'insufficient-funds'
  | 'amount-below-dust'
  | 'same-address'
  | 'signing'
  | 'broadcast';

type Props = {
  language: Language;
  assetId: AssetId;
  assetSymbol: string;
  networkName: string;
  networkStandard: string;
  sourceAddress: string;
  walletMode: DogecoinWalletMode;
  createdWallet: CreatedDogecoinWallet | null;
};

export function DogecoinTransferPanel({
  language,
  assetId,
  assetSymbol,
  networkName,
  networkStandard,
  sourceAddress,
  walletMode,
  createdWallet,
}: Props) {
  const copy = messages[language];
  const network = getAsset(assetId).networks.find((candidate) => candidate.standard === networkStandard);
  const feePolicy = network?.feePolicy?.kind === 'utxo-rate-per-kb' ? network.feePolicy : null;
  const recommendedFeeRate = feePolicy?.recommendedRate ?? '';
  const feeUnit = feePolicy?.unit ?? '';

  const [sender, setSender] = useState(sourceAddress);
  const [wif, setWif] = useState(createdWallet?.wif ?? '');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [feeRate, setFeeRate] = useState(recommendedFeeRate);
  const [state, setState] = useState<TransferState>('idle');
  const [error, setError] = useState<TransferError | null>(null);
  const [signedTransfer, setSignedTransfer] = useState<SignedDogecoinTransfer | null>(null);
  const [broadcastTxid, setBroadcastTxid] = useState<string | null>(null);

  const busy = state === 'preparing' || state === 'broadcasting';
  const canPrepare = assetId === 'doge' && feePolicy !== null;
  const customFeeRate = feeRate.trim() !== recommendedFeeRate;

  const errorMessage = useMemo(() => {
    switch (error) {
      case 'form': return copy.formError;
      case 'sender-invalid': return copy.senderInvalid;
      case 'recipient-invalid': return copy.recipientInvalid;
      case 'wif-required': return copy.wifRequired;
      case 'wif-invalid': return copy.wifInvalid;
      case 'wif-mismatch': return copy.wifMismatch;
      case 'fee-rate-invalid': return copy.feeRateInvalid;
      case 'unavailable': return copy.transferUnavailable;
      case 'utxo': return copy.utxoError;
      case 'insufficient-funds': return copy.insufficientFunds;
      case 'amount-below-dust': return copy.amountBelowDust;
      case 'same-address': return copy.sameAddress;
      case 'signing': return copy.signingError;
      case 'broadcast': return copy.broadcastError;
      default: return null;
    }
  }, [copy, error]);

  function resetResult() {
    setSignedTransfer(null);
    setBroadcastTxid(null);
    setState('idle');
    setError(null);
  }

  function updateSender(value: string) {
    setSender(value);
    resetResult();
  }

  function updateWif(value: string) {
    setWif(value);
    resetResult();
  }

  function updateRecipient(value: string) {
    setRecipient(value);
    resetResult();
  }

  function updateAmount(value: string) {
    setAmount(value);
    resetResult();
  }

  function updateFeeRate(value: string) {
    setFeeRate(value);
    resetResult();
  }

  function useRecommendedFeeRate() {
    setFeeRate(recommendedFeeRate);
    resetResult();
  }

  async function prepareTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetResult();

    if (assetId !== 'doge' || !feePolicy) {
      setError('unavailable');
      return;
    }

    const source = sender.trim();
    const destination = recipient.trim();
    const signingWif = wif.trim();
    const selectedFeeRate = feeRate.trim();

    if (!source || !destination || !amount.trim()) {
      setError('form');
      return;
    }
    if (!signingWif) {
      setError('wif-required');
      return;
    }
    if (!selectedFeeRate) {
      setError('fee-rate-invalid');
      return;
    }
    if (!isDogecoinMainnetAddress(source)) {
      setError('sender-invalid');
      return;
    }
    if (!isDogecoinMainnetAddress(destination)) {
      setError('recipient-invalid');
      return;
    }

    setState('preparing');

    try {
      const response = await getDogecoinUtxos(source);
      const built = buildSignedDogecoinTransfer({
        wif: signingWif,
        sourceAddress: source,
        recipientAddress: destination,
        amount,
        feeRateDogePerKb: selectedFeeRate,
        utxos: response.utxos,
      });
      setSignedTransfer(built);
      setState('prepared');
    } catch (caught: unknown) {
      setState('idle');

      if (caught instanceof WalletApiError) {
        setError('utxo');
        return;
      }
      if (caught instanceof Error) {
        if (caught.message === 'invalid_wif') setError('wif-invalid');
        else if (caught.message === 'wallet_key_mismatch') setError('wif-mismatch');
        else if (caught.message === 'invalid_fee_rate') setError('fee-rate-invalid');
        else if (caught.message === 'invalid_address') setError('sender-invalid');
        else if (caught.message === 'invalid_amount') setError('form');
        else if (caught.message === 'amount_below_dust') setError('amount-below-dust');
        else if (caught.message === 'same_address') setError('same-address');
        else if (caught.message === 'insufficient_funds') setError('insufficient-funds');
        else setError('signing');
        return;
      }

      setError('signing');
    }
  }

  async function broadcastPreparedTransfer() {
    if (!signedTransfer || state !== 'prepared') return;

    setState('broadcasting');
    setError(null);

    try {
      const result = await broadcastDogecoinTransaction(signedTransfer.rawTransaction);
      if (result.txid.toLowerCase() !== signedTransfer.txid.toLowerCase()) {
        throw new Error('broadcast_txid_mismatch');
      }
      setBroadcastTxid(result.txid);
      setState('broadcasted');
    } catch {
      setState('prepared');
      setError('broadcast');
    }
  }

  return (
    <section className="transfer-card" id="transfer">
      <div className="transfer-copy">
        <span className="muted-label">{assetSymbol} · {networkStandard}</span>
        <h2>{copy.transferTitle}</h2>
        <p>{copy.transferText}</p>
        {assetId === 'doge' && <small className="transfer-policy">{copy.confirmedOnly}</small>}
      </div>

      <form className="transfer-form" onSubmit={prepareTransfer}>
        <label>
          <span>{copy.from}</span>
          <input
            value={sender}
            onChange={(event) => updateSender(event.target.value)}
            placeholder={copy.fromPlaceholder}
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
          />
        </label>
        <label>
          <span>{copy.wifInput}</span>
          <input
            type="password"
            value={wif}
            onChange={(event) => updateWif(event.target.value)}
            placeholder={copy.wifPlaceholder}
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
          />
          <small className="transfer-policy">{copy.wifHint}</small>
        </label>
        <label>
          <span>{copy.recipient}</span>
          <input
            value={recipient}
            onChange={(event) => updateRecipient(event.target.value)}
            placeholder={copy.recipientPlaceholder}
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
          />
        </label>
        <div className="form-row">
          <label>
            <span>{copy.amount}</span>
            <div className="amount-field">
              <input
                value={amount}
                onChange={(event) => updateAmount(event.target.value)}
                inputMode="decimal"
                placeholder={copy.amountPlaceholder}
                autoComplete="off"
                disabled={busy}
              />
              <strong>{assetSymbol}</strong>
            </div>
          </label>
          <label>
            <span>{copy.feeRate}</span>
            <div className="amount-field">
              <input
                value={feeRate}
                onChange={(event) => updateFeeRate(event.target.value)}
                inputMode="decimal"
                placeholder={recommendedFeeRate}
                autoComplete="off"
                disabled={busy || !feePolicy}
              />
              <strong>{feeUnit}</strong>
            </div>
            {feePolicy && (
              <small className="transfer-policy">
                {copy.recommendedFeeRate}: {recommendedFeeRate} {feeUnit}
              </small>
            )}
            {customFeeRate && (
              <button className="text-button" type="button" onClick={useRecommendedFeeRate} disabled={busy}>
                {copy.useRecommendedFeeRate}
              </button>
            )}
          </label>
        </div>

        {customFeeRate && (
          <p className="transfer-notice">{copy.customFeeWarning}</p>
        )}
        {assetId === 'doge' && walletMode === 'watch-only' && (
          <p className="transfer-notice">{copy.transferWatchOnly}</p>
        )}
        {assetId === 'doge' && walletMode === 'none' && (
          <p className="transfer-notice">{copy.transferAnySender}</p>
        )}
        {assetId !== 'doge' && <p className="transfer-notice">{copy.transferUnavailable}</p>}
        {errorMessage && <p className="form-error">{errorMessage}</p>}

        <button className="submit-button" type="submit" disabled={busy || !canPrepare}>
          {state === 'preparing' ? copy.preparingTransfer : copy.previewTransfer}
        </button>
      </form>

      {signedTransfer && (
        <div className="transfer-preview">
          <div className="preview-header">
            <strong>{copy.preview}</strong>
            <span>{networkStandard}</span>
          </div>
          <dl>
            <div><dt>{copy.from}</dt><dd>{sender.trim()}</dd></div>
            <div><dt>{copy.recipient}</dt><dd>{recipient.trim()}</dd></div>
            <div><dt>{copy.amount}</dt><dd>{signedTransfer.amountDoge} DOGE</dd></div>
            <div><dt>{copy.feeRate}</dt><dd>{signedTransfer.feeRateDogePerKb} {feeUnit}</dd></div>
            <div><dt>{copy.fee}</dt><dd>{signedTransfer.feeDoge} DOGE</dd></div>
            <div><dt>{copy.change}</dt><dd>{signedTransfer.changeDoge} DOGE</dd></div>
            <div><dt>{copy.inputCount}</dt><dd>{signedTransfer.inputCount}</dd></div>
            <div className="preview-txid"><dt>{copy.txid}</dt><dd>{signedTransfer.txid}</dd></div>
            <div><dt>{copy.network}</dt><dd>{networkName}</dd></div>
          </dl>
          <small>{copy.previewSignedLocal}</small>

          <div className="broadcast-actions">
            <button
              className="broadcast-button"
              type="button"
              onClick={() => void broadcastPreparedTransfer()}
              disabled={state === 'broadcasting' || state === 'broadcasted'}
            >
              {state === 'broadcasting' ? copy.broadcasting : copy.sendToNetwork}
            </button>
            {state === 'broadcasted' && broadcastTxid && (
              <div className="broadcast-success">
                <strong>{copy.broadcastSuccess}</strong>
                <span>{copy.broadcastedTxid}: <code>{broadcastTxid}</code></span>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
