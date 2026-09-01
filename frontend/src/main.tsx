import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { DonationCard } from './DonationCard';
import './styles.css';
import './wallets.css';
import './wallet.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element was not found.');
}

createRoot(root).render(
  <StrictMode>
    <App />
    <DonationCard />
  </StrictMode>,
);
