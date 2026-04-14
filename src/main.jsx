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
import IndiaTab                  from './pages/IndiaTab';
import TradesTab                 from './pages/TradesTab';
import PortfolioTab              from './pages/PortfolioTab';
import AlertsTab                 from './pages/AlertsTab';
import JournalTab                from './pages/JournalTab';
import SettingsTab               from './pages/SettingsTab';
import BacktestTab               from './pages/BacktestTab';
import { T, fa, md, isIndianSignal } from './utils/format';
import { Auth }                  from './api/endpoints';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const DEBUG_RENDER = import.meta.env.VITE_DEBUG_RENDER === '1';

// ── helper: is this a closed Indian market journal entry ─────────────────
function isIndianJournalEntry(j) {
  return j?.pair?.endsWith('.NS') || j?.pair?.endsWith('.BO') ||
         j?.pair?.startsWith('^NSE') || j?.pair?.startsWith('^BSE') ||
         j?.pairCat?.startsWith('INDIA') || j?.pairCat?.startsWith('CHARTINK');
}

const TABS = [
  { id: 'scanner',   label: s => `Scanner (${s.signals.filter(x => x.status === 'LIVE' && !isIndianSignal(x)).length})` },
  { id: 'india',     label: s => { const n = s.signals.filter(x => x.status === 'LIVE' && isIndianSignal(x)).length; return `🇮🇳 India${n > 0 ? ` (${n})` : ''}`; }, color: '#6366f1' },
  { id: 'trades',    label: s => `Trades (${s.journal.filter(j => j.outcome).length})` },
  { id: 'portfolio', label: () => 'Portfolio' },
  { id: 'alerts',    label: s => `Alerts (${s.autoCloseLog.length})` },
  { id: 'journal',   label: s => `Journal (${s.journal.length})` },
  { id: 'backtest',  label: () => 'Backtest' },
  { id: 'settings',  label: () => 'Settings' },
];

function AppShell() {
  const { user, token, tab, setTab, logout } = useStore();
  const store = useStore();

  useWebSocket();
  useData();

  useEffect(() => {
    if (token && !user) {
      Auth.me().then(r => store.setAuth(r.data, token)).catch(() => logout());
    }
  }, []);

  useEffect(() => {
    if (store.portfolio?.settings) store.setSettings(store.portfolio.settings);
  }, [store.portfolio]);

  const portfolio = store.portfolio;
  const balance   = portfolio?.balance ?? 10000;
  const STARTING  = 10000;
  const ddPct     = portfolio
    ? +((Math.max(portfolio.peakBalance, balance) - balance) / Math.max(portfolio.peakBalance, balance) * 100).toFixed(1)
    : 0;
  const wr = (() => {
    const cl = store.journal.filter(j => j.outcome);
    const w  = cl.filter(j => j.outcome === 'win');
    return cl.length ? +((w.length / cl.length) * 100).toFixed(1) : 50;
  })();

  // Indian market closed P&L in ₹ for the header KPI
  const indiaClosedPnl = store.journal
    .filter(j => j.outcome && isIndianJournalEntry(j))
    .reduce((s, j) => s + (j.pnl ?? 0), 0);

  const liveSignals  = store.signals.filter(s => s.status === 'LIVE');
  const indiaSignals = liveSignals.filter(isIndianSignal);
  const forexSignals = liveSignals.filter(s => !isIndianSignal(s));

  const PAGE = {
    scanner:   ScannerTab,
    india:     IndiaTab,
    trades:    TradesTab,
    portfolio: PortfolioTab,
    alerts:    AlertsTab,
    journal:   JournalTab,
    backtest:  BacktestTab,
    settings:  SettingsTab,
  };
  const Page = PAGE[tab] || ScannerTab;

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
              <span style={{ color: '#6366f1', fontSize: 9, marginLeft: 8 }}>+ INDIA</span>
            </div>
            <div style={{ fontSize: 8, color: T.muted }}>
              Server-side scanning · WebSocket push ·{' '}
              {store.settings.autoClose
                ? <span style={{ color: T.blue }}>Auto-Close ON</span>
                : <span style={{ color: T.muted }}>Auto-Close OFF</span>}
            </div>
          </div>
        </div>

        {/* KPI pills */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {[
            ['BALANCE',  `$${balance.toLocaleString()}`,
              balance >= STARTING ? T.accent : T.red],
            ['P&L \u20B9',
              `${indiaClosedPnl >= 0 ? '+' : ''}\u20B9${Math.abs(indiaClosedPnl).toFixed(0)}`,
              indiaClosedPnl >= 0 ? T.accent : T.red],
            ['DD',       `${ddPct}%`,
              ddPct > 12 ? T.red : ddPct > 8 ? T.yellow : T.accent],
            ['FOREX',    forexSignals.length, T.blue],
            ['INDIA',    indiaSignals.length, '#6366f1'],
            ['WR',       `${wr}%`, wr >= 50 ? T.accent : T.red],
          ].map(([l, v, c]) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: T.muted, letterSpacing: '0.1em' }}>{l}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: c }}>{v}</div>
            </div>
          ))}
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {user.picture && (
                <img src={user.picture} alt=""
                  style={{ width: 28, height: 28, borderRadius: '50%', border: `1px solid ${T.border}` }} />
              )}
              <button onClick={logout} style={{
                fontSize: 8, color: T.muted, background: 'transparent',
                border: `1px solid ${T.border}`, borderRadius: 4,
                padding: '3px 8px', cursor: 'pointer', fontFamily: 'monospace',
              }}>Sign out</button>
            </div>
          )}
        </div>
      </header>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div style={{
        background: T.panel, borderBottom: `1px solid ${T.border}`,
        padding: '0 20px', display: 'flex', gap: 0, overflowX: 'auto',
      }}>
        {TABS.map(t => {
          const isActive = tab === t.id;
          const isIndia  = t.id === 'india';
          const color    = t.color || T.accent;
          const label    = typeof t.label === 'function' ? t.label(store) : t.label;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '12px 18px',
              borderTop: 'none', borderLeft: 'none', borderRight: 'none',
              borderBottom: `2px solid ${isActive ? color : 'transparent'}`,
              color: isActive ? color : T.muted,
              background: isActive && isIndia ? '#6366f118' : 'transparent',
              fontFamily: 'inherit', fontSize: 9, cursor: 'pointer',
              textTransform: 'uppercase', letterSpacing: '0.07em',
              fontWeight: isActive ? 700 : 400, transition: 'all .2s',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              {label}
              {isIndia && indiaSignals.length > 0 && !isActive && (
                <span style={{
                  display: 'inline-block', width: 5, height: 5,
                  borderRadius: '50%', background: '#6366f1',
                  marginLeft: 5, verticalAlign: 'middle',
                  animation: 'ping 1.5s ease-in-out infinite',
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Page ────────────────────────────────────────────────────────── */}
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