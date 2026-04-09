// Polyfill for libraries that expect a Node `global` variable (e.g. sockjs-client).
// This must run before any imports that may pull in those libraries.
if (typeof global === 'undefined') {
  // eslint-disable-next-line no-undef
  window.global = window;
}

import { StrictMode, useEffect } from 'react';
import ErrorBoundary from './ErrorBoundary';
import { createRoot }            from 'react-dom/client';
import { GoogleOAuthProvider }   from '@react-oauth/google';
import { Toaster }               from 'react-hot-toast';
import useStore                  from './store/useStore';
import useWebSocket              from './hooks/useWebSocket';
import useData                   from './hooks/useData';
import LoginPage                 from './pages/LoginPage';
import ScannerTab                from './pages/ScannerTab';
import TradesTab                 from './pages/TradesTab';
import PortfolioTab              from './pages/PortfolioTab';
import AlertsTab                 from './pages/AlertsTab';
import JournalTab                from './pages/JournalTab';
import SettingsTab               from './pages/SettingsTab';
import { T, fa, md }             from './utils/format';
import { Auth }                  from './api/endpoints';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const DEBUG_RENDER = import.meta.env.VITE_DEBUG_RENDER === '1';

const TABS = [
  { id: 'scanner',   label: s => `Scanner (${s.signals.filter(x => x.status === 'LIVE').length})` },
  { id: 'trades',    label: s => `Trades (${s.journal.filter(j => j.outcome).length})` },
  { id: 'portfolio', label: () => 'Portfolio' },
  { id: 'alerts',    label: s => `Alerts (${s.autoCloseLog.length})` },
  { id: 'journal',   label: s => `Journal (${s.journal.length})` },
  { id: 'settings',  label: () => 'Settings' },
];

function AppShell() {
  const { user, token, tab, setTab, logout, setScanning } = useStore();
  const store = useStore();

  useWebSocket();
  useData();

  // Restore user from stored token on first load
  useEffect(() => {
    if (token && !user) {
      Auth.me().then(r => store.setAuth(r.data, token)).catch(() => logout());
    }
  }, []);

  // Sync settings from portfolio response
  useEffect(() => {
    if (store.portfolio?.settings) store.setSettings(store.portfolio.settings);
  }, [store.portfolio]);

  const portfolio = store.portfolio;
  const balance   = portfolio?.balance ?? 10000;
  const STARTING  = 10000;
  const ddPct     = portfolio ? +((Math.max(portfolio.peakBalance, balance) - balance) / Math.max(portfolio.peakBalance, balance) * 100).toFixed(1) : 0;
  const wr        = (() => {
    const cl = store.journal.filter(j => j.outcome);
    const w  = cl.filter(j => j.outcome === 'win');
    return cl.length ? +((w.length / cl.length) * 100).toFixed(1) : 50;
  })();

  const PAGE = { scanner: ScannerTab, trades: TradesTab, portfolio: PortfolioTab, alerts: AlertsTab, journal: JournalTab, settings: SettingsTab };
  const Page = PAGE[tab];

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header style={{
        background: T.panel, borderBottom: `1px solid ${T.border}`,
        padding: '0 20px', height: 54,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 300,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.07em' }}>
              <span style={{ color: T.accent }}>SMC</span>
              <span style={{ color: T.muted }}> LIVE MONITOR </span>
              <span style={{ color: T.blue }}>v15</span>
            </div>
            <div style={{ fontSize: 8, color: T.muted }}>
              Server-side scanning · WebSocket push · {store.settings.autoClose ? <span style={{ color: T.blue }}>Auto-Close ON</span> : <span style={{ color: T.muted }}>Auto-Close OFF</span>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {[
            ['BALANCE', `$${balance.toLocaleString()}`, balance >= STARTING ? T.accent : T.red],
            ['DD',      `${ddPct}%`,                    ddPct > 12 ? T.red : ddPct > 8 ? T.yellow : T.accent],
            ['SIGNALS', store.signals.filter(s => s.status === 'LIVE').length, T.blue],
            ['WR',      `${wr}%`,                       wr >= 50 ? T.accent : T.red],
          ].map(([l, v, c]) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: T.muted, letterSpacing: '0.1em' }}>{l}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: c }}>{v}</div>
            </div>
          ))}
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {user.picture && <img src={user.picture} alt="" style={{ width: 28, height: 28, borderRadius: '50%', border: `1px solid ${T.border}` }} />}
              <button onClick={logout}
                style={{ fontSize: 8, color: T.muted, background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontFamily: 'monospace' }}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div style={{ background: T.panel, borderBottom: `1px solid ${T.border}`, padding: '0 20px', display: 'flex', gap: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '12px 18px',
            borderBottom: `2px solid ${tab === t.id ? T.accent : 'transparent'}`,
            color: tab === t.id ? T.accent : T.muted,
            background: 'transparent', borderWidth: 0,
            fontFamily: 'inherit', fontSize: 9, cursor: 'pointer',
            textTransform: 'uppercase', letterSpacing: '0.07em',
            fontWeight: tab === t.id ? 700 : 400, transition: 'all .2s',
          }}>
            {typeof t.label === 'function' ? t.label(store) : t.label}
          </button>
        ))}
      </div>

      {/* ── Page content ───────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 16 }}>
        <Page />
      </div>

      <style>{`
        @keyframes ping { 0%,100%{transform:scale(1);opacity:.4} 50%{transform:scale(2.2);opacity:0} }
        @keyframes signalAppear { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:none} }
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-thumb{background:#0e1e35;border-radius:2px}
        *{box-sizing:border-box}
      `}</style>
    </div>
  );
}

function App() {
  const { user, token } = useStore();
  if (!token && !user) return <LoginPage />;
  return <AppShell />;
}

if (DEBUG_RENDER) {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <div style={{ padding: 24, color: '#d8e8ff', background: '#010409', minHeight: '100vh', fontFamily: 'monospace' }}>
        DEBUG RENDER — React mounted successfully.
      </div>
    </StrictMode>
  );
} else {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <ErrorBoundary>
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
          <Toaster position="top-right" toastOptions={{ style: { background: '#080f1c', color: '#d8e8ff', border: '1px solid #0e1e35', fontFamily: 'monospace', fontSize: 12 } }} />
          <App />
        </GoogleOAuthProvider>
      </ErrorBoundary>
    </StrictMode>
  );
}
