import { useState } from 'react';
import type { Language } from '../i18n';
import { messages } from '../i18n';
import { validateBroadcastEndpoint, type BroadcastDestination } from './browserBroadcast';

const broadcastMessages = {
  en: {
    destination: 'Your broadcast provider URL',
    hint: 'Optional: choose a trusted HTTPS provider that allows browser CORS. This URL stays in memory. Signed bytes go directly to that provider, never through this application’s backend. No public provider is assumed to be available.',
    utxo: 'Enter the full BlockCypher-compatible transaction push URL for this chain.',
    evm: 'Enter an Ethereum Mainnet JSON-RPC URL. Chain ID 1 is checked before sending.',
    tron: 'Enter a TRON node base URL (or its /wallet/broadcasthex URL).',
    invalid: 'Use an external HTTPS provider, not this application, localhost or an /api gateway URL.',
    export: 'Export signed transaction', download: 'Download signed transaction',
    warning: 'Export contains signed public bytes, not wallet keys. Anyone holding it can publish it. If CORS or your provider fails, export it for a trusted node/tool. A failed response does not mean the transaction was rejected: check the local TXID before retrying. Retrying sends the same signed bytes; it does not sign again.',
    bytes: 'Signed transaction hex (copy for your provider)',
  },
  ru: {
    destination: 'URL вашего провайдера отправки',
    hint: 'Необязательно: выберите доверенного HTTPS-провайдера с поддержкой браузерного CORS. URL хранится только в памяти. Подписанные данные идут прямо провайдеру, а не через сервер приложения. Доступность публичных провайдеров не гарантируется.',
    utxo: 'Укажите полный URL отправки транзакций, совместимый с BlockCypher, для этой сети.',
    evm: 'Укажите URL Ethereum Mainnet JSON-RPC. Перед отправкой проверяется Chain ID 1.',
    tron: 'Укажите базовый URL узла TRON (или его URL /wallet/broadcasthex).',
    invalid: 'Нужен внешний HTTPS-провайдер, а не это приложение, localhost или шлюз /api.',
    export: 'Экспорт подписанной транзакции', download: 'Скачать подписанную транзакцию',
    warning: 'Экспорт содержит подписанные публичные данные, а не ключи. Любой обладатель этих данных может отправить транзакцию. При ошибке CORS или провайдера экспортируйте её для доверенного узла или инструмента. Ошибка ответа не означает отклонение: проверьте локальный TXID перед повтором. Повтор отправляет те же байты без новой подписи.',
    bytes: 'Hex подписанной транзакции (для копирования провайдеру)',
  },
};

export type BroadcastControlsProps = {
  language: Language;
  kind: BroadcastDestination['kind'];
  rawTransaction: string;
  txid: string;
  busy: boolean;
  disabled: boolean;
  onBroadcast: (destination: BroadcastDestination) => void | Promise<void>;
};

/** Provider selection is ephemeral and publication always needs an explicit click. */
export function BroadcastControls({ language, kind, rawTransaction, txid, busy, disabled, onBroadcast }: BroadcastControlsProps) {
  const [endpoint, setEndpoint] = useState('');
  const text = broadcastMessages[language];
  const copy = messages[language];
  let valid = false;
  try { validateBroadcastEndpoint(endpoint); valid = true; } catch { /* Export remains available. */ }

  function download() {
    const blob = new Blob([rawTransaction], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `signed-transaction-${txid.replace(/[^0-9a-f]/gi, '')}.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return <div className="broadcast-controls">
    <label>
      <span>{text.destination}</span>
      <input type="url" value={endpoint} onChange={(event) => setEndpoint(event.target.value)}
        placeholder="https://…" autoComplete="off" spellCheck={false} disabled={busy || disabled} />
    </label>
    <p className="transfer-policy">{text.hint}</p>
    <small>{kind === 'utxo-blockcypher' ? text.utxo : kind === 'evm-json-rpc' ? text.evm : text.tron}</small>
    {endpoint && !valid && <p className="form-error">{text.invalid}</p>}
    <button className="broadcast-button" type="button" disabled={busy || disabled || !valid}
      onClick={() => { if (valid && !busy && !disabled) void onBroadcast({ kind, endpoint }); }}>
      {busy ? copy.broadcasting : copy.sendToNetwork}
    </button>
    <p className="transfer-notice">{text.warning}</p>
    <details>
      <summary>{text.export}</summary>
      <label><span>{text.bytes}</span><textarea readOnly value={rawTransaction} autoComplete="off" spellCheck={false} rows={4} /></label>
      <button className="text-button" type="button" onClick={download}>{text.download}</button>
    </details>
  </div>;
}
