import { createElement as h } from 'react';
import { getAssetRouteAvailability, getAssetRoutes, getNetwork, type AssetRouteId } from './assets';
import type { Language } from './i18n';
import { getWalletSession, type WalletSessions } from './runtime/walletSessions';
import { getAssetRouteBalance, type AssetRouteBalances } from './runtime/assetRouteBalances';

const copy = {
  en: {
    title: 'Choose where your USDT already resides',
    note: 'Network selection is not a swap or bridge. Ethereum and TRON use separate wallets; no funds move when selecting a route.',
    wallet: 'wallet', fee: 'Network fee asset', local: 'Signing: browser only',
    empty: 'No wallet connected', localWallet: 'Local signing', watch: 'Watch-only',
    live: 'Available', planned: 'Planned', balance: 'Balance not loaded',
  },
  ru: {
    title: 'Выберите сеть, в которой уже находятся ваши USDT',
    note: 'Выбор сети — не обмен и не мост. Ethereum и TRON используют отдельные кошельки; выбор маршрута не перемещает средства.',
    wallet: 'кошелёк', fee: 'Валюта комиссии сети', local: 'Подпись: только в браузере',
    empty: 'Кошелёк не подключён', localWallet: 'Локальная подпись', watch: 'Только просмотр',
    live: 'Доступен', planned: 'Запланирован', balance: 'Баланс не загружен',
  },
};

export type UsdtRouteChooserProps = {
  language: Language;
  selectedRoute: AssetRouteId;
  sessions: WalletSessions;
  balances: AssetRouteBalances;
  onSelect(route: AssetRouteId): void;
};

// Pure view of existing catalog/session/balance state: rendering performs no I/O.
export function UsdtRouteChooser(props: UsdtRouteChooserProps) {
  const text = copy[props.language];
  return h('section', { className: 'usdt-route-chooser', 'aria-label': text.title },
    h('h3', null, text.title),
    h('p', null, text.note),
    h('div', { className: 'usdt-route-options' }, getAssetRoutes('usdt').map(route => {
      const network = getNetwork(route.networkId);
      const session = getWalletSession(props.sessions, route.networkId);
      const balance = getAssetRouteBalance(props.balances, route.id);
      const connected = session.mode !== 'none' && session.address !== '';
      const visibleBalance = connected && balance.status === 'loaded'
        && balance.address === session.address ? balance.balance : null;
      return h('button', {
        key: route.id, type: 'button', className: 'usdt-route-option',
        'aria-pressed': props.selectedRoute === route.id,
        onClick: () => props.onSelect(route.id),
      },
      h('strong', null, `${network.name} · ${route.standard}`),
      h('span', null, getAssetRouteAvailability(route.id) === 'ready-next' ? text.live : text.planned),
      h('span', null, `${network.name} ${text.wallet} · ${session.mode === 'local-signing' ? text.localWallet : session.mode === 'watch-only' ? text.watch : text.empty}`),
      connected ? h('code', null, session.address) : null,
      h('span', null, visibleBalance !== null ? `${visibleBalance} USDT` : text.balance),
      h('span', null, `${text.fee}: ${network.chainId === 'ethereum' ? 'ETH' : 'TRX'}`),
      h('small', null, text.local));
    })),
  );
}
