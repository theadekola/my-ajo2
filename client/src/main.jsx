import React from 'react';
import ReactDOM from 'react-dom/client';
import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import { nativeBackRoute } from './utils/appRoutes.js';
import { AuthProvider } from './context/AuthContext.jsx';
import './styles.css';

if (!window.location.hash && /^\/(invite\/|group\/|auth|notifications)/.test(window.location.pathname)) {
  window.history.replaceState(null, '', `/#${window.location.pathname}${window.location.search}`);
}

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
        const action = nativeBackRoute(window.location.hash, canGoBack);
        if (action === 'back') window.history.back();
        else if (action === 'minimize') NativeApp.minimizeApp?.();
        else window.location.hash = action;
      });
    }),
    import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
      StatusBar.setStyle?.({ style: Style.Light }).catch?.(() => {});
      StatusBar.setBackgroundColor?.({ color: '#0D4A2E' }).catch?.(() => {});
      StatusBar.setOverlaysWebView?.({ overlay: true }).catch?.(() => {});
    }),
  ]).catch(() => {});
}
