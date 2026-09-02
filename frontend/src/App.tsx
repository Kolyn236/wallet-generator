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
import { platformCopy } from './platformCopy';
import { adapterRegistry } from './runtime/adapterRegistry';
import {
  createAssetRouteBalances,
  getAssetRouteBalance,
  invalidateAssetRouteBalancesForNetwork,
  withAssetRouteBalance,
  type AssetRouteBalances,
} from './runtime/assetRouteBalances';
import type { BrowserSigningWallet } from './runtime/WalletNetworkAdapter';
import {
  createWalletSessions,
  getWalletSession,
  withWalletSession,
  type WalletSessions,
} from './runtime/walletSessions';

type HealthState = 'checking' | 'online' | 'offline';
type CopyState = 'none' | 'seed' | 'signing-material';

const LANGUAGE_KEY = 'chain-courier-language';
const LEGACY_LANGUAGE_KEY = 'wallet-platform-language';

function initialLanguage(): Language {
  const stored = localStorage.getItem(LANGUAGE_KEY) ?? localStorage.getItem(LEGACY_LANGUAGE_KEY);
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
  const [mnemonicInput, setMnemonicInput] = useState('');
  const [showRecoveryForm, setShowRecoveryForm] = useState(false);
  const [mnemonicError, setMnemonicError] = useState<'invalid' | null>(null);
  const [showBackupSecrets, setShowBackupSecrets] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>('none');
  const signingWalletRefs = useRef<Partial<Record<NetworkId, BrowserSigningWallet>>>({});

  const copy = messages[language];
  const liveCopy = platformCopy[language];
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
  const signingWallet = walletAdapter !== null && session.mode === 'local-signing'
    ? signingWalletRefs.current[route.networkId] ?? null
    : null;
  const generatedWallet = signingWallet?.origin === 'generated' ? signingWallet : null;
  const mnemonicWordCount = mnemonicInput.trim() === ''
    ? 0
    : mnemonicInput.trim().split(/\s+/).length;

  useEffect(() => {
    document.documentElement.lang = language;
    localStorage.setItem(LANGUAGE_KEY, language);
    localStorage.removeItem(LEGACY_LANGUAGE_KEY);
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
    setAddressError(null);
    setMnemonicInput('');
    setShowRecoveryForm(false);
    setMnemonicError(null);
    setShowBackupSecrets(false);
    setCopyState('none');
  }

  function openExistingWalletForm() {
    setShowExistingForm(true);
    setShowRecoveryForm(false);
    setMnemonicInput('');
    setMnemonicError(null);
    setAddressError(null);
  }

  function openRecoveryForm() {
    setShowRecoveryForm(true);
    setShowExistingForm(false);
    setExistingAddress('');
    setAddressError(null);
    setMnemonicError(null);
    setShowBackupSecrets(false);
    setCopyState('none');
  }

  function cancelRecovery() {
    setMnemonicInput('');
    setShowRecoveryForm(false);
    setMnemonicError(null);
  }

  function selectAsset(nextAssetId: AssetId) {
    setAssetId(nextAssetId);
    setRouteId(getDefaultAssetRoute(nextAssetId).id);
    resetWalletUi();
  }

  function selectRoute(nextRouteId: AssetRouteId) {
    setRouteId(nextRouteId);
    setAddressError(null);
    setMnemonicError(null);
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
    signingWalletRefs.current[networkId] = wallet;
    setSessions((current) => withWalletSession(current, networkId, {
      address: wallet.address,
      mode: 'local-signing',
    }));
    setRouteBalances((current) => invalidateAssetRouteBalancesForNetwork(current, networkId));
    resetWalletUi();

    if (routeAdapter && routeAdapter.networkId === networkId) {
      void refreshBalance(route.id, wallet.address);
    }
  }

  async function restoreWalletFromMnemonic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!walletAdapter || !walletAdapter.capabilities.mnemonicImport) return;

    try {
      const wallet = walletAdapter.importMnemonic(mnemonicInput);
      const networkId = walletAdapter.networkId;
      signingWalletRefs.current[networkId] = wallet;
      setSessions((current) => withWalletSession(current, networkId, {
        address: wallet.address,
        mode: 'local-signing',
      }));
      setRouteBalances((current) => invalidateAssetRouteBalancesForNetwork(current, networkId));
      setMnemonicInput('');
      setShowRecoveryForm(false);
      setMnemonicError(null);
      setShowExistingForm(false);
      setExistingAddress('');
      setAddressError(null);
      setShowBackupSecrets(false);
      setCopyState('none');

      if (routeAdapter && routeAdapter.networkId === networkId) {
        await refreshBalance(route.id, wallet.address);
      }
    } catch {
      setMnemonicError('invalid');
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

    delete signingWalletRefs.current[walletAdapter.networkId];
    setSessions((current) => withWalletSession(current, walletAdapter.networkId, {
      address,
      mode: 'watch-only',
    }));
    setRouteBalances((current) => invalidateAssetRouteBalancesForNetwork(current, walletAdapter.networkId));
    setShowExistingForm(false);
    setShowRecoveryForm(false);
    setMnemonicInput('');
    setMnemonicError(null);
    setShowBackupSecrets(false);
    setCopyState('none');

    await refreshBalance(route.id, address);
  }

  async function copySecret(kind: 'seed' | 'signing-material') {
    if (!generatedWallet || !navigator.clipboard) return;

    const secret = kind === 'seed'
      ? generatedWallet.generatedMnemonic
      : generatedWallet.signingMaterial.value;
    try {
      await navigator.clipboard.writeText(secret);
      setCopyState(kind);
    } catch {
      setCopyState('none');
    }
  }

  const modeLabel = session.mode === 'local-signing'
    ? signingWallet?.origin === 'mnemonic' ? copy.restoredFromSeed : copy.createdLocally
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

  const signingMaterialLabel = generatedWallet?.signingMaterial.kind === 'private-key'
    ? copy.privateKey
    : copy.wif;
  const copySigningMaterialLabel = generatedWallet?.signingMaterial.kind === 'private-key'
    ? copy.copyPrivateKey
    : copy.copyWif;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label={copy.brand}><span className="brand-mark">C</span><span>{copy.brand}</span></a>
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
        <section className="intro"><p className="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p className="intro-copy">{liveCopy.subtitle}</p></section>

        <section className="wallet-layout" id="wallets">
          <aside className="asset-panel">
            <div className="section-heading"><span>{copy.selectAsset}</span><strong>{assets.length}</strong></div>
            <div className="asset-list">
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
                const candidateBalanceLabel = !candidateConnected
                  ? copy.noAddress
                  : candidateRouteBalance.status === 'loading'
                    ? copy.loadingBalance
                    : candidateRouteBalance.status === 'error'
                      ? copy.balanceError
                      : candidateBalance !== null
                        ? `${candidateBalance} ${candidate.symbol}`
                        : `— ${candidate.symbol}`;
                return (
                  <button key={candidate.id} type="button" className={`asset-item ${candidate.id === assetId ? 'active' : ''}`} onClick={() => selectAsset(candidate.id)}>
                    <span className="asset-mark">{candidate.mark}</span>
                    <span className="asset-copy">
                      <strong>{candidate.symbol}</strong>
                      <small className="asset-name">{candidate.name}</small>
                      <small className={`asset-balance ${candidateBalance !== null ? 'has-balance' : ''}`}>{candidateBalanceLabel}</small>
                    </span>
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
                  {!connected && !showExistingForm && !showRecoveryForm && (
                    <div className="wallet-actions wallet-choice-actions">
                      <button type="button" className="primary-button" onClick={createWallet}>{copy.createWallet}</button>
                      <button type="button" className="secondary-button" onClick={openRecoveryForm} disabled={!walletAdapter.capabilities.mnemonicImport}>{copy.recoverWallet}</button>
                      <button type="button" className="secondary-button" onClick={openExistingWalletForm}>{copy.specifyExisting}</button>
                    </div>
                  )}

                  {showRecoveryForm && (
                    <form className="address-connect-form seed-recovery-form" onSubmit={restoreWalletFromMnemonic}>
                      <div className="connect-form-heading"><strong>{copy.recoveryTitle}</strong><p>{copy.recoveryHint}</p></div>
                      <label>
                        <span>{copy.seedPhrase}</span>
                        <textarea
                          value={mnemonicInput}
                          onChange={(event) => { setMnemonicInput(event.target.value); setMnemonicError(null); }}
                          placeholder={copy.mnemonicPlaceholder}
                          autoComplete="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          rows={4}
                        />
                      </label>
                      <div className="seed-recovery-meta">
                        <small>{copy.mnemonicWordCount}: {mnemonicWordCount}</small>
                        <small>{copy.derivationPath}: <code>{walletAdapter.identity.derivationPath}</code></small>
                      </div>
                      {mnemonicError === 'invalid' && <p className="form-error">{copy.invalidMnemonic}</p>}
                      <div className="connect-form-footer"><small>{copy.mnemonicPrivacy}</small><div className="connect-form-footer-actions">
                        <button type="submit" className="primary-button" disabled={mnemonicInput.trim() === ''}>{copy.restoreWallet}</button>
                        <button type="button" className="text-button" onClick={cancelRecovery}>{copy.cancel}</button>
                      </div></div>
                    </form>
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

                  {connected && !showExistingForm && !showRecoveryForm && (
                    <div className="wallet-actions connected-wallet-actions">
                      <button type="button" className="primary-button" onClick={createWallet}>{copy.createWallet}</button>
                      <button type="button" className="secondary-button" onClick={openRecoveryForm} disabled={!walletAdapter.capabilities.mnemonicImport}>{copy.recoverWallet}</button>
                      <button type="button" className="primary-button" onClick={() => session.address && void refreshBalance(route.id, session.address)} disabled={balanceState === 'loading' || !routeAdapter}>{balanceState === 'loading' ? copy.loadingBalance : copy.refreshBalance}</button>
                      <button type="button" className="secondary-button" onClick={() => { setExistingAddress(session.address); openExistingWalletForm(); }}>{copy.specifyExisting}</button>
                      {addressError === 'balance' && <span className="inline-error">{copy.balanceError}</span>}
                    </div>
                  )}
                </>
              ) : (
                <div className="wallet-actions"><button type="button" className="primary-button" disabled>{copy.createWallet}</button><button type="button" className="secondary-button" disabled>{copy.recoverWallet}</button><button type="button" className="secondary-button" disabled>{copy.specifyExisting}</button><span>{copy.planned}</span></div>
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

        {generatedWallet && (
          <section className="backup-card" aria-live="polite">
            <div className="backup-card-header"><div><span className="muted-label">{asset.symbol} · BIP39 / BIP44</span><h2>{copy.backupTitle}</h2><p>{copy.backupText}</p></div>
              <button type="button" className="backup-toggle" onClick={() => { setShowBackupSecrets((value) => !value); setCopyState('none'); }}>{showBackupSecrets ? copy.hideBackup : copy.revealBackup}</button>
            </div>
            <div className="backup-warning">{liveCopy.reloadWarning}</div>
            {showBackupSecrets && (
              <div className="secret-grid">
                <div className="secret-field seed-field"><span>{copy.seedPhrase}</span><code>{generatedWallet.generatedMnemonic}</code><button type="button" onClick={() => void copySecret('seed')}>{copyState === 'seed' ? copy.copied : copy.copySeed}</button></div>
                <div className="secret-field"><span>{signingMaterialLabel}</span><code>{generatedWallet.signingMaterial.value}</code><button type="button" onClick={() => void copySecret('signing-material')}>{copyState === 'signing-material' ? copy.copied : copySigningMaterialLabel}</button></div>
                <div className="secret-field path-field"><span>{copy.derivationPath}</span><code>{generatedWallet.derivationPath}</code></div>
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
              createdWallet: signingWallet,
            })}
          </Suspense>
        ) : unavailableTransferPanel}

        <section className="security-card" id="security"><div className="security-icon">✓</div><div><h2>{copy.securityTitle}</h2><p>{liveCopy.securityText}</p><small>{copy.noStorage}</small></div></section>
      </main>
    </div>
  );
}
