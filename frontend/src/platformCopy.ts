import type { Language } from './i18n';

export const platformCopy: Record<Language, {
  subtitle: string;
  walletTilesHint: string;
  securityText: string;
  reloadWarning: string;
}> = {
  en: {
    subtitle: 'Dogecoin, Bitcoin, Ethereum and USDT ERC-20 are live non-custodial wallet flows. Ethereum-native assets share one browser-local wallet identity; signing keys stay in the browser.',
    walletTilesHint: 'DOGE, BTC, ETH and USDT ERC-20 support live balances and browser-signed transfers.',
    securityText: 'Transactions are signed locally in your browser. Seed phrases, WIFs and private keys stay with you and are never sent to the server.',
    reloadWarning: 'Save the seed before reloading or closing the page. The unlocked wallet exists only in this browser tab.',
  },
  ru: {
    subtitle: 'Dogecoin, Bitcoin, Ethereum и USDT ERC-20 работают как non-custodial кошельки. ETH и ERC-20 используют один локальный Ethereum-кошелёк, а ключи подписи остаются в браузере.',
    walletTilesHint: 'Для DOGE, BTC, ETH и USDT ERC-20 работают живые балансы и локально подписанные переводы.',
    securityText: 'Транзакции подписываются локально в вашем браузере. Seed-фразы, WIF и private key остаются у вас и никогда не отправляются на сервер.',
    reloadWarning: 'Сохраните seed до перезагрузки или закрытия страницы. Разблокированный кошелёк существует только в этой вкладке браузера.',
  },
};
