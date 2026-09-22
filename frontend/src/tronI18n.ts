import type { Language } from './i18n';

/** User-facing copy for the separate USDT TRC-20 route. Keep this route distinct from Ethereum ERC-20. */
export const tronMessages: Record<Language, {
  network: string;
  route: string;
  transferText: string;
  feeModel: string;
  amountLabel: string;
  contractLabel: string;
  feeLimitLabel: string;
  resourcesLabel: string;
  activationWarning: string;
  preparing: string;
  readyToSign: string;
  signedNotBroadcast: string;
  acceptedForBroadcast: string;
  observed: string;
  includedSolidified: string;
  executedSuccessfully: string;
  executionFailed: string;
  expiredUnknown: string;
  prepareError: string;
  broadcastError: string;
  statusLookup: string;
  retryIdentical: string;
  noAutomaticReplacement: string;
  secretsLocal: string;
}> = {
  en: {
    network: 'TRON Mainnet', route: 'USDT · TRC-20',
    transferText: 'USDT TRC-20 uses a separate TRON wallet identity. The browser builds and signs the transaction locally; Symfony only prepares public chain data and broadcasts already-signed bytes.',
    feeModel: 'USDT TRC-20 · TRON Mainnet · network resources and fees are paid in TRX.',
    amountLabel: 'USDT amount', contractLabel: 'TRC-20 contract', feeLimitLabel: 'Maximum TRX fee limit', resourcesLabel: 'Bandwidth and energy estimate',
    activationWarning: 'The recipient account is not active. Account activation may be required before this transfer can execute.',
    preparing: 'Preparing TRON resources and transaction…', readyToSign: 'Ready to sign', signedNotBroadcast: 'Signed locally · not broadcast', acceptedForBroadcast: 'Accepted for broadcast', observed: 'Observed', includedSolidified: 'Included (solidified)', executedSuccessfully: 'Executed successfully', executionFailed: 'Execution failed', expiredUnknown: 'Expired / unknown',
    prepareError: 'Could not prepare the TRC-20 transaction. Check the TRON provider and public intent.', broadcastError: 'The TRON provider rejected the signed transaction or is unavailable.', statusLookup: 'Check transaction status', retryIdentical: 'Retry the identical signed transaction', noAutomaticReplacement: 'A timeout never creates a replacement transaction. Retry only with the same signed bytes or look up its status.',
    secretsLocal: 'Seed phrases and private keys stay in browser memory. Symfony never receives or uses signing secrets.',
  },
  ru: {
    network: 'TRON Mainnet', route: 'USDT · TRC-20',
    transferText: 'USDT TRC-20 использует отдельный кошелёк TRON. Браузер локально собирает и подписывает транзакцию, а Symfony только готовит публичные данные сети и отправляет уже подписанные байты.',
    feeModel: 'USDT TRC-20 · TRON Mainnet · ресурсы и комиссия сети оплачиваются в TRX.',
    amountLabel: 'Сумма USDT', contractLabel: 'Контракт TRC-20', feeLimitLabel: 'Максимальный лимит комиссии в TRX', resourcesLabel: 'Оценка bandwidth и energy',
    activationWarning: 'Аккаунт получателя не активен. Для выполнения перевода может потребоваться активация аккаунта.',
    preparing: 'Готовим ресурсы TRON и транзакцию…', readyToSign: 'Готово к подписи', signedNotBroadcast: 'Подписано локально · не отправлено', acceptedForBroadcast: 'Принято для отправки в сеть', observed: 'Наблюдается в сети', includedSolidified: 'Включено (подтверждено SolidityNode)', executedSuccessfully: 'Выполнено успешно', executionFailed: 'Выполнение завершилось ошибкой', expiredUnknown: 'Истекло / неизвестно',
    prepareError: 'Не удалось подготовить TRC-20 транзакцию. Проверьте TRON-провайдер и публичное намерение перевода.', broadcastError: 'TRON-провайдер отклонил подписанную транзакцию или недоступен.', statusLookup: 'Проверить статус транзакции', retryIdentical: 'Повторить с той же подписанной транзакцией', noAutomaticReplacement: 'Тайм-аут не создаёт замену транзакции. Повторяйте только с теми же подписанными байтами или проверьте статус.',
    secretsLocal: 'Seed-фразы и приватные ключи остаются в памяти браузера. Symfony никогда не получает и не использует секреты подписи.',
  },
};
