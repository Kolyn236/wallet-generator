import { useEffect, useState } from 'react';
import type { Language } from './i18n';
import { donationMessages } from './donationI18n';
import './donation.css';

type DonationAsset = {
  id: string;
  symbol: string;
  name: string;
  network: string;
  mark: string;
  address: string;
};

const DONATION_ASSETS: DonationAsset[] = [
  {
    id: 'usdt',
    symbol: 'USDT',
    name: 'Tether',
    network: 'Ethereum · ERC-20',
    mark: '₮',
    address: '0xbc7a3efbb75b38fdd5065a994ae712dc40878eca',
  },
  {
    id: 'btc',
    symbol: 'BTC',
    name: 'Bitcoin',
    network: 'Bitcoin Mainnet',
    mark: '₿',
    address: '1EpKGub83RQ2Fseuy3hiGGi1ph4fNHQqJP',
  },
  {
    id: 'eth',
    symbol: 'ETH',
    name: 'Ethereum',
    network: 'Ethereum Mainnet',
    mark: 'Ξ',
    address: '0x497dcd9c9f68a0fb0174cbb79eb66c28d21dc886',
  },
  {
    id: 'doge',
    symbol: 'DOGE',
    name: 'Dogecoin',
    network: 'Dogecoin Mainnet',
    mark: 'Ð',
    address: 'D9popZh3N9mNNwTVwrG9jLLuS5Ym8tEYvd',
  },
];

function getDocumentLanguage(): Language {
  return document.documentElement.lang === 'ru' ? 'ru' : 'en';
}

export function DonationCard() {
  const [language, setLanguage] = useState<Language>(getDocumentLanguage);
  const [copiedAsset, setCopiedAsset] = useState<string | null>(null);
  const copy = donationMessages[language];

  useEffect(() => {
    const observer = new MutationObserver(() => setLanguage(getDocumentLanguage()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    return () => observer.disconnect();
  }, []);

  async function copyAddress(asset: DonationAsset) {
    if (!navigator.clipboard) return;

    try {
      await navigator.clipboard.writeText(asset.address);
      setCopiedAsset(asset.id);
      window.setTimeout(() => setCopiedAsset((current) => current === asset.id ? null : current), 1800);
    } catch {
      setCopiedAsset(null);
    }
  }

  return (
    <div className="donation-shell">
      <section className="donation-card" id="support" aria-labelledby="donation-title">
        <div className="donation-heading">
          <div className="donation-heart" aria-hidden="true">♥</div>
          <div>
            <span className="muted-label">{copy.eyebrow}</span>
            <h2 id="donation-title">{copy.title}</h2>
            <p>{copy.text}</p>
          </div>
        </div>

        <div className="donation-grid">
          {DONATION_ASSETS.map((asset) => (
            <article className="donation-asset" key={asset.id}>
              <div className="donation-asset-heading">
                <span className="donation-asset-mark" aria-hidden="true">{asset.mark}</span>
                <div>
                  <strong>{asset.symbol}</strong>
                  <small>{asset.name}</small>
                </div>
              </div>

              <div className="donation-network">
                <span>{copy.network}</span>
                <strong>{asset.network}</strong>
              </div>

              <div className="donation-address-row">
                <code title={asset.address}>{asset.address}</code>
                <button type="button" onClick={() => void copyAddress(asset)} aria-label={`${copy.copy} ${asset.symbol}`}>
                  <span aria-hidden="true">⧉</span>
                  {copiedAsset === asset.id ? copy.copied : copy.copy}
                </button>
              </div>
            </article>
          ))}
        </div>

        <p className="donation-warning">{copy.warning}</p>
      </section>
    </div>
  );
}
