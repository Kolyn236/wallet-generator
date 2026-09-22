import type { Language } from './i18n';

export const platformCopy: Record<Language, {
  subtitle: string;
  walletTilesHint: string;
  securityText: string;
  reloadWarning: string;
}> = {
  en: {
    subtitle: 'Dogecoin, Bitcoin, Ethereum and USDT ERC-20 are live non-custodial wallet flows. USDT TRC-20 is a separate TRON route; signing keys stay in the browser.',
    walletTilesHint: 'DOGE, BTC, ETH and USDT ERC-20 support live balances and browser-signed transfers. USDT TRC-20 remains a separate planned route.',
    securityText: 'DOGE, BTC, ETH and USDT ERC-20 transaction signing happens locally in the browser. Seed phrases, WIF and private keys are never sent to the server; TRON uses the same browser-only security model.',
    reloadWarning: 'Save the seed before reloading or closing the page. The unlocked wallet exists only in this browser tab.',
  },
  ru: {
    subtitle: 'Dogecoin, Bitcoin, Ethereum и USDT ERC-20 работают как non-custodial кошельки. USDT TRC-20 — отдельный маршрут TRON, а ключи подписи остаются в браузере.',
    walletTilesHint: 'Для DOGE, BTC, ETH и USDT ERC-20 работают живые балансы и локально подписанные переводы. USDT TRC-20 пока отдельный запланированный маршрут.',
    securityText: 'Подпись DOGE-, BTC-, ETH- и USDT ERC-20-транзакций выполняется локально в браузере. Seed-фразы, WIF и приватные ключи никогда не отправляются на сервер; для TRON действует та же модель.',
    reloadWarning: 'Сохраните seed до перезагрузки или закрытия страницы. Разблокированный кошелёк существует только в этой вкладке браузера.',
  },
};
