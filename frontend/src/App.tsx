import { FormEvent, useEffect, useMemo, useState } from 'react';
import { assets, getAsset, type AssetId } from './assets';
import { getDogecoinBalance, getHealth } from './api';
import { type Language, messages } from './i18n';

type HealthState = 'checking' | 'online' | 'offline';
type BalanceState = 'idle' | 'loading' | 'loaded' | 'error';

type TransferPreview = {
  from: string;
  recipient: string;
  amount: string;
  asset: string;
  network: string;
  standard: string;
};

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
  const [dogeBalance, setDogeBalance] = useState<string | null>(null);
  const [balanceState, setBalanceState] = useState<BalanceState>('idle');
  const [from, setFrom] = useState('');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [formError, setFormError] = useState(false);
  const [preview, setPreview] = useState<TransferPreview | null>(null);

  const copy = messages[language];
  const asset = getAsset(assetId);
  const network = asset.networks.find((candidate) => candidate.id === networkId) ?? asset.networks[0];

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
    setPreview(null);
    setFormError(false);
    setFrom(nextAssetId === 'doge' && balanceState === 'loaded' ? dogeAddress : '');
  }

  async function loadDogecoinBalance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = dogeAddress.trim();
    if (!address) return;

    setBalanceState('loading');
    setDogeBalance(null);

    try {
      const result = await getDogecoinBalance(address);
      setDogeBalance(result.balance);
      setDogeAddress(result.address);
      setFrom(result.address);
      setBalanceState('loaded');
    } catch {
      setBalanceState('error');
    }
  }

  function submitTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericAmount = Number(amount);

    if (!from.trim() || !recipient.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setFormError(true);
      setPreview(null);
      return;
    }

    setFormError(false);
    setPreview({
      from: from.trim(),
      recipient: recipient.trim(),
      amount,
      asset: asset.symbol,
      network: network.name,
      standard: network.standard,
    });
  }

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
              const connected = isDoge && balanceState === 'loaded';
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
                    {connected ? <strong>{dogeBalance} DOGE</strong> : <span>{copy.noAddress}</span>}
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
                <span className="session-badge">RAM only</span>
              </div>

              <div className="wallet-balance-row">
                <div>
                  <span className="muted-label">{copy.sessionWallet}</span>
                  <strong>{assetId === 'doge' && dogeBalance !== null ? `${dogeBalance} DOGE` : `— ${asset.symbol}`}</strong>
                </div>
                <div className="wallet-empty-copy">
                  <p>{assetId === 'doge' && dogeAddress ? dogeAddress : copy.sessionEmpty}</p>
                  <small>{copy.sessionHint}</small>
                </div>
              </div>

              {assetId === 'doge' ? (
                <form className="address-connect-form" onSubmit={loadDogecoinBalance}>
                  <label>
                    <span>{copy.connectAddress}</span>
                    <div className="address-connect-row">
                      <input value={dogeAddress} onChange={(event) => setDogeAddress(event.target.value)} placeholder={copy.addressPlaceholder} autoComplete="off" />
                      <button type="submit" className="primary-button" disabled={balanceState === 'loading'}>{balanceState === 'loading' ? copy.loadingBalance : copy.loadBalance}</button>
                    </div>
                  </label>
                  {balanceState === 'error' && <p className="form-error">{copy.balanceError}</p>}
                  <small>{copy.publicOnly}</small>
                </form>
              ) : (
                <div className="wallet-actions">
                  <button type="button" className="primary-button" disabled>{copy.createWallet}</button>
                  <button type="button" className="secondary-button" disabled>{copy.importWallet}</button>
                  <span>{copy.signerNext}</span>
                </div>
              )}
            </section>

            <section className="network-card">
              <div><span className="muted-label">{copy.route}</span><h3>{network.name}</h3><p>{copy.routeHint}</p></div>
              <label className="network-select">
                <span>{copy.network}</span>
                <select value={network.id} onChange={(event) => { setNetworkId(event.target.value); setPreview(null); }}>
                  {asset.networks.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.standard}</option>)}
                </select>
              </label>
            </section>
          </div>
        </section>

        <section className="transfer-card" id="transfer">
          <div className="transfer-copy"><span className="muted-label">{asset.symbol} · {network.standard}</span><h2>{copy.transferTitle}</h2><p>{copy.transferText}</p></div>
          <form className="transfer-form" onSubmit={submitTransfer}>
            <label><span>{copy.from}</span><input value={from} onChange={(event) => setFrom(event.target.value)} placeholder={copy.fromPlaceholder} autoComplete="off" /></label>
            <label><span>{copy.recipient}</span><input value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder={copy.recipientPlaceholder} autoComplete="off" /></label>
            <div className="form-row">
              <label><span>{copy.amount}</span><div className="amount-field"><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder={copy.amountPlaceholder} autoComplete="off" /><strong>{asset.symbol}</strong></div></label>
              <label><span>{copy.fee}</span><div className="readonly-field">{copy.automatic}</div></label>
            </div>
            {formError && <p className="form-error">{copy.formError}</p>}
            <button className="submit-button" type="submit">{copy.previewTransfer}</button>
          </form>
          {preview && (
            <div className="transfer-preview">
              <div className="preview-header"><strong>{copy.preview}</strong><span>{preview.standard}</span></div>
              <dl>
                <div><dt>{copy.from}</dt><dd>{preview.from}</dd></div>
                <div><dt>{copy.recipient}</dt><dd>{preview.recipient}</dd></div>
                <div><dt>{copy.amount}</dt><dd>{preview.amount} {preview.asset}</dd></div>
                <div><dt>{copy.network}</dt><dd>{preview.network}</dd></div>
              </dl>
              <small>{copy.previewNotBroadcast}</small>
            </div>
          )}
        </section>

        <section className="security-card" id="security">
          <div className="security-icon">✓</div>
          <div><h2>{copy.securityTitle}</h2><p>{copy.securityText}</p><small>{copy.noStorage}</small></div>
        </section>
      </main>
    </div>
  );
}
