import React from 'react';
import ReactDOM from 'react-dom/client';
import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider><App /></AuthProvider>
    </HashRouter>
  </React.StrictMode>
);

const isNativeCapacitor = typeof window !== 'undefined' && (
  window.Capacitor?.isNativePlatform?.() ||
  window.location.hostname === 'localhost'
);

if (isNativeCapacitor) {
  document.documentElement.classList.add('native-app');
  SystemBars.setStyle?.({ style: SystemBarsStyle.Light }).catch?.(() => {});
}

if (!isNativeCapacitor && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            worker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    }).catch(() => {});
  });
}

if (isNativeCapacitor) {
  Promise.allSettled([
    import('@capacitor/app').then(({ App: NativeApp }) => {
      NativeApp.addListener('backButton', ({ canGoBack }) => {
        const primaryPaths = new Set(['/dashboard', '/groups', '/contributions', '/calendar', '/more']);
        if (canGoBack && !primaryPaths.has(window.location.pathname)) {
          window.history.back();
        } else if (window.location.pathname !== '/dashboard') {
          window.history.pushState(null, '', '/dashboard');
          window.dispatchEvent(new PopStateEvent('popstate'));
        } else {
          NativeApp.minimizeApp?.();
        }
      });
    }),
    import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
      StatusBar.setStyle?.({ style: Style.Light }).catch?.(() => {});
      StatusBar.setBackgroundColor?.({ color: '#0D4A2E' }).catch?.(() => {});
      StatusBar.setOverlaysWebView?.({ overlay: true }).catch?.(() => {});
    }),
  ]).catch(() => {});
}
