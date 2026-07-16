import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { StoreProvider } from './store/StoreContext.jsx';
import './index.css';

// PWA: offline shell + installability ("Add to Home screen" on Android).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </React.StrictMode>,
);
