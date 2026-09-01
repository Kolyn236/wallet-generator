import { FormEvent, useMemo, useState } from 'react';
import {
  broadcastEthereumTransaction,
  prepareEthereumTransaction,
  WalletApiError,
} from './api';
import { type Language, messages } from './i18n';
import { isEthereumMainnetAddress, type CreatedEthereumWallet } from './wallet/ethereum';
import {
  buildSignedEthereumTransfer,
  formatWeiToGwei,
  parseEthToWei,
  type SignedEthereumTransfer,
} from './wallet/ethereumTransaction';

type WalletMode = 'none' | 'created' | 'watch-only';
type TransferState = 'idle' | 'preparing' | 'prepared' | 'broadcasting' | 'broadcasted';
type TransferError =
  | 'form'
  | 'sender-invalid'
  | 'recipient-invalid'
  | 'private-key-required'
  | 'private-key-invalid'
  | 'private-key-mismatch'
  | 'same-address'
  | 'prepare'
  | 'insufficient-funds'
  | 'signing'
  | 'broadcast';

type Props = {
  language: Language;
  networkName: string;
  networkStandard: string;
  sourceAddress: string;
  walletMode: WalletMode;
  createdWallet: CreatedEthereumWallet | null;
};

export function EthereumTransferPanel({
  language,
  networkName,
  networkStandard,
  sourceAddress,
  walletMode,
  createdWallet,
}: Props) {
  const copy = messages[language];
  const [sender, setSender] = useState(sourceAddress);
  const [privateKey, setPrivateKey] = useState(createdWallet?.privateKey ?? '');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [state, setState] = useState<TransferState>('idle');
  const [error, setError] = useState<TransferError | null>(null);
  const [signedTransfer, setSignedTransfer] = useState<SignedEthereumTransfer | null>(null);
  const [broadcastTxHash, setBroadcastTxHash] = useState<string | null>(null);

  const busy = state === 'preparing' || state === 'broadcasting';
  const errorMessage = useMemo(() => {
    switch (error) {
      case 'form': return copy.ethereumFormError;
      case 'sender-invalid': return copy.senderInvalid;
      case 'recipient-invalid': return copy.recipientInvalid;
      case 'private-key-required': return copy.privateKeyRequired;
      case 'private-key-invalid': return copy.privateKeyInvalid;
      case 'private-key-mismatch': return copy.privateKeyMismatch;
      case 'same-address': return copy.sameAddress;
      case 'prepare': return copy.ethereumPrepareError;
      case 'insufficient-funds': return copy.ethereumInsufficientFunds;
      case 'signing': return copy.signingError;
      case 'broadcast': return copy.broadcastError;
      default: return null;
    }
  }, [copy, error]);

  function resetResult() {
    setSignedTransfer(null);
    setBroadcastTxHash(null);
    setState('idle');
    setError(null);
  }

  async function prepareTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetResult();

    const source = sender.trim();
    const destination = recipient.trim();
    const signingKey = privateKey.trim();
    const enteredAmount = amount.trim();

    if (!source || !destination || !enteredAmount) {
      setError('form');
      return;
    }
    if (!signingKey) {
      setError('private-key-required');
      return;
    }
    if (!isEthereumMainnetAddress(source)) {
      setError('sender-invalid');
      return;
    }
    if (!isEthereumMainnetAddress(destination)) {
      setError('recipient-invalid');
      return;
    }
    if (source.toLowerCase() === destination.toLowerCase()) {
      setError('same-address');
      return;
    }

    let valueWei: string;
    try {
      valueWei = parseEthToWei(enteredAmount);
    } catch {
      setError('form');
      return;
    }

    setState('preparing');

    try {
      const prepared = await prepareEthereumTransaction({
        from: source,
        to: destination,
        valueWei,
        data: '0x',
      });
      const signed = buildSignedEthereumTransfer({
        privateKey: signingKey,
        sourceAddress: source,
        recipientAddress: destination,
        amountEth: enteredAmount,
        prepared,
      });
      setSignedTransfer(signed);
      setState('prepared');
    } catch (caught: unknown) {
      setState('idle');

      if (caught instanceof WalletApiError) {
        setError('prepare');
        return;
      }
      if (caught instanceof Error) {
        if (caught.message === 'invalid_private_key') setError('private-key-invalid');
        else if (caught.message === 'wallet_key_mismatch') setError('private-key-mismatch');
        else if (caught.message === 'invalid_sender') setError('sender-invalid');
        else if (caught.message === 'invalid_recipient') setError('recipient-invalid');
        else if (caught.message === 'same_address') setError('same-address');
        else if (caught.message === 'invalid_amount') setError('form');
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
      const result = await broadcastEthereumTransaction(signedTransfer.rawTransaction);
      if (result.txHash.toLowerCase() !== signedTransfer.txHash.toLowerCase()) {
        throw new Error('broadcast_tx_hash_mismatch');
      }
      setBroadcastTxHash(result.txHash);
      setState('broadcasted');
    } catch {
      setState('prepared');
      setError('broadcast');
    }
  }

  return (
    <section className="transfer-card" id="transfer">
      <div className="transfer-copy">
        <span className="muted-label">ETH · {networkStandard}</span>
        <h2>{copy.transferTitle}</h2>
        <p>{copy.ethereumTransferText}</p>
        <small className="transfer-policy">{copy.ethereumFeeModel}</small>
      </div>

      <form className="transfer-form" onSubmit={prepareTransfer}>
        <label>
          <span>{copy.from}</span>
          <input value={sender} onChange={(event) => { setSender(event.target.value); resetResult(); }} placeholder={copy.fromPlaceholder} autoComplete="off" spellCheck={false} disabled={busy} />
        </label>
        <label>
          <span>{copy.privateKey}</span>
          <input type="password" value={privateKey} onChange={(event) => { setPrivateKey(event.target.value); resetResult(); }} placeholder={copy.privateKeyPlaceholder} autoComplete="off" spellCheck={false} disabled={busy} />
          <small className="transfer-policy">{copy.privateKeyHint}</small>
        </label>
        <label>
          <span>{copy.recipient}</span>
          <input value={recipient} onChange={(event) => { setRecipient(event.target.value); resetResult(); }} placeholder={copy.ethereumRecipientPlaceholder} autoComplete="off" spellCheck={false} disabled={busy} />
        </label>
        <label>
          <span>{copy.amount}</span>
          <div className="amount-field">
            <input value={amount} onChange={(event) => { setAmount(event.target.value); resetResult(); }} inputMode="decimal" placeholder={copy.amountPlaceholder} autoComplete="off" disabled={busy} />
            <strong>ETH</strong>
          </div>
        </label>

        {walletMode === 'watch-only' && <p className="transfer-notice">{copy.ethereumTransferWatchOnly}</p>}
        {walletMode === 'none' && <p className="transfer-notice">{copy.ethereumTransferAnySender}</p>}
        {errorMessage && <p className="form-error">{errorMessage}</p>}

        <button className="submit-button" type="submit" disabled={busy}>
          {state === 'preparing' ? copy.ethereumPreparingTransfer : copy.previewTransfer}
        </button>
      </form>

      {signedTransfer && (
        <div className="transfer-preview">
          <div className="preview-header"><strong>{copy.preview}</strong><span>{networkStandard}</span></div>
          <dl>
            <div><dt>{copy.from}</dt><dd>{signedTransfer.from}</dd></div>
            <div><dt>{copy.recipient}</dt><dd>{signedTransfer.to}</dd></div>
            <div><dt>{copy.amount}</dt><dd>{signedTransfer.amountEth} ETH</dd></div>
            <div><dt>{copy.ethereumNonce}</dt><dd>{signedTransfer.nonce}</dd></div>
            <div><dt>{copy.ethereumGasLimit}</dt><dd>{signedTransfer.gasLimit}</dd></div>
            <div><dt>{copy.ethereumBaseFee}</dt><dd>{formatWeiToGwei(signedTransfer.baseFeePerGasWei)} Gwei</dd></div>
            <div><dt>{copy.ethereumPriorityFee}</dt><dd>{signedTransfer.maxPriorityFeePerGasGwei} Gwei</dd></div>
            <div><dt>{copy.ethereumMaxFeePerGas}</dt><dd>{signedTransfer.maxFeePerGasGwei} Gwei</dd></div>
            <div><dt>{copy.ethereumMaxNetworkFee}</dt><dd>{signedTransfer.maxNetworkFeeEth} ETH</dd></div>
            <div><dt>{copy.ethereumMaxTotal}</dt><dd>{signedTransfer.maxTotalEth} ETH</dd></div>
            <div className="preview-txid"><dt>{copy.ethereumTxHash}</dt><dd>{signedTransfer.txHash}</dd></div>
            <div><dt>{copy.network}</dt><dd>{networkName}</dd></div>
          </dl>
          <small>{copy.previewSignedLocal}</small>

          <div className="broadcast-actions">
            <button className="broadcast-button" type="button" onClick={() => void broadcastPreparedTransfer()} disabled={state === 'broadcasting' || state === 'broadcasted'}>
              {state === 'broadcasting' ? copy.broadcasting : copy.sendToNetwork}
            </button>
            {state === 'broadcasted' && broadcastTxHash && (
              <div className="broadcast-success">
                <strong>{copy.broadcastSuccess}</strong>
                <span>{copy.ethereumBroadcastedTxHash}: <code>{broadcastTxHash}</code></span>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
