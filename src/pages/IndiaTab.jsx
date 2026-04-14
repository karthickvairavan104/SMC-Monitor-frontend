import { useState, useEffect } from 'react';
import useStore from '../store/useStore';
import SignalCard from '../components/SignalCard';
import { Pill } from '../components/Atoms';
import { T, fa, md, isIndianSignal, isChartinkSignal, signalSource } from '../utils/format';
import { Chartink } from '../api/endpoints';
import toast from 'react-hot-toast';

// ── IST clock helper ─────────────────────────────────────────────────────
function istNow() {
  return new Date().toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function getMarketPhase() {
  const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const hm  = ist.getHours() * 60 + ist.getMinutes();
  const day = ist.getDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return { phase: 'WEEKEND', color: T.muted, open: false };
  if (hm >= 9*60 && hm < 9*60+15)  return { phase: 'PRE-OPEN', color: T.yellow, open: false };
  if (hm >= 9*60+15 && hm < 15*60+30) return { phase: 'MARKET OPEN', color: T.accent, open: true };
  if (hm >= 15*60+30 && hm < 16*60)   return { phase: 'CLOSING',    color: T.orange, open: false };
  return { phase: 'CLOSED', color: T.muted, open: false };
}

// ── Sub-tab switcher ──────────────────────────────────────────────────────
function SubTab({ id, label, active, onClick, count }) {
  return (
    <button onClick={() => onClick(id)} style={{
      padding: '7px 14px',
      background: active ? fa(T.indigo) : 'transparent',
      border: `1px solid ${active ? T.indigo : T.border}`,
      borderRadius: 6, color: active ? T.indigo : T.muted,
      fontFamily: 'inherit', fontSize: 9, cursor: 'pointer',
      fontWeight: active ? 700 : 400, transition: 'all .2s',
    }}>
      {label}{count !== undefined ? ` (${count})` : ''}
    </button>
  );
}

// ── Candidate pool row ────────────────────────────────────────────────────
function CandidateRow({ sym, source }) {
  const display = sym.replace('.NS', '').replace('.BO', '').replace('^', '');
  const isIndex = sym.startsWith('^');
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '7px 10px', borderBottom: `1px solid ${T.border}18`,
      fontSize: 9,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 6, flexShrink: 0,
        background: isIndex ? fa(T.yellow) : fa(T.indigo),
        border: `1px solid ${isIndex ? T.yellow : T.indigo}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 7, fontWeight: 700, color: isIndex ? T.yellow : T.indigo,
      }}>{isIndex ? 'IDX' : 'EQ'}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, color: T.text }}>{display}</div>
        <div style={{ fontSize: 8, color: T.muted }}>{sym}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <Pill
          label={source?.startsWith('Yahoo') ? 'YAHOO' : 'CHARTINK'}
          color={source?.startsWith('Yahoo') ? T.blue : T.indigo}
          sz={7}
        />
        <div style={{ fontSize: 7, color: T.muted, marginTop: 2 }}>{source}</div>
      </div>
    </div>
  );
}

// ── Market clock panel ────────────────────────────────────────────────────
function MarketClockPanel({ phase, istTime, candidateCount }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${phase.color}44`,
      borderRadius: 10, padding: '12px 16px',
      display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap',
    }}>
      {/* Pulsing dot */}
      <div style={{ position: 'relative', width: 10, height: 10, flexShrink: 0 }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: phase.color, position: 'absolute',
          animation: phase.open ? 'ping 1.5s ease-in-out infinite' : 'none',
        }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: phase.color }} />
      </div>

      <div>
        <div style={{ fontSize: 7, color: T.muted, letterSpacing: '0.1em' }}>NSE MARKET STATUS</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: phase.color }}>{phase.phase}</div>
      </div>

      <div style={{ borderLeft: `1px solid ${T.border}`, paddingLeft: 20 }}>
        <div style={{ fontSize: 7, color: T.muted }}>IST TIME</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: 'monospace' }}>{istTime}</div>
      </div>

      <div style={{ borderLeft: `1px solid ${T.border}`, paddingLeft: 20 }}>
        <div style={{ fontSize: 7, color: T.muted }}>CANDIDATES</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.blue }}>{candidateCount}</div>
      </div>

      <div style={{ borderLeft: `1px solid ${T.border}`, paddingLeft: 20 }}>
        <div style={{ fontSize: 7, color: T.muted }}>TRADING HOURS</div>
        <div style={{ fontSize: 11, fontWeight: 600, color: T.text }}>9:15 – 15:30 IST</div>
      </div>

      <div style={{ marginLeft: 'auto', fontSize: 8, color: T.muted, lineHeight: 1.7, textAlign: 'right' }}>
        <div>Mon – Fri only</div>
        <div>UTC+5:30</div>
      </div>
    </div>
  );
}

// ── Chartink setup guide ──────────────────────────────────────────────────
function ChartinkSetupGuide({ backendUrl }) {
  const webhookUrl = `${backendUrl}/api/chartink/webhook?secret=YOUR_SECRET`;

  return (
    <div style={{
      background: T.card, border: `1px solid ${T.indigo}44`,
      borderRadius: 10, padding: '14px 16px',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: T.indigo, marginBottom: 14 }}>
        ⚡ CHARTINK WEBHOOK SETUP
      </div>

      {[
        {
          step: '1',
          title: 'Create a screener on Chartink',
          desc: 'Go to chartink.com → Screener → build your scan (e.g. volume breakout, EMA crossover, price near 52W high)',
          color: T.indigo,
        },
        {
          step: '2',
          title: 'Create an alert for the screener',
          desc: 'Click "Create Alert" next to your screener → set frequency (every 1 min on premium)',
          color: T.blue,
        },
        {
          step: '3',
          title: 'Add this webhook URL',
          desc: 'In the alert form → Webhook URL field → paste the URL below. Set CHARTINK_WEBHOOK_SECRET env var on your backend first.',
          color: T.accent,
        },
        {
          step: '4',
          title: 'SMC scanner auto-picks up matches',
          desc: 'When Chartink fires the alert, matched NSE stocks appear in the candidate pool below and get scanned by your SMC engine within 60s.',
          color: T.teal,
        },
      ].map(({ step, title, desc, color }) => (
        <div key={step} style={{
          display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start',
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
            background: fa(color), border: `1px solid ${md(color)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700, color,
          }}>{step}</div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.text, marginBottom: 2 }}>{title}</div>
            <div style={{ fontSize: 9, color: T.muted, lineHeight: 1.6 }}>{desc}</div>
          </div>
        </div>
      ))}

      {/* Webhook URL box */}
      <div style={{
        background: T.dim, borderRadius: 7, padding: '10px 12px',
        border: `1px solid ${T.border}`, marginTop: 4,
      }}>
        <div style={{ fontSize: 7, color: T.muted, marginBottom: 4, letterSpacing: '0.08em' }}>
          YOUR WEBHOOK URL
        </div>
        <div style={{
          fontSize: 9, color: T.accent, fontFamily: 'monospace',
          wordBreak: 'break-all', lineHeight: 1.6,
        }}>
          {webhookUrl}
        </div>
        <div style={{ fontSize: 8, color: T.muted, marginTop: 6 }}>
          Replace YOUR_SECRET with the value of CHARTINK_WEBHOOK_SECRET in your backend env.
          Chartink will POST to this URL when any alert fires — no auth header needed, the
          secret in the query param validates the request.
        </div>
      </div>

      {/* Screener ideas */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 8, color: T.muted, letterSpacing: '0.08em', marginBottom: 8 }}>
          SUGGESTED SCREENER CONDITIONS (complement your SMC engine)
        </div>
        {[
          ['Volume Breakout',    'volume > 2 * sma(volume,20)',                  T.blue],
          ['Near 52W High',      'close > 0.97 * 52 week high',                  T.accent],
          ['EMA Momentum',       'ema(close,9) > ema(close,21) and close > ema(close,50)', T.teal],
          ['Opening Range Break','latest high, 15min > 1 candle ago high, 15min', T.yellow],
          ['High Volume Gainer', 'pchange > 3 and volume > 500000',               T.indigo],
        ].map(([name, clause, color]) => (
          <div key={name} style={{
            display: 'flex', gap: 10, marginBottom: 6, alignItems: 'center',
          }}>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <div>
              <span style={{ fontSize: 9, fontWeight: 700, color }}>{name}: </span>
              <span style={{ fontSize: 8, color: T.muted, fontFamily: 'monospace' }}>{clause}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main IndiaTab ─────────────────────────────────────────────────────────
export default function IndiaTab() {
  const { signals, newSigIds, chartinkCandidates, setChartinkCandidates } = useStore();

  const [subTab,   setSubTab]   = useState('signals');
  const [istTime,  setIstTime]  = useState(istNow());
  const [phase,    setPhase]    = useState(getMarketPhase());
  const [loading,  setLoading]  = useState(false);

  // Live IST clock
  useEffect(() => {
    const t = setInterval(() => {
      setIstTime(istNow());
      setPhase(getMarketPhase());
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Load candidate pool
  useEffect(() => {
    loadCandidates();
    const t = setInterval(loadCandidates, 30_000); // refresh every 30s
    return () => clearInterval(t);
  }, []);

  async function loadCandidates() {
    try {
      const r = await Chartink.candidates();
      const pool = r.data?.candidates || {};
      // Merge chartink + yahoo into a flat list
      const list = Object.entries(pool).map(([sym, source]) => ({ sym, source }));
      setChartinkCandidates(list, r.data?.marketOpen ?? false);
    } catch {
      // Silently fail — backend may not be running
    }
  }

  async function pingWebhook() {
    setLoading(true);
    try {
      const r = await Chartink.ping();
      toast.success(`Webhook reachable · ${r.data?.candidates ?? 0} candidates in pool`);
    } catch {
      toast.error('Webhook endpoint unreachable — check your backend URL');
    } finally {
      setLoading(false);
    }
  }

  // Filter signals to Indian market only
  const liveIndian   = signals.filter(s => s.status === 'LIVE'   && isIndianSignal(s));
  const closedIndian = signals.filter(s => s.status === 'CLOSED' && isIndianSignal(s));
  const chartinkSigs = signals.filter(s => s.status === 'LIVE'   && isChartinkSignal(s));

  const backendUrl = (import.meta.env.VITE_API_URL || '/api').replace('/api', '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Market clock ──────────────────────────────────────────────── */}
      <MarketClockPanel
        phase={phase}
        istTime={istTime}
        candidateCount={chartinkCandidates.length}
      />

      {/* ── Sub-tab bar ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <SubTab id="signals"   label="Live Signals"  active={subTab==='signals'}   onClick={setSubTab} count={liveIndian.length} />
        <SubTab id="chartink"  label="Chartink"      active={subTab==='chartink'}  onClick={setSubTab} count={chartinkSigs.length} />
        <SubTab id="pool"      label="Candidate Pool" active={subTab==='pool'}     onClick={setSubTab} count={chartinkCandidates.length} />
        <SubTab id="setup"     label="Setup Guide"   active={subTab==='setup'}     onClick={setSubTab} />

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={pingWebhook} disabled={loading} style={{
            padding: '6px 12px', borderRadius: 6, fontSize: 8,
            background: fa(T.indigo), border: `1px solid ${md(T.indigo)}`,
            color: T.indigo, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 700,
            opacity: loading ? 0.5 : 1,
          }}>
            {loading ? '…' : '⚡ Ping Webhook'}
          </button>
          <button onClick={loadCandidates} style={{
            padding: '6px 12px', borderRadius: 6, fontSize: 8,
            background: 'transparent', border: `1px solid ${T.border}`,
            color: T.muted, fontFamily: 'inherit', cursor: 'pointer',
          }}>↻ Refresh</button>
        </div>
      </div>

      {/* ── Sub-tab content ───────────────────────────────────────────── */}

      {/* LIVE SIGNALS */}
      {subTab === 'signals' && (
        <>
          {liveIndian.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: T.muted }}>
              <div style={{ fontSize: 20, marginBottom: 10 }}>🇮🇳</div>
              <div style={{ fontSize: 12, marginBottom: 6 }}>
                {phase.open
                  ? 'No Indian market signals yet — scanner is watching'
                  : `NSE ${phase.phase} — signals will appear during market hours`}
              </div>
              <div style={{ fontSize: 9 }}>
                {chartinkCandidates.length > 0
                  ? `${chartinkCandidates.length} stocks in candidate pool, SMC scanner will check them next cycle`
                  : 'Configure Chartink webhooks in the Setup Guide tab to surface stocks automatically'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {liveIndian.map(sig => (
                <SignalCard key={sig.id} sig={sig} isNew={newSigIds.has(sig.id)} />
              ))}
            </div>
          )}

          {/* Closed Indian signals */}
          {closedIndian.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 9, color: T.muted, letterSpacing: '0.1em', marginBottom: 8 }}>
                CLOSED ({closedIndian.length})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {closedIndian.slice(0, 6).map(sig => (
                  <SignalCard key={sig.id} sig={sig} isNew={false} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* CHARTINK-SOURCED SIGNALS */}
      {subTab === 'chartink' && (
        <>
          <div style={{
            background: fa(T.indigo), border: `1px solid ${md(T.indigo)}`,
            borderRadius: 8, padding: '10px 14px', fontSize: 9, color: T.muted,
          }}>
            <span style={{ color: T.indigo, fontWeight: 700 }}>CHARTINK SIGNALS — </span>
            These are SMC-scored signals on stocks that came through Chartink alerts.
            pairCat starts with "CHARTINK:" so you can distinguish them from Yahoo-discovered stocks.
          </div>

          {chartinkSigs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 50, color: T.muted }}>
              <div style={{ fontSize: 12, marginBottom: 6 }}>No Chartink-sourced signals yet</div>
              <div style={{ fontSize: 9 }}>
                Set up webhooks in the Setup Guide tab — Chartink alerts will surface stocks
                that your SMC scanner then validates with full scoring.
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {chartinkSigs.map(sig => (
                <div key={sig.id}>
                  <div style={{
                    fontSize: 8, color: T.indigo, marginBottom: 4, paddingLeft: 2,
                    fontWeight: 700,
                  }}>
                    ⚡ {signalSource(sig)}
                  </div>
                  <SignalCard sig={sig} isNew={newSigIds.has(sig.id)} />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* CANDIDATE POOL */}
      {subTab === 'pool' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

          {/* Pool list */}
          <div style={{
            background: T.card, border: `1px solid ${T.border}`,
            borderRadius: 10, overflow: 'hidden',
          }}>
            <div style={{
              padding: '12px 14px', borderBottom: `1px solid ${T.border}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.indigo }}>
                DYNAMIC CANDIDATES
              </div>
              <div style={{ fontSize: 8, color: T.muted }}>
                {chartinkCandidates.length} / 60 max
              </div>
            </div>

            {chartinkCandidates.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: T.muted, fontSize: 10 }}>
                Pool is empty.
                {phase.open
                  ? ' Chartink alerts will populate this during market hours.'
                  : ' Market is closed — pool refreshes at open.'}
              </div>
            ) : (
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {chartinkCandidates.map(({ sym, source }) => (
                  <CandidateRow key={sym} sym={sym} source={source} />
                ))}
              </div>
            )}
          </div>

          {/* Pool info panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              background: T.card, border: `1px solid ${T.border}`,
              borderRadius: 10, padding: '14px 16px',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.blue, marginBottom: 12 }}>
                HOW THE POOL WORKS
              </div>
              {[
                ['Chartink push', 'Stocks fire into the pool the moment a Chartink alert triggers (near real-time on premium).', T.indigo],
                ['Yahoo fallback', 'Every 15 min, top movers/gainers/losers from Yahoo Finance India screener are added.', T.blue],
                ['SMC scan cycle', 'Every 60s, ScannerService reads this pool + your watchlist and runs full SMC scoring on all symbols.', T.accent],
                ['Auto-clear', 'Pool is cleared at 15:40 IST each day so stale signals from yesterday don\'t carry over.', T.muted],
              ].map(([title, desc, color]) => (
                <div key={title} style={{
                  display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start',
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, marginTop: 5, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color, marginBottom: 2 }}>{title}</div>
                    <div style={{ fontSize: 8, color: T.muted, lineHeight: 1.6 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              background: fa(T.yellow), border: `1px solid ${md(T.yellow)}`,
              borderRadius: 8, padding: '10px 14px', fontSize: 8, color: T.muted, lineHeight: 1.7,
            }}>
              <div style={{ color: T.yellow, fontWeight: 700, marginBottom: 4 }}>⚠ NOTE ON CANDLE DATA</div>
              Indian stocks use Yahoo Finance OHLCV data (free, no API key needed).
              The 1h candle data is reliable and covers NSE cash market hours.
              Indices (^NSEI, ^NSEBANK) also work — volume is ignored for index scoring.
            </div>
          </div>
        </div>
      )}

      {/* SETUP GUIDE */}
      {subTab === 'setup' && (
        <ChartinkSetupGuide backendUrl={backendUrl} />
      )}

    </div>
  );
}
