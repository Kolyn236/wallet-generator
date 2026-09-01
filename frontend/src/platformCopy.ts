import type { Language } from './i18n';

export const platformCopy: Record<Language, {
  subtitle: string;
  walletTilesHint: string;
  securityText: string;
  reloadWarning: string;
}> = {
  en: {
    subtitle: 'Dogecoin, Bitcoin and Ethereum are live non-custodial wallet flows. Create a wallet locally or connect an existing public address; signing keys stay in the browser.',
    walletTilesHint: 'DOGE, BTC and ETH support local wallet creation, watch-only addresses and browser-signed transfers.',
    securityText: 'DOGE, BTC and ETH transaction signing happens locally in the browser. Seed, WIF and private keys never go to Symfony.',
    reloadWarning: 'Save the seed before reloading or closing the page. The unlocked wallet exists only in this browser tab.',
  },
  ru: {
    subtitle: 'Dogecoin, Bitcoin и Ethereum работают как non-custodial кошельки: создаём локально или подключаем существующий публичный адрес, а ключи подписи остаются в браузере.',
    walletTilesHint: 'Для DOGE, BTC и ETH работают создание, watch-only адреса и локально подписанные переводы.',
    securityText: 'Подпись DOGE-, BTC- и ETH-транзакций выполняется локально в браузере. Seed, WIF и private key никогда не уходят в Symfony.',
    reloadWarning: 'Сохраните seed до перезагрузки или закрытия страницы. Разблокированный кошелёк существует только в этой вкладке браузера.',
  },
};
