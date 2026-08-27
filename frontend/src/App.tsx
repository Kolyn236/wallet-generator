import { useEffect, useMemo, useState } from 'react';
import { getHealth } from './api';
import { type Language, messages } from './i18n';

type HealthState = 'checking' | 'online' | 'offline';

const LANGUAGE_KEY = 'wallet-platform-language';

function initialLanguage(): Language {
  const stored = localStorage.getItem(LANGUAGE_KEY);
  if (stored === 'ru' || stored === 'en') {
    return stored;
  }

  return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export function App() {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [health, setHealth] = useState<HealthState>('checking');
  const copy = messages[language];

  useEffect(() => {
    document.documentElement.lang = language;
    localStorage.setItem(LANGUAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    const controller = new AbortController();

    getHealth(controller.signal)
      .then(() => setHealth('online'))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setHealth('offline');
      });

    return () => controller.abort();
  }, []);

  const healthLabel = useMemo(() => {
    if (health === 'online') return copy.online;
    if (health === 'offline') return copy.offline;
    return copy.checking;
  }, [copy, health]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label={copy.brand}>
          <span className="brand-mark">Ð</span>
          <span>{copy.brand}</span>
        </a>
        <nav className="nav" aria-label="Primary">
          <a href="#overview">{copy.overview}</a>
          <a href="#wallets">{copy.wallets}</a>
          <a href="#transactions">{copy.transactions}</a>
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
        <section className="hero" id="overview">
          <div className="hero-copy">
            <p className="eyebrow">{copy.eyebrow}</p>
            <h1>{copy.title}</h1>
            <p className="hero-subtitle">{copy.subtitle}</p>
            <div className="hero-status">
              <span className="status-label">{copy.backend}</span>
              <strong>{healthLabel}</strong>
            </div>
          </div>
          <div className="chain-orbit" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="coin coin-doge">Ð</div>
            <div className="coin coin-btc">₿</div>
            <div className="coin coin-eth">Ξ</div>
          </div>
        </section>

        <section className="stage-card">
          <div>
            <p className="eyebrow">{copy.activeStage}</p>
            <p>{copy.activeStageText}</p>
          </div>
          <span className="pill">Symfony + React</span>
        </section>

        <section className="feature-grid">
          <article className="feature-card" id="wallets">
            <div className="feature-icon">01</div>
            <h2>{copy.walletTitle}</h2>
            <p>{copy.walletText}</p>
            <button type="button" disabled>{copy.comingSoon}</button>
          </article>

          <article className="feature-card" id="transactions">
            <div className="feature-icon">02</div>
            <h2>{copy.transactionTitle}</h2>
            <p>{copy.transactionText}</p>
            <button type="button" disabled>{copy.comingSoon}</button>
          </article>

          <article className="feature-card" id="infrastructure">
            <div className="feature-icon">03</div>
            <h2>{copy.infraTitle}</h2>
            <p>{copy.infraText}</p>
            <div className="stack-tags">
              <span>PostgreSQL</span><span>Redis</span><span>RabbitMQ</span>
            </div>
          </article>
        </section>

        <section className="security-card">
          <div className="security-icon">✓</div>
          <div>
            <h2>{copy.security}</h2>
            <p>{copy.securityText}</p>
            <small>{copy.legacy}</small>
          </div>
        </section>
      </main>
    </div>
  );
}
