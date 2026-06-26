import React from 'react';
import { createRoot } from 'react-dom/client';
import './whitepaper.css';
import Whitepaper from './Whitepaper.jsx';
import { WhitepaperErrorBoundary } from './WhitepaperErrorBoundary.jsx';

const rootEl = document.getElementById('root');

if (!rootEl) {
  throw new Error('Root element #root not found');
}

createRoot(rootEl).render(
  <React.StrictMode>
    <WhitepaperErrorBoundary>
      <Whitepaper />
    </WhitepaperErrorBoundary>
  </React.StrictMode>,
);
