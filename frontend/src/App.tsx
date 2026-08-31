import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  assets,
  getAsset,
  getAssetAvailability,
  getAssetRoute,
  getAssetRoutes,
  getDefaultAssetRoute,
  getNetwork,
  type AssetId,
  type AssetRouteId,
  type NetworkId,
} from './assets';
import { getHealth } from './api';
import { type Language, messages } from './i18n';
import { adapterRegistry } from './runtime/adapterRegistry';
import {
  createAssetRouteBalances,
  getAssetRouteBalance,
  invalidateAssetRouteBalancesForNetwork,
  withAssetRouteBalance,
  type AssetRouteBalances,
} from './runtime/assetRouteBalances';
import type { BrowserCreatedWallet } from './runtime/WalletNetworkAdapter';
import {
  createWalletSessions,
  getWalletSession,
  withWalletSession,
  type WalletSessions,
} from './runtime/walletSessions';

type HealthState = 'checking' | 'online' | 'offline';
type CopyState = 'none' | 'seed' | 'signing-material';

const LANGUAGE_KEY = 'wallet-platform-language';

function initialLanguage(): Language {
  const stored = localStorage.getItem(LANGUAGE_KEY);
  if (stored === 'ru' || stored === 'en') return stored;
  return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export function App() {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [health, setHealth] = useState<HealthState>('checking');
  const [assetId, setAssetId] = useState<AssetId>('doge');
  const [routeId, setRouteId] = useState<AssetRouteId>('doge-dogecoin-mainnet-native');
  const [sessions, setSessions] = useState<WalletSessions>(createWalletSessions);
  const [routeBalances, setRouteBalances] = useState<AssetRouteBalances>(createAssetRouteBalances);
  const [existingAddress, setExistingAddress] = useState('');
  const [showExistingForm, setShowExistingForm] = useState(false);
  const [addressError, setAddressError] = useState<'invalid' | 'balance' | null>(null);
  const [showBackupSecrets, setShowBackupSecrets] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>('none');
  const createdWalletRefs = useRef<Partial<Record<NetworkId, BrowserCreatedWallet>>>({});

  const copy = messages[language];
  const asset = getAsset(assetId);
  const route = getAssetRoute(routeId);
  const routes = getAssetRoutes(assetId);
  const network = getNetwork(route.networkId);
  const walletAdapter = adapterRegistry.resolveWalletNetwork(route.networkId);
  const routeAdapter = adapterRegistry.resolveAssetRoute(route.id);
  const session = getWalletSession(sessions, route.networkId);
  const routeBalance = getAssetRouteBalance(routeBalances, route.id);
  const balanceState = routeBalance.status;
  const displayedBalance = routeBalance.address === session.address ? routeBalance.balance : null;
  const connected = walletAdapter !== null && session.mode !== 'none' && session.address !== '';
  const createdWallet = walletAdapter !== null && session.mode === 'created'
    ? createdWalletRefs.current[route.networkId] ?? null
    : null;

  useEffect(() => {
    document.documentElement.lang = language;
    localStorage.setItem(LANGUAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    const controller = new AbortController();
    getHealth(controller.signal)
      .then(() => setHealth('online'))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setHealth('offline');
      });
    return () => controller.abort();
  }, []);

  const healthLabel = useMemo(() => {
    if (health === 'online') return copy.online;
    if (health === 'offline') return copy.offline;
    return copy.checking;
  }, [copy, health]);

  function resetWalletUi() {
    setExistingAddress('');
    setShowExistingForm(false);
    setShowBackupSecrets(false);
    setCopyState('none');
    setAddressError(null);
  }

  function selectAsset(nextAssetId: AssetId) {
    setAssetId(nextAssetId);
    setRouteId(getDefaultAssetRoute(nextAssetId).id);
    resetWalletUi();
  }

  function selectRoute(nextRouteId: AssetRouteId) {
    setRouteId(nextRouteId);
    setAddressError(null);
  }

  async function refreshBalance(nextRouteId: AssetRouteId, address: string): Promise<boolean> {
    const adapter = adapterRegistry.resolveAssetRoute(nextRouteId);
    if (!adapter || !adapter.capabilities.balance) {
      setRouteBalances((current) => withAssetRouteBalance(current, nextRouteId, {
        address,
        balance: null,
        status: 'error',
      }));
      setAddressError('balance');
      return false;
    }

    setRouteBalances((current) => withAssetRouteBalance(current, nextRouteId, {
      address,
      balance: null,
      status: 'loading',
    }));
    setAddressError(null);

    try {
      const result = await adapter.loadBalance(address);
      setRouteBalances((current) => withAssetRouteBalance(current, nextRouteId, {
        address: result.address,
        balance: result.balance,
        status: 'loaded',
      }));
      return true;
    } catch {
      setRouteBalances((current) => withAssetRouteBalance(current, nextRouteId, {
        address,
        balance: null,
        status: 'error',
      }));
      setAddressError('balance');
      return false;
    }
  }

  function createWallet() {
    if (!walletAdapter) return;

    const wallet = walletAdapter.createWallet();
    const networkId = walletAdapter.networkId;
    createdWalletRefs.current[networkId] = wallet;
    setSessions((current) => withWalletSession(current, networkId, {
      address: wallet.address,
      mode: 'created',
    }));
    setRouteBalances((current) => invalidateAssetRouteBalancesForNetwork(current, networkId));
    resetWalletUi();

    if (routeAdapter && routeAdapter.networkId === networkId) {
      void refreshBalance(route.id, wallet.address);
    }
  }

  async function specifyExistingWallet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!walletAdapter) return;

    const address = existingAddress.trim();
    if (!walletAdapter.validatePublicAddress(address)) {
      setAddressError('invalid');
      return;
    }

    delete createdWalletRefs.current[walletAdapter.networkId];
    setSessions((current) => withWalletSession(current, walletAdapter.networkId, {
      address,
      mode: 'watch-only',
    }));
    setRouteBalances((current) => invalidateAssetRouteBalancesForNetwork(current, walletAdapter.networkId));
    setShowExistingForm(false);
    setShowBackupSecrets(false);
    setCopyState('none');

    await refreshBalance(route.id, address);
  }

  async function copySecret(kind: 'seed' | 'signing-material') {
    if (!createdWallet || !navigator.clipboard) return;

    const secret = kind === 'seed'
      ? createdWallet.mnemonic
      : createdWallet.signingMaterial.value;
    try {
      await navigator.clipboard.writeText(secret);
      setCopyState(kind);
    } catch {
      setCopyState('none');
    }
  }

  const modeLabel = session.mode === 'created'
    ? copy.createdLocally
    : session.mode === 'watch-only'
      ? copy.watchOnly
      : copy.noWallet;

  const unavailableTransferPanel = (
    <section className="transfer-card" id="transfer">
      <div className="transfer-copy">
        <span className="muted-label">{asset.symbol} · {route.standard}</span>
        <h2>{copy.transferTitle}</h2>
        <p>{copy.transferText}</p>
        <p className="transfer-notice">{copy.transferUnavailable}</p>
      </div>
    </section>
  );

  const loadingTransferPanel = (
    <section className="transfer-card" id="transfer">
      <div className="transfer-copy">
        <span className="muted-label">{asset.symbol} · {route.standard}</span>
        <h2>{copy.transferTitle}</h2>
        <p>{copy.checking}</p>
      </div>
    </section>
  );

  const signingMaterialLabel = createdWallet?.signingMaterial.kind === 'private-key'
    ? copy.privateKey
    : copy.wif;
  const copySigningMaterialLabel = createdWallet?.signingMaterial.kind === 'private-key'
    ? copy.copyPrivateKey
    : copy.copyWif;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label={copy.brand}><span className="brand-mark">W</span><span>{copy.brand}</span></a>
        <nav className="nav" aria-label="Primary"><a href="#wallets">{copy.wallets}</a><a href="#transfer">{copy.transfer}</a><a href="#security">{copy.security}</a></nav>
        <div className="topbar-actions">
          <div className={`health health-${health}`} title={`${copy.backend}: ${healthLabel}`}><span className="health-dot" /><span>{healthLabel}</span></div>
          <div className="language-switch" aria-label="Language">
            <button className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')} type="button">EN</button>
            <button className={language === 'ru' ? 'active' : ''} onClick={() => setLanguage('ru')} type="button">RU</button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="intro"><p className="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p className="intro-copy">{copy.subtitle}</p></section>

        <section className="wallet-tiles-section" id="wallets">
          <div className="section-title-row"><div><span className="muted-label">{copy.myWallets}</span><p>{copy.walletTilesHint}</p></div></div>
          <div className="wallet-tiles">
            {assets.map((candidate) => {
              const candidateRoute = getDefaultAssetRoute(candidate.id);
              const candidateWalletAdapter = adapterRegistry.resolveWalletNetwork(candidateRoute.networkId);
              const candidateSession = getWalletSession(sessions, candidateRoute.networkId);
              const candidateRouteBalance = getAssetRouteBalance(routeBalances, candidateRoute.id);
              const candidateConnected = candidateWalletAdapter !== null
                && candidateSession.mode !== 'none'
                && candidateSession.address !== '';
              const candidateBalance = candidateRouteBalance.address === candidateSession.address
                ? candidateRouteBalance.balance
                : null;
              const candidateAvailability = getAssetAvailability(candidate.id);
              return (
                <button key={candidate.id} type="button" className={`wallet-tile ${candidate.id === assetId ? 'active' : ''}`} onClick={() => selectAsset(candidate.id)}>
                  <div className="wallet-tile-top"><span className="asset-mark">{candidate.mark}</span><span className={`asset-status status-${candidateAvailability}`}>{candidateAvailability === 'ready-next' ? copy.firstIntegration : copy.planned}</span></div>
                  <div><strong>{candidate.symbol}</strong><small>{candidateRoute.standard}</small></div>
                  <div className="tile-balance">{candidateConnected && candidateBalance !== null ? <strong>{candidateBalance} {candidate.symbol}</strong> : <span>{copy.noAddress}</span>}</div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="wallet-layout">
          <aside className="asset-panel">
            <div className="section-heading"><span>{copy.selectAsset}</span><strong>{assets.length}</strong></div>
            <div className="asset-list">
              {assets.map((candidate) => {
                const candidateAvailability = getAssetAvailability(candidate.id);
                return (
                  <button key={candidate.id} type="button" className={`asset-item ${candidate.id === assetId ? 'active' : ''}`} onClick={() => selectAsset(candidate.id)}>
                    <span className="asset-mark">{candidate.mark}</span><span className="asset-copy"><strong>{candidate.symbol}</strong><small>{candidate.name}</small></span>
                    <span className={`asset-status status-${candidateAvailability}`}>{candidateAvailability === 'ready-next' ? copy.firstIntegration : copy.planned}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="wallet-workspace">
            <section className="wallet-card">
              <div className="wallet-card-top">
                <div className="selected-asset"><span className="selected-mark">{asset.mark}</span><div><span className="muted-label">{copy.selectedWallet}</span><h2>{asset.name} <span>{asset.symbol}</span></h2></div></div>
                <span className="session-badge">{walletAdapter ? modeLabel : copy.planned}</span>
              </div>

              <div className="wallet-balance-row">
                <div><span className="muted-label">{copy.walletBalance}</span><strong>{walletAdapter && displayedBalance !== null ? `${displayedBalance} ${asset.symbol}` : `— ${asset.symbol}`}</strong></div>
                <div className="wallet-empty-copy"><p>{walletAdapter && session.address ? session.address : copy.walletEmpty}</p><small>{copy.walletHint}</small></div>
              </div>

              {walletAdapter ? (
                <>
                  {!connected && !showExistingForm && (
                    <div className="wallet-actions wallet-choice-actions">
                      <button type="button" className="primary-button" onClick={createWallet}>{copy.createWallet}</button>
                      <button type="button" className="secondary-button" onClick={() => { setShowExistingForm(true); setAddressError(null); }}>{copy.specifyExisting}</button>
                    </div>
                  )}

                  {showExistingForm && (
                    <form className="address-connect-form" onSubmit={specifyExistingWallet}>
                      <div className="connect-form-heading"><strong>{copy.existingTitle}</strong><p>{copy.existingHint}</p></div>
                      <label><span>{copy.publicAddress}</span><div className="address-connect-row">
                        <input value={existingAddress} onChange={(event) => setExistingAddress(event.target.value)} placeholder={copy.addressPlaceholder} autoComplete="off" />
                        <button type="submit" className="primary-button" disabled={balanceState === 'loading'}>{balanceState === 'loading' ? copy.loadingBalance : copy.loadBalance}</button>
                      </div></label>
                      {addressError === 'invalid' && <p className="form-error">{copy.invalidAddress}</p>}
                      {addressError === 'balance' && <p className="form-error">{copy.balanceError}</p>}
                      <div className="connect-form-footer"><small>{copy.publicOnly}</small><div className="connect-form-footer-actions">
                        <button type="button" className="primary-button" onClick={createWallet}>{copy.createWallet}</button>
                        <button type="button" className="text-button" onClick={() => { setShowExistingForm(false); setAddressError(null); }}>{copy.cancel}</button>
                      </div></div>
                    </form>
                  )}

                  {connected && !showExistingForm && (
                    <div className="wallet-actions connected-wallet-actions">
                      <button type="button" className="primary-button" onClick={createWallet}>{copy.createWallet}</button>
                      <button type="button" className="primary-button" onClick={() => session.address && void refreshBalance(route.id, session.address)} disabled={balanceState === 'loading' || !routeAdapter}>{balanceState === 'loading' ? copy.loadingBalance : copy.refreshBalance}</button>
                      <button type="button" className="secondary-button" onClick={() => { setExistingAddress(session.address); setShowExistingForm(true); setAddressError(null); }}>{copy.specifyExisting}</button>
                      {addressError === 'balance' && <span className="inline-error">{copy.balanceError}</span>}
                    </div>
                  )}
                </>
              ) : (
                <div className="wallet-actions"><button type="button" className="primary-button" disabled>{copy.createWallet}</button><button type="button" className="secondary-button" disabled>{copy.specifyExisting}</button><span>{copy.planned}</span></div>
              )}
            </section>

            <section className="network-card">
              <div><span className="muted-label">{copy.route}</span><h3>{network.name}</h3><p>{copy.routeHint}</p></div>
              <label className="network-select"><span>{copy.network}</span><select value={route.id} onChange={(event) => selectRoute(event.target.value as AssetRouteId)}>{routes.map((candidateRoute) => {
                const candidateNetwork = getNetwork(candidateRoute.networkId);
                return <option key={candidateRoute.id} value={candidateRoute.id}>{candidateNetwork.name} · {candidateRoute.standard}</option>;
              })}</select></label>
            </section>
          </div>
        </section>

        {createdWallet && (
          <section className="backup-card" aria-live="polite">
            <div className="backup-card-header"><div><span className="muted-label">{asset.symbol} · BIP39 / BIP44</span><h2>{copy.backupTitle}</h2><p>{copy.backupText}</p></div>
              <button type="button" className="backup-toggle" onClick={() => { setShowBackupSecrets((value) => !value); setCopyState('none'); }}>{showBackupSecrets ? copy.hideBackup : copy.revealBackup}</button>
            </div>
            <div className="backup-warning">{copy.reloadWarning}</div>
            {showBackupSecrets && (
              <div className="secret-grid">
                <div className="secret-field seed-field"><span>{copy.seedPhrase}</span><code>{createdWallet.mnemonic}</code><button type="button" onClick={() => void copySecret('seed')}>{copyState === 'seed' ? copy.copied : copy.copySeed}</button></div>
                <div className="secret-field"><span>{signingMaterialLabel}</span><code>{createdWallet.signingMaterial.value}</code><button type="button" onClick={() => void copySecret('signing-material')}>{copyState === 'signing-material' ? copy.copied : copySigningMaterialLabel}</button></div>
                <div className="secret-field path-field"><span>{copy.derivationPath}</span><code>{createdWallet.derivationPath}</code></div>
              </div>
            )}
          </section>
        )}

        {routeAdapter ? (
          <Suspense key={`${route.id}:${session.address}:${session.mode}`} fallback={loadingTransferPanel}>
            {routeAdapter.renderTransferPanel({
              language,
              assetId: route.assetId,
              assetSymbol: asset.symbol,
              networkName: network.name,
              networkStandard: route.standard,
              sourceAddress: session.address,
              walletMode: session.mode,
              createdWallet,
            })}
          </Suspense>
        ) : unavailableTransferPanel}

        <section className="security-card" id="security"><div className="security-icon">✓</div><div><h2>{copy.securityTitle}</h2><p>{copy.securityText}</p><small>{copy.noStorage}</small></div></section>
      </main>
    </div>
  );
}
