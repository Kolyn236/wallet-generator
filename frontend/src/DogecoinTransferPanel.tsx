import { FormEvent, useMemo, useState } from 'react';
import {
  broadcastDogecoinTransaction,
  getDogecoinUtxos,
  WalletApiError,
} from './api';
import { type AssetId } from './assets';
import { type Language, messages } from './i18n';
import { isDogecoinMainnetAddress, type DogecoinSigningWallet } from './wallet/dogecoin';
import {
  buildSignedDogecoinTransfer,
  type SignedDogecoinTransfer,
} from './wallet/dogecoinTransaction';

type DogecoinWalletMode = 'none' | 'created' | 'connected' | 'watch-only';
type TransferState = 'idle' | 'preparing' | 'prepared' | 'broadcasting' | 'broadcasted';
type TransferError =
  | 'form'
  | 'recipient-invalid'
  | 'watch-only'
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
  signingWallet: DogecoinSigningWallet | null;
};

export function DogecoinTransferPanel({
  language,
  assetId,
  assetSymbol,
  networkName,
  networkStandard,
  sourceAddress,
  walletMode,
  signingWallet,
}: Props) {
  const copy = messages[language];
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [state, setState] = useState<TransferState>('idle');
  const [error, setError] = useState<TransferError | null>(null);
  const [signedTransfer, setSignedTransfer] = useState<SignedDogecoinTransfer | null>(null);
  const [broadcastTxid, setBroadcastTxid] = useState<string | null>(null);

  const busy = state === 'preparing' || state === 'broadcasting';
  const canSign = assetId === 'doge'
    && (walletMode === 'created' || walletMode === 'connected')
    && signingWallet !== null;

  const errorMessage = useMemo(() => {
    switch (error) {
      case 'form': return copy.formError;
      case 'recipient-invalid': return copy.recipientInvalid;
      case 'watch-only': return copy.transferWatchOnly;
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

  function updateRecipient(value: string) {
    setRecipient(value);
    resetResult();
  }

  function updateAmount(value: string) {
    setAmount(value);
    resetResult();
  }

  async function prepareTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetResult();

    if (assetId !== 'doge') {
      setError('unavailable');
      return;
    }
    if (!canSign || !signingWallet) {
      setError('watch-only');
      return;
    }

    const destination = recipient.trim();
    if (!destination || !amount.trim()) {
      setError('form');
      return;
    }
    if (!isDogecoinMainnetAddress(destination)) {
      setError('recipient-invalid');
      return;
    }

    setState('preparing');

    try {
      const response = await getDogecoinUtxos(signingWallet.address);
      const built = buildSignedDogecoinTransfer({
        wif: signingWallet.wif,
        sourceAddress: signingWallet.address,
        recipientAddress: destination,
        amount,
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
        if (caught.message === 'invalid_address') setError('recipient-invalid');
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
          <input value={sourceAddress} placeholder={copy.fromPlaceholder} autoComplete="off" readOnly />
        </label>
        <label>
          <span>{copy.recipient}</span>
          <input
            value={recipient}
            onChange={(event) => updateRecipient(event.target.value)}
            placeholder={copy.recipientPlaceholder}
            autoComplete="off"
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
            <span>{copy.fee}</span>
            <div className="readonly-field">{signedTransfer ? `${signedTransfer.feeDoge} DOGE` : copy.automatic}</div>
          </label>
        </div>

        {!canSign && assetId === 'doge' && walletMode === 'watch-only' && (
          <p className="transfer-notice">{copy.transferWatchOnly}</p>
        )}
        {!canSign && assetId === 'doge' && walletMode === 'none' && (
          <p className="transfer-notice">{copy.walletEmpty}</p>
        )}
        {assetId !== 'doge' && <p className="transfer-notice">{copy.transferUnavailable}</p>}
        {errorMessage && <p className="form-error">{errorMessage}</p>}

        <button className="submit-button" type="submit" disabled={busy || !canSign}>
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
            <div><dt>{copy.from}</dt><dd>{sourceAddress}</dd></div>
            <div><dt>{copy.recipient}</dt><dd>{recipient.trim()}</dd></div>
            <div><dt>{copy.amount}</dt><dd>{signedTransfer.amountDoge} DOGE</dd></div>
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