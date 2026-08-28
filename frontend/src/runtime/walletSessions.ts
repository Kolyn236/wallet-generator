import type { NetworkId } from '../assets';
import type { WalletSession } from './WalletNetworkAdapter';

export type WalletSessions = Partial<Record<NetworkId, WalletSession>>;

const EMPTY_WALLET_SESSION: WalletSession = {
  address: '',
  balance: null,
  mode: 'none',
};

export function createWalletSessions(): WalletSessions {
  return {};
}

export function getWalletSession(sessions: WalletSessions, networkId: NetworkId): WalletSession {
  return sessions[networkId] ?? { ...EMPTY_WALLET_SESSION };
}

export function withWalletSession(
  sessions: WalletSessions,
  networkId: NetworkId,
  session: WalletSession,
): WalletSessions {
  return {
    ...sessions,
    [networkId]: session,
  };
}
