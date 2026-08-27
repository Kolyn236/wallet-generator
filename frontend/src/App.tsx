import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { assets, getAsset, type AssetId } from './assets';
import { getDogecoinBalance, getHealth } from './api';
import { DogecoinTransferPanel } from './DogecoinTransferPanel';
import { type Language, messages } from './i18n';
import {
  createDogecoinWallet,
  isDogecoinMainnetAddress,
  type CreatedDogecoinWallet,
} from './wallet/dogecoin';

type HealthState = 'checking' | 'online' | 'offline';
type BalanceState = 'idle' | 'loading' | 'loaded' | 'error';
type DogecoinWalletMode = 'none' | 'created' | 'watch-only';
type CopyState = 'none' | 'seed' | 'wif';

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
  const [networkId, setNetworkId] = useState('dogecoin-mainnet');
  const [dogeAddress, setDogeAddress] = useState('');
  const [existingAddress, setExistingAddress] = useState('');
  const [dogeBalance, setDogeBalance] = useState<string | null>(null);
  const [balanceState, setBalanceState] = useState<BalanceState>('idle');
  const [dogeWalletMode, setDogeWalletMode] = useState<DogecoinWalletMode>('none');
  const [showExistingForm, setShowExistingForm] = useState(false);
  const [addressError, setAddressError] = useState<'invalid' | 'balance' | null>(null);
  const [showBackupSecrets, setShowBackupSecrets] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>('none');
  const createdWalletRef = useRef<CreatedDogecoinWallet | null>(null);

  const copy = messages[language];
  const asset = getAsset(assetId);
  const network = asset.networks.find((candidate) => candidate.id === networkId) ?? asset.networks[0];
  const connectedDoge = dogeWalletMode !== 'none' && dogeAddress !== '';
  const createdWallet = dogeWalletMode === 'created' ? createdWalletRef.current : null;

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

  function selectAsset(nextAssetId: AssetId) {
    const nextAsset = getAsset(nextAssetId);
    setAssetId(nextAssetId);
    setNetworkId(nextAsset.networks[0].id);
  }

  async function refreshDogecoinBalance(address: string): Promise<boolean> {
    setBalanceState('loading');
    setAddressError(null);

    try {
      const result = await getDogecoinBalance(address);
      setDogeBalance(result.balance);
      setDogeAddress(result.address);
      setBalanceState('loaded');
      return true;
    } catch {
      setBalanceState('error');
      setAddressError('balance');
      return false;
    }
  }

  function createWallet() {
    const wallet = createDogecoinWallet();
    createdWalletRef.current = wallet;
    setDogeWalletMode('created');
    setDogeAddress(wallet.address);
    setDogeBalance('0.00000000');
    setBalanceState('loaded');
    setExistingAddress('');
    setShowExistingForm(false);
    setShowBackupSecrets(false);
    setCopyState('none');
    setAddressError(null);
    void refreshDogecoinBalance(wallet.address);
  }

  async function specifyExistingWallet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = existingAddress.trim();

    if (!isDogecoinMainnetAddress(address)) {
      setAddressError('invalid');
      return;
    }

    const loaded = await refreshDogecoinBalance(address);
    if (!loaded) return;

    createdWalletRef.current = null;
    setDogeWalletMode('watch-only');
    setShowExistingForm(false);
    setShowBackupSecrets(false);
    setCopyState('none');
  }

  async function copySecret(kind: 'seed' | 'wif') {
    const wallet = createdWalletRef.current;
    if (!wallet || !navigator.clipboard) return;

    const secret = kind === 'seed' ? wallet.mnemonic : wallet.wif;
    try {
      await navigator.clipboard.writeText(secret);
      setCopyState(kind);
    } catch {
      setCopyState('none');
    }
  }

  const dogeModeLabel = dogeWalletMode === 'created'
    ? copy.createdLocally
    : dogeWalletMode === 'watch-only'
      ? copy.watchOnly
      : copy.noWallet;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label={copy.brand}>
          <span className="brand-mark">W</span>
          <span>{copy.brand}</span>
        </a>
        <nav className="nav" aria-label="Primary">
          <a href="#wallets">{copy.wallets}</a>
          <a href="#transfer">{copy.transfer}</a>
          <a href="#security">{copy.security}</a>
        </nav>
        <div className="topbar-actions">
          <div className={`health health-${health}`} title={`${copy.backend}: ${healthLabel}`}>
            <span className="health-dot" />
            <span>{healthLabel}</span>
          </div>
          <div className="language-switch" aria-label="Language">
            <button className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')} type="button">EN</button>
            <button className={language === 'ru' ? 'active' : ''} onClick={() => setLanguage('ru')} type="button">RU</button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="intro">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p className="intro-copy">{copy.subtitle}</p>
        </section>

        <section className="wallet-tiles-section" id="wallets">
          <div className="section-title-row">
            <div>
              <span className="muted-label">{copy.myWallets}</span>
              <p>{copy.walletTilesHint}</p>
            </div>
          </div>
          <div className="wallet-tiles">
            {assets.map((candidate) => {
              const isDoge = candidate.id === 'doge';
              const connected = isDoge && connectedDoge;
              return (
                <button
                  key={candidate.id}
                  type="button"
                  className={`wallet-tile ${candidate.id === assetId ? 'active' : ''}`}
                  onClick={() => selectAsset(candidate.id)}
                >
                  <div className="wallet-tile-top">
                    <span className="asset-mark">{candidate.mark}</span>
                    <span className={`asset-status status-${candidate.status}`}>
                      {candidate.status === 'ready-next' ? copy.firstIntegration : copy.planned}
                    </span>
                  </div>
                  <div>
                    <strong>{candidate.symbol}</strong>
                    <small>{candidate.networks[0].standard}</small>
                  </div>
                  <div className="tile-balance">
                    {connected && dogeBalance !== null ? <strong>{dogeBalance} DOGE</strong> : <span>{copy.noAddress}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="wallet-layout">
          <aside className="asset-panel">
            <div className="section-heading">
              <span>{copy.selectAsset}</span>
              <strong>{assets.length}</strong>
            </div>
            <div className="asset-list">
              {assets.map((candidate) => (
                <button key={candidate.id} type="button" className={`asset-item ${candidate.id === assetId ? 'active' : ''}`} onClick={() => selectAsset(candidate.id)}>
                  <span className="asset-mark">{candidate.mark}</span>
                  <span className="asset-copy"><strong>{candidate.symbol}</strong><small>{candidate.name}</small></span>
                  <span className={`asset-status status-${candidate.status}`}>{candidate.status === 'ready-next' ? copy.firstIntegration : copy.planned}</span>
                </button>
              ))}
            </div>
          </aside>

          <div className="wallet-workspace">
            <section className="wallet-card">
              <div className="wallet-card-top">
                <div className="selected-asset">
                  <span className="selected-mark">{asset.mark}</span>
                  <div><span className="muted-label">{copy.selectedWallet}</span><h2>{asset.name} <span>{asset.symbol}</span></h2></div>
                </div>
                <span className="session-badge">{assetId === 'doge' ? dogeModeLabel : copy.planned}</span>
              </div>

              <div className="wallet-balance-row">
                <div>
                  <span className="muted-label">{copy.walletBalance}</span>
                  <strong>{assetId === 'doge' && dogeBalance !== null ? `${dogeBalance} DOGE` : `— ${asset.symbol}`}</strong>
                </div>
                <div className="wallet-empty-copy">
                  <p>{assetId === 'doge' && dogeAddress ? dogeAddress : copy.walletEmpty}</p>
                  <small>{copy.walletHint}</small>
                </div>
              </div>

              {assetId === 'doge' ? (
                <>
                  {!connectedDoge && !showExistingForm && (
                    <div className="wallet-actions wallet-choice-actions">
                      <button type="button" className="primary-button" onClick={createWallet}>{copy.createWallet}</button>
                      <button type="button" className="secondary-button" onClick={() => { setShowExistingForm(true); setAddressError(null); }}>{copy.specifyExisting}</button>
                    </div>
                  )}

                  {showExistingForm && (
                    <form className="address-connect-form" onSubmit={specifyExistingWallet}>
                      <div className="connect-form-heading">
                        <strong>{copy.existingTitle}</strong>
                        <p>{copy.existingHint}</p>
                      </div>
                      <label>
                        <span>{copy.publicAddress}</span>
                        <div className="address-connect-row">
                          <input value={existingAddress} onChange={(event) => setExistingAddress(event.target.value)} placeholder={copy.addressPlaceholder} autoComplete="off" />
                          <button type="submit" className="primary-button" disabled={balanceState === 'loading'}>{balanceState === 'loading' ? copy.loadingBalance : copy.loadBalance}</button>
                        </div>
                      </label>
                      {addressError === 'invalid' && <p className="form-error">{copy.invalidAddress}</p>}
                      {addressError === 'balance' && <p className="form-error">{copy.balanceError}</p>}
                      <div className="connect-form-footer">
                        <small>{copy.publicOnly}</small>
                        <div className="connect-form-footer-actions">
                          <button type="button" className="primary-button" onClick={createWallet}>{copy.createWallet}</button>
                          <button type="button" className="text-button" onClick={() => { setShowExistingForm(false); setAddressError(null); }}>{copy.cancel}</button>
                        </div>
                      </div>
                    </form>
                  )}

                  {connectedDoge && !showExistingForm && (
                    <div className="wallet-actions connected-wallet-actions">
                      <button type="button" className="primary-button" onClick={createWallet}>{copy.createWallet}</button>
                      <button type="button" className="primary-button" onClick={() => void refreshDogecoinBalance(dogeAddress)} disabled={balanceState === 'loading'}>
                        {balanceState === 'loading' ? copy.loadingBalance : copy.refreshBalance}
                      </button>
                      <button type="button" className="secondary-button" onClick={() => { setExistingAddress(dogeAddress); setShowExistingForm(true); setAddressError(null); }}>{copy.specifyExisting}</button>
                      {addressError === 'balance' && <span className="inline-error">{copy.balanceError}</span>}
                    </div>
                  )}
                </>
              ) : (
                <div className="wallet-actions">
                  <button type="button" className="primary-button" disabled>{copy.createWallet}</button>
                  <button type="button" className="secondary-button" disabled>{copy.specifyExisting}</button>
                  <span>{copy.planned}</span>
                </div>
              )}
            </section>

            <section className="network-card">
              <div><span className="muted-label">{copy.route}</span><h3>{network.name}</h3><p>{copy.routeHint}</p></div>
              <label className="network-select">
                <span>{copy.network}</span>
                <select value={network.id} onChange={(event) => setNetworkId(event.target.value)}>
                  {asset.networks.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.standard}</option>)}
                </select>
              </label>
            </section>
          </div>
        </section>

        {createdWallet && (
          <section className="backup-card" aria-live="polite">
            <div className="backup-card-header">
              <div>
                <span className="muted-label">DOGE · BIP39 / BIP44</span>
                <h2>{copy.backupTitle}</h2>
                <p>{copy.backupText}</p>
              </div>
              <button type="button" className="backup-toggle" onClick={() => { setShowBackupSecrets((value) => !value); setCopyState('none'); }}>
                {showBackupSecrets ? copy.hideBackup : copy.revealBackup}
              </button>
            </div>

            <div className="backup-warning">{copy.reloadWarning}</div>

            {showBackupSecrets && (
              <div className="secret-grid">
                <div className="secret-field seed-field">
                  <span>{copy.seedPhrase}</span>
                  <code>{createdWallet.mnemonic}</code>
                  <button type="button" onClick={() => void copySecret('seed')}>{copyState === 'seed' ? copy.copied : copy.copySeed}</button>
                </div>
                <div className="secret-field">
                  <span>{copy.wif}</span>
                  <code>{createdWallet.wif}</code>
                  <button type="button" onClick={() => void copySecret('wif')}>{copyState === 'wif' ? copy.copied : copy.copyWif}</button>
                </div>
                <div className="secret-field path-field">
                  <span>{copy.derivationPath}</span>
                  <code>{createdWallet.derivationPath}</code>
                </div>
              </div>
            )}
          </section>
        )}

        <DogecoinTransferPanel
          key={`${assetId}:${network.id}:${dogeAddress}:${dogeWalletMode}`}
          language={language}
          assetId={assetId}
          assetSymbol={asset.symbol}
          networkName={network.name}
          networkStandard={network.standard}
          sourceAddress={assetId === 'doge' ? dogeAddress : ''}
          walletMode={assetId === 'doge' ? dogeWalletMode : 'none'}
          createdWallet={assetId === 'doge' ? createdWallet : null}
        />

        <section className="security-card" id="security">
          <div className="security-icon">✓</div>
          <div><h2>{copy.securityTitle}</h2><p>{copy.securityText}</p><small>{copy.noStorage}</small></div>
        </section>
      </main>
    </div>
  );
}
