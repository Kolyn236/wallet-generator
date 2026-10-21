import type { Language } from './i18n';

export const platformCopy: Record<Language, {
  subtitle: string;
  walletTilesHint: string;
  securityText: string;
  reloadWarning: string;
}> = {
  en: {
    subtitle: 'DOGE, BTC, LTC, ETH and USDT on Ethereum or TRON. Keys and signing stay in your browser; you control publication to the network. Selecting a USDT network is not a swap or bridge.',
    walletTilesHint: 'Choose an asset and network for public balances and browser-local signing.',
    securityText: 'Seed phrases, WIF and private keys remain in browser memory. Symfony neither signs nor broadcasts transactions or custodies funds. Publish through your chosen direct provider or export the signed transaction.',
    reloadWarning: 'Save the seed before reloading or closing the page. The unlocked wallet exists only in this browser tab.',
  },
  ru: {
    subtitle: 'DOGE, BTC, LTC, ETH и USDT в Ethereum или TRON. Ключи и подпись остаются в браузере; публикацией в сеть управляете вы. Выбор сети USDT — не обмен и не мост.',
    walletTilesHint: 'Выберите валюту и сеть для просмотра баланса и локальной подписи.',
    securityText: 'Seed-фразы, WIF и приватные ключи остаются в памяти браузера. Symfony не подписывает, не отправляет транзакции и не хранит средства. Публикуйте через выбранного прямого провайдера или экспортируйте подписанную транзакцию.',
    reloadWarning: 'Сохраните seed до перезагрузки или закрытия страницы. Разблокированный кошелёк существует только в этой вкладке браузера.',
  },
};
