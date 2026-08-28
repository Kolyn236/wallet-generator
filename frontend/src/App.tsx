import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { assets, getAsset, type AssetId } from './assets';
import { getBitcoinBalance, getDogecoinBalance, getHealth } from './api';
import { BitcoinTransferPanel } from './BitcoinTransferPanel';
import { DogecoinTransferPanel } from './DogecoinTransferPanel';
import { type Language, messages } from './i18n';
import { createBitcoinWallet, isBitcoinMainnetAddress, type CreatedBitcoinWallet } from './wallet/bitcoin';
import { createDogecoinWallet, isDogecoinMainnetAddress, type CreatedDogecoinWallet } from './wallet/dogecoin';

type HealthState = 'checking' | 'online' | 'offline';
type BalanceState = 'idle' | 'loading' | 'loaded' | 'error';
type WalletMode = 'none' | 'created' | 'watch-only';
type CopyState = 'none' | 'seed' | 'wif';
type SupportedAssetId = 'doge' | 'btc';
type CreatedWallet = CreatedDogecoinWallet | CreatedBitcoinWallet;
type WalletSession = { address: string; balance: string | null; mode: WalletMode };

const LANGUAGE_KEY = 'wallet-platform-language';
const EMPTY_SESSION: WalletSession = { address: '', balance: null, mode: 'none' };

function initialLanguage(): Language {
  const stored = localStorage.getItem(LANGUAGE_KEY);
  if (stored === 'ru' || stored === 'en') return stored;
  return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

function isSupportedAssetId(assetId: AssetId): assetId is SupportedAssetId {
  return assetId === 'doge' || assetId === 'btc';
}

function validAddress(assetId: SupportedAssetId, address: string): boolean {
  return assetId === 'doge' ? isDogecoinMainnetAddress(address) : isBitcoinMainnetAddress(address);
}

export function App() {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [health, setHealth] = useState<HealthState>('checking');
  const [assetId, setAssetId] = useState<AssetId>('doge');
  const [networkId, setNetworkId] = useState('dogecoin-mainnet');
  const [sessions, setSessions] = useState<Record<SupportedAssetId, WalletSession>>({
    doge: { ...EMPTY_SESSION },
    btc: { ...EMPTY_SESSION },
  });
  const [existingAddress, setExistingAddress] = useState('');
  const [balanceState, setBalanceState] = useState<BalanceState>('idle');
  const [showExistingForm, setShowExistingForm] = useState(false);
  const [addressError, setAddressError] = useState<'invalid' | 'balance' | null>(null);
  const [showBackupSecrets, setShowBackupSecrets] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>('none');
  const createdWalletRefs = useRef<Partial<Record<SupportedAssetId, CreatedWallet>>>({});

  const copy = messages[language];
  const asset = getAsset(assetId);
  const network = asset.networks.find((candidate) => candidate.id === networkId) ?? asset.networks[0];
  const supportedAssetId = isSupportedAssetId(assetId) ? assetId : null;
  const session = supportedAssetId ? sessions[supportedAssetId] : null;
  const connected = session !== null && session.mode !== 'none' && session.address !== '';
  const createdWallet = supportedAssetId && session?.mode === 'created'
    ? createdWalletRefs.current[supportedAssetId] ?? null
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

  function selectAsset(nextAssetId: AssetId) {
    const nextAsset = getAsset(nextAssetId);
    setAssetId(nextAssetId);
    setNetworkId(nextAsset.networks[0].id);
    setExistingAddress('');
    setShowExistingForm(false);
    setShowBackupSecrets(false);
    setCopyState('none');
    setAddressError(null);
    setBalanceState('idle');
  }

  async function refreshBalance(id: SupportedAssetId, address: string): Promise<boolean> {
    setBalanceState('loading');
    setAddressError(null);

    try {
      const result = id === 'doge'
        ? await getDogecoinBalance(address)
        : await getBitcoinBalance(address);

      setSessions((current) => ({
        ...current,
        [id]: { ...current[id], address: result.address, balance: result.balance },
      }));
      setBalanceState('loaded');
      return true;
    } catch {
      setBalanceState('error');
      setAddressError('balance');
      return false;
    }
  }

  function createWallet() {
    if (!supportedAssetId) return;

    const wallet: CreatedWallet = supportedAssetId === 'doge' ? createDogecoinWallet() : createBitcoinWallet();
    createdWalletRefs.current[supportedAssetId] = wallet;
    setSessions((current) => ({
      ...current,
      [supportedAssetId]: { address: wallet.address, balance: '0.00000000', mode: 'created' },
    }));
    setExistingAddress('');
    setShowExistingForm(false);
    setShowBackupSecrets(false);
    setCopyState('none');
    setAddressError(null);
    setBalanceState('loaded');
    void refreshBalance(supportedAssetId, wallet.address);
  }

  async function specifyExistingWallet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supportedAssetId) return;

    const address = existingAddress.trim();
    if (!validAddress(supportedAssetId, address)) {
      setAddressError('invalid');
      return;
    }

    const loaded = await refreshBalance(supportedAssetId, address);
    if (!loaded) return;

    delete createdWalletRefs.current[supportedAssetId];
    setSessions((current) => ({
      ...current,
      [supportedAssetId]: { ...current[supportedAssetId], address, mode: 'watch-only' },
    }));
    setShowExistingForm(false);
    setShowBackupSecrets(false);
    setCopyState('none');
  }

  async function copySecret(kind: 'seed' | 'wif') {
    if (!createdWallet || !navigator.clipboard) return;

    const secret = kind === 'seed' ? createdWallet.mnemonic : createdWallet.wif;
    try {
      await navigator.clipboard.writeText(secret);
      setCopyState(kind);
    } catch {
      setCopyState('none');
    }
  }

  const modeLabel = session?.mode === 'created'
    ? copy.createdLocally
    : session?.mode === 'watch-only'
      ? copy.watchOnly
      : copy.noWallet;

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
              const candidateSession = isSupportedAssetId(candidate.id) ? sessions[candidate.id] : null;
              const candidateConnected = candidateSession !== null && candidateSession.mode !== 'none' && candidateSession.address !== '';
              return (
                <button key={candidate.id} type="button" className={`wallet-tile ${candidate.id === assetId ? 'active' : ''}`} onClick={() => selectAsset(candidate.id)}>
                  <div className="wallet-tile-top"><span className="asset-mark">{candidate.mark}</span><span className={`asset-status status-${candidate.status}`}>{candidate.status === 'ready-next' ? copy.firstIntegration : copy.planned}</span></div>
                  <div><strong>{candidate.symbol}</strong><small>{candidate.networks[0].standard}</small></div>
                  <div className="tile-balance">{candidateConnected && candidateSession?.balance !== null ? <strong>{candidateSession.balance} {candidate.symbol}</strong> : <span>{copy.noAddress}</span>}</div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="wallet-layout">
          <aside className="asset-panel">
            <div className="section-heading"><span>{copy.selectAsset}</span><strong>{assets.length}</strong></div>
            <div className="asset-list">
              {assets.map((candidate) => (
                <button key={candidate.id} type="button" className={`asset-item ${candidate.id === assetId ? 'active' : ''}`} onClick={() => selectAsset(candidate.id)}>
                  <span className="asset-mark">{candidate.mark}</span><span className="asset-copy"><strong>{candidate.symbol}</strong><small>{candidate.name}</small></span>
                  <span className={`asset-status status-${candidate.status}`}>{candidate.status === 'ready-next' ? copy.firstIntegration : copy.planned}</span>
                </button>
              ))}
            </div>
          </aside>

          <div className="wallet-workspace">
            <section className="wallet-card">
              <div className="wallet-card-top">
                <div className="selected-asset"><span className="selected-mark">{asset.mark}</span><div><span className="muted-label">{copy.selectedWallet}</span><h2>{asset.name} <span>{asset.symbol}</span></h2></div></div>
                <span className="session-badge">{supportedAssetId ? modeLabel : copy.planned}</span>
              </div>

              <div className="wallet-balance-row">
                <div><span className="muted-label">{copy.walletBalance}</span><strong>{supportedAssetId && session?.balance !== null ? `${session?.balance ?? '0.00000000'} ${asset.symbol}` : `— ${asset.symbol}`}</strong></div>
                <div className="wallet-empty-copy"><p>{supportedAssetId && session?.address ? session.address : copy.walletEmpty}</p><small>{copy.walletHint}</small></div>
              </div>

              {supportedAssetId ? (
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
                      <button type="button" className="primary-button" onClick={() => session?.address && void refreshBalance(supportedAssetId, session.address)} disabled={balanceState === 'loading'}>{balanceState === 'loading' ? copy.loadingBalance : copy.refreshBalance}</button>
                      <button type="button" className="secondary-button" onClick={() => { setExistingAddress(session?.address ?? ''); setShowExistingForm(true); setAddressError(null); }}>{copy.specifyExisting}</button>
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
              <label className="network-select"><span>{copy.network}</span><select value={network.id} onChange={(event) => setNetworkId(event.target.value)}>{asset.networks.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.standard}</option>)}</select></label>
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
                <div className="secret-field"><span>{copy.wif}</span><code>{createdWallet.wif}</code><button type="button" onClick={() => void copySecret('wif')}>{copyState === 'wif' ? copy.copied : copy.copyWif}</button></div>
                <div className="secret-field path-field"><span>{copy.derivationPath}</span><code>{createdWallet.derivationPath}</code></div>
              </div>
            )}
          </section>
        )}

        {assetId === 'btc' ? (
          <BitcoinTransferPanel key={`${assetId}:${network.id}:${sessions.btc.address}:${sessions.btc.mode}`} language={language} networkName={network.name} networkStandard={network.standard} sourceAddress={sessions.btc.address} walletMode={sessions.btc.mode} createdWallet={sessions.btc.mode === 'created' ? (createdWalletRefs.current.btc as CreatedBitcoinWallet | undefined) ?? null : null} />
        ) : (
          <DogecoinTransferPanel key={`${assetId}:${network.id}:${sessions.doge.address}:${sessions.doge.mode}`} language={language} assetId={assetId} assetSymbol={asset.symbol} networkName={network.name} networkStandard={network.standard} sourceAddress={assetId === 'doge' ? sessions.doge.address : ''} walletMode={assetId === 'doge' ? sessions.doge.mode : 'none'} createdWallet={assetId === 'doge' && sessions.doge.mode === 'created' ? (createdWalletRefs.current.doge as CreatedDogecoinWallet | undefined) ?? null : null} />
        )}

        <section className="security-card" id="security"><div className="security-icon">✓</div><div><h2>{copy.securityTitle}</h2><p>{copy.securityText}</p><small>{copy.noStorage}</small></div></section>
      </main>
    </div>
  );
}
