import { assertPreparedIntent } from './wallet/ethereumTransaction';
import { transferReviewMessages } from './transferReviewI18n';
import { BroadcastControls } from './broadcast/BroadcastControls';
import { broadcastSignedTransaction, type BroadcastDestination } from './broadcast/browserBroadcast';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  prepareEthereumTransaction,
  WalletApiError,
} from './api';
import { ethereumMessages } from './ethereumI18n';
import { type Language, messages } from './i18n';
import {
  ethereumPrivateKeyMatchesAddress,
  isEthereumMainnetAddress,
  normalizeEthereumPrivateKey,
  type CreatedEthereumWallet,
} from './wallet/ethereum';
import {
  buildSignedEthereumTransfer,
  formatWeiToGwei,
  parseEthToWei,
  type SignedEthereumTransfer,
} from './wallet/ethereumTransaction';

type WalletMode = 'none' | 'created' | 'watch-only';
type TransferState = 'idle' | 'preparing' | 'review' | 'prepared' | 'broadcasting' | 'broadcasted';
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
  const reviewCopy = transferReviewMessages[language];
  const ethCopy = ethereumMessages[language];
  const [sender, setSender] = useState(sourceAddress);
  const [privateKey, setPrivateKey] = useState(createdWallet?.privateKey ?? '');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [state, setState] = useState<TransferState>('idle');
  const [error, setError] = useState<TransferError | null>(null);
  const generation = useRef(0);
  const [publicPreparation, setPublicPreparation] = useState<Readonly<Omit<Parameters<typeof buildSignedEthereumTransfer>[0], 'privateKey'>> | null>(null);
  const [signedTransfer, setSignedTransfer] = useState<SignedEthereumTransfer | null>(null);
  const [broadcastTxHash, setBroadcastTxHash] = useState<string | null>(null);

  const busy = state === 'preparing' || state === 'broadcasting';
  const errorMessage = useMemo(() => {
    switch (error) {
      case 'form': return ethCopy.formError;
      case 'sender-invalid': return copy.senderInvalid;
      case 'recipient-invalid': return copy.recipientInvalid;
      case 'private-key-required': return ethCopy.privateKeyRequired;
      case 'private-key-invalid': return ethCopy.privateKeyInvalid;
      case 'private-key-mismatch': return ethCopy.privateKeyMismatch;
      case 'same-address': return copy.sameAddress;
      case 'prepare': return ethCopy.prepareError;
      case 'insufficient-funds': return ethCopy.insufficientFunds;
      case 'signing': return copy.signingError;
      case 'broadcast': return copy.broadcastError;
      default: return null;
    }
  }, [copy, ethCopy, error]);

  function resetResult() {
    generation.current += 1;
    setPublicPreparation(null);
    setSignedTransfer(null);
    setBroadcastTxHash(null);
    setState('idle');
    setError(null);
  }

  useEffect(() => {
    resetResult();
    setSender(sourceAddress);
    setPrivateKey(createdWallet?.privateKey ?? '');
    return () => { generation.current += 1; };
  }, [sourceAddress, createdWallet?.address, createdWallet?.privateKey, walletMode, networkName, networkStandard]);

  async function prepareTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetResult();
    const requestGeneration = generation.current;

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

    try {
      normalizeEthereumPrivateKey(signingKey);
    } catch {
      setError('private-key-invalid');
      return;
    }
    if (!ethereumPrivateKeyMatchesAddress(signingKey, source)) {
      setError('private-key-mismatch');
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
      if (generation.current !== requestGeneration) return;
      assertPreparedIntent(prepared, source, destination, valueWei, '0x');
      const quantities = [prepared.valueWei, prepared.senderBalanceWei, prepared.nonce, prepared.gasLimit,
        prepared.feePolicy.baseFeePerGasWei, prepared.feePolicy.maxFeePerGasWei, prepared.feePolicy.maxPriorityFeePerGasWei];
      if (quantities.some((value) => typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value))) throw new Error('invalid_fee');
      if (BigInt(prepared.gasLimit) <= 0n || BigInt(prepared.feePolicy.maxFeePerGasWei) <= 0n
        || BigInt(prepared.feePolicy.maxFeePerGasWei) < BigInt(prepared.feePolicy.maxPriorityFeePerGasWei)) throw new Error('invalid_fee');
      if (BigInt(prepared.valueWei) + BigInt(prepared.gasLimit) * BigInt(prepared.feePolicy.maxFeePerGasWei) > BigInt(prepared.senderBalanceWei)) throw new Error('insufficient_funds');
      const snapshot = Object.freeze({ ...prepared, feePolicy: Object.freeze({ ...prepared.feePolicy }) });
      setPublicPreparation(Object.freeze({
        sourceAddress: source,
        recipientAddress: destination,
        amountEth: enteredAmount,
        prepared: snapshot,
      }));
      setState('review');
    } catch (caught: unknown) {
      if (generation.current !== requestGeneration) return;
      handleTransferError(caught);
    }
  }

  function signTransfer() {
    if (!publicPreparation || state !== 'review') return;
    setError(null);
    try {
      // Use only the reviewed public snapshot and the current in-memory key.
      // The canonical builder rechecks key/source ownership before signing.
      const signed = buildSignedEthereumTransfer({ ...publicPreparation, privateKey: privateKey.trim() });
      setSignedTransfer(signed);
      setState('prepared');
    } catch (caught: unknown) {
      handleTransferError(caught);
    }
  }

  function handleTransferError(caught: unknown) {
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

  async function broadcastPreparedTransfer(destination: BroadcastDestination) {
    if (!signedTransfer || state !== 'prepared') return;

    const requestGeneration = generation.current;
    setState('broadcasting');
    setError(null);

    try {
      const result = await broadcastSignedTransaction(destination, { rawTransaction: signedTransfer.rawTransaction, txid: signedTransfer.txHash });
      if (generation.current !== requestGeneration) return;
      if (result.txid.toLowerCase() !== signedTransfer.txHash.toLowerCase()) {
        throw new Error('broadcast_tx_hash_mismatch');
      }
      setBroadcastTxHash(result.txid);
      setState('broadcasted');
    } catch {
      if (generation.current !== requestGeneration) return;
      setState('prepared');
      setError('broadcast');
    }
  }

  return (
    <section className="transfer-card" id="transfer">
      <div className="transfer-copy">
        <span className="muted-label">ETH · {networkStandard}</span>
        <h2>{copy.transferTitle}</h2>
        <p>{ethCopy.transferText}</p>
        <small className="transfer-policy">{ethCopy.feeModel}</small>
      </div>

      <form className="transfer-form" onSubmit={prepareTransfer}>
        <label>
          <span>{copy.from}</span>
          <input value={sender} onChange={(event) => { setSender(event.target.value); resetResult(); }} placeholder={copy.fromPlaceholder} autoComplete="off" spellCheck={false} disabled={busy} />
        </label>
        <label>
          <span>{copy.privateKey}</span>
          <input type="password" value={privateKey} onChange={(event) => { setPrivateKey(event.target.value); resetResult(); }} placeholder={ethCopy.privateKeyPlaceholder} autoComplete="off" spellCheck={false} disabled={busy} />
          <small className="transfer-policy">{ethCopy.privateKeyHint}</small>
        </label>
        <label>
          <span>{copy.recipient}</span>
          <input value={recipient} onChange={(event) => { setRecipient(event.target.value); resetResult(); }} placeholder={ethCopy.recipientPlaceholder} autoComplete="off" spellCheck={false} disabled={busy} />
        </label>
        <label>
          <span>{copy.amount}</span>
          <div className="amount-field">
            <input value={amount} onChange={(event) => { setAmount(event.target.value); resetResult(); }} inputMode="decimal" placeholder={copy.amountPlaceholder} autoComplete="off" disabled={busy} />
            <strong>ETH</strong>
          </div>
        </label>

        {walletMode === 'watch-only' && <p className="transfer-notice">{ethCopy.transferWatchOnly}</p>}
        {walletMode === 'none' && <p className="transfer-notice">{ethCopy.transferAnySender}</p>}
        {errorMessage && <p className="form-error">{errorMessage}</p>}

        <button className="submit-button" type="submit" disabled={busy}>
          {state === 'preparing' ? ethCopy.preparingTransfer : reviewCopy.prepare}
        </button>
      </form>

      {publicPreparation && !signedTransfer && (
        <div className="transfer-preview">
          <div className="preview-header"><strong>{reviewCopy.review}</strong><span>{networkStandard}</span></div>
          <p>{reviewCopy.unsigned}</p>
          <dl>
            <div><dt>{copy.from}</dt><dd>{publicPreparation.sourceAddress}</dd></div>
            <div><dt>{copy.recipient}</dt><dd>{publicPreparation.recipientAddress}</dd></div>
            <div><dt>{copy.amount}</dt><dd>{publicPreparation.amountEth} ETH</dd></div>
            <div><dt>{copy.network}</dt><dd>{networkName} · {networkStandard}</dd></div>
            <div><dt>{reviewCopy.chainId}</dt><dd>{publicPreparation.prepared.chainId}</dd></div>
            <div><dt>{ethCopy.nonce}</dt><dd>{publicPreparation.prepared.nonce}</dd></div>
            <div><dt>{ethCopy.gasLimit}</dt><dd>{publicPreparation.prepared.gasLimit}</dd></div>
            <div><dt>{reviewCopy.contract}</dt><dd>{publicPreparation.prepared.to}</dd></div>
            <div><dt>{reviewCopy.value}</dt><dd>{publicPreparation.prepared.valueWei}</dd></div>
            <div><dt>{reviewCopy.data}</dt><dd>{publicPreparation.prepared.data}</dd></div>
            <div><dt>{reviewCopy.balance}</dt><dd>{publicPreparation.prepared.senderBalanceWei}</dd></div>
            <div><dt>{ethCopy.baseFee}</dt><dd>{publicPreparation.prepared.feePolicy.baseFeePerGasWei} wei</dd></div>
            <div><dt>{ethCopy.priorityFee}</dt><dd>{publicPreparation.prepared.feePolicy.maxPriorityFeePerGasWei} wei</dd></div>
            <div><dt>{ethCopy.maxFeePerGas}</dt><dd>{publicPreparation.prepared.feePolicy.maxFeePerGasWei} wei</dd></div>
            <div><dt>{reviewCopy.maxFee}</dt><dd>{(BigInt(publicPreparation.prepared.gasLimit) * BigInt(publicPreparation.prepared.feePolicy.maxFeePerGasWei)).toString()}</dd></div>
            <div><dt>{reviewCopy.totalCost}</dt><dd>{(BigInt(publicPreparation.prepared.valueWei) + BigInt(publicPreparation.prepared.gasLimit) * BigInt(publicPreparation.prepared.feePolicy.maxFeePerGasWei)).toString()}</dd></div>
          </dl>
          <button className="submit-button" type="button" onClick={signTransfer} disabled={busy || state !== 'review'}>{reviewCopy.sign}</button>
        </div>
      )}

      {signedTransfer && (
        <div className="transfer-preview">
          <div className="preview-header"><strong>{copy.preview}</strong><span>{networkStandard}</span></div>
          <dl>
            <div><dt>{copy.from}</dt><dd>{signedTransfer.from}</dd></div>
            <div><dt>{copy.recipient}</dt><dd>{signedTransfer.to}</dd></div>
            <div><dt>{copy.amount}</dt><dd>{signedTransfer.amountEth} ETH</dd></div>
            <div><dt>{ethCopy.nonce}</dt><dd>{signedTransfer.nonce}</dd></div>
            <div><dt>{ethCopy.gasLimit}</dt><dd>{signedTransfer.gasLimit}</dd></div>
            <div><dt>{ethCopy.baseFee}</dt><dd>{formatWeiToGwei(signedTransfer.baseFeePerGasWei)} Gwei</dd></div>
            <div><dt>{ethCopy.priorityFee}</dt><dd>{signedTransfer.maxPriorityFeePerGasGwei} Gwei</dd></div>
            <div><dt>{ethCopy.maxFeePerGas}</dt><dd>{signedTransfer.maxFeePerGasGwei} Gwei</dd></div>
            <div><dt>{ethCopy.maxNetworkFee}</dt><dd>{signedTransfer.maxNetworkFeeEth} ETH</dd></div>
            <div><dt>{ethCopy.maxTotal}</dt><dd>{signedTransfer.maxTotalEth} ETH</dd></div>
            <div className="preview-txid"><dt>{ethCopy.txHash}</dt><dd>{signedTransfer.txHash}</dd></div>
            <div><dt>{copy.network}</dt><dd>{networkName}</dd></div>
          </dl>
          <small>{copy.previewSignedLocal}</small>

          <div className="broadcast-actions">
            <BroadcastControls language={language} kind="evm-json-rpc"
              rawTransaction={signedTransfer.rawTransaction} txid={signedTransfer.txHash}
              busy={state === 'broadcasting'} disabled={state === 'broadcasted'}
              onBroadcast={broadcastPreparedTransfer} />
            {state === 'broadcasted' && broadcastTxHash && (
              <div className="broadcast-success">
                <strong>{copy.broadcastSuccess}</strong>
                <span>{ethCopy.broadcastedTxHash}: <code>{broadcastTxHash}</code></span>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
