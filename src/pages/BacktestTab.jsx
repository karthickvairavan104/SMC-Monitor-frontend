import { useState, useMemo } from 'react';
import { Backtest }          from '../api/endpoints';
import { T, fa, md, gc, fmtDate, ALL_PAIRS } from '../utils/format';
import toast                 from 'react-hot-toast';

// ── tiny helpers ──────────────────────────────────────────────────────────
const fmtPrice = (v, pair) => {
  if (v == null || isNaN(v)) return '–';
  const dp = (pair?.includes('JPY') || pair === 'XAU/USD' || pair === 'NAS100') ? 2 : 4;
  return Number(v).toFixed(dp);
};
const pct = v => `${v >= 0 ? '+' : ''}${Number(v).toFixed(1)}%`;
const money = v => `${v >= 0 ? '+' : ''}$${Math.abs(v).toFixed(2)}`;

// ── palette shortcuts ─────────────────────────────────────────────────────
const G = T.accent, R = T.red, B = T.blue, Y = T.yellow, M = T.muted;

// ── StatCard ──────────────────────────────────────────────────────────────
function Stat({ label, value, color = T.text, sub }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: '9px 13px', minWidth: 95 }}>
      <div style={{ fontSize: 7, color: M, letterSpacing: '0.1em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 7, color: M, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Simple SVG equity curve ───────────────────────────────────────────────
function EquityChart({ curve, starting }) {
  if (!curve || curve.length < 2) return null;
  const W = 580, H = 110;
  const mn = Math.min(...curve, starting) * 0.998;
  const mx = Math.max(...curve, starting) * 1.002;
  const rng = mx - mn || 1;
  const scX = i => (i / (curve.length - 1)) * W;
  const scY = v => H - ((v - mn) / rng) * H;

  let pts = curve.map((v, i) => `${scX(i)},${scY(v)}`).join(' ');
  const last  = curve[curve.length - 1];
  const color = last >= starting ? G : R;

  // area fill
  const area = `M0,${scY(curve[0])} ` +
    curve.map((v, i) => `L${scX(i)},${scY(v)}`).join(' ') +
    ` L${W},${H} L0,${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }}>
      <defs>
        <linearGradient id="btGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#btGrad)" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" />
      {/* baseline */}
      <line x1="0" y1={scY(starting)} x2={W} y2={scY(starting)}
        stroke={M} strokeWidth="0.8" strokeDasharray="4 3" />
    </svg>
  );
}

// ── Score calibration mini-bar chart ─────────────────────────────────────
function CalibrationChart({ wins, losses }) {
  if (!wins && !losses) return null;
  const buckets = ['6-8','8-11','11-14','14+'];
  const rows = buckets.map(b => ({
    b,
    w: (wins   || {})[b] || 0,
    l: (losses || {})[b] || 0,
  })).filter(r => r.w + r.l > 0);
  if (!rows.length) return null;
  const maxN = Math.max(...rows.map(r => r.w + r.l));

  return (
    <div>
      <div style={{ fontSize: 8, color: M, letterSpacing: '0.08em', marginBottom: 6 }}>SCORE CALIBRATION</div>
      {rows.map(r => {
        const total = r.w + r.l;
        const wr = total ? Math.round(r.w / total * 100) : 0;
        return (
          <div key={r.b} style={{ marginBottom: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, marginBottom: 2 }}>
              <span style={{ color: M }}>Score {r.b}</span>
              <span style={{ color: wr >= 50 ? G : R, fontWeight: 700 }}>{wr}% WR ({total} trades)</span>
            </div>
            <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: T.dim }}>
              <div style={{ width: `${r.w / maxN * 100}%`, background: G, opacity: 0.8 }} />
              <div style={{ width: `${r.l / maxN * 100}%`, background: R, opacity: 0.7 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Trade table ───────────────────────────────────────────────────────────
function TradeTable({ trades }) {
  const [page, setPage] = useState(1);
  const PER = 20;
  const total = Math.ceil(trades.length / PER);
  const rows  = trades.slice((page - 1) * PER, page * PER);

  const OUT_COL = { win: G, partial: Y, loss: R, timeout: M };

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
          <thead style={{ background: T.dim }}>
            <tr>
              {['DATE','PAIR','DIR','ENTRY','SL','TP1','SCORE','SESSION','REGIME','OUTCOME','P&L'].map(h => (
                <th key={h} style={{ padding: '6px 9px', fontSize: 7, color: M, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((t, k) => {
              const dir = t.isBull ? 'BUY' : 'SELL';
              const pc  = (t.pnl ?? 0) >= 0 ? G : R;
              return (
                <tr key={k} style={{ borderBottom: `1px solid ${T.border}20` }}>
                  <td style={{ padding: '6px 9px', color: M, fontSize: 8 }}>{fmtDate(t.openedAt)}</td>
                  <td style={{ padding: '6px 9px', fontWeight: 700 }}>{t.pair}</td>
                  <td style={{ padding: '6px 9px', color: t.isBull ? G : R, fontWeight: 700 }}>
                    {t.isBull ? '▲' : '▼'} {dir}
                  </td>
                  <td style={{ padding: '6px 9px', fontFamily: 'monospace', fontSize: 8 }}>{fmtPrice(t.entry, t.pair)}</td>
                  <td style={{ padding: '6px 9px', fontFamily: 'monospace', fontSize: 8, color: M }}>{fmtPrice(t.sl, t.pair)}</td>
                  <td style={{ padding: '6px 9px', fontFamily: 'monospace', fontSize: 8, color: M }}>{fmtPrice(t.tp1, t.pair)}</td>
                  <td style={{ padding: '6px 9px', color: gc(t.grade), fontSize: 8 }}>{t.score?.toFixed(1)}</td>
                  <td style={{ padding: '6px 9px', color: M, fontSize: 8 }}>{t.session ?? '–'}</td>
                  <td style={{ padding: '6px 9px', color: M, fontSize: 8 }}>{t.regime ?? '–'}</td>
                  <td style={{ padding: '6px 9px', color: OUT_COL[t.outcome] ?? M, fontWeight: 700 }}>
                    {(t.outcome ?? '–').toUpperCase()}
                  </td>
                  <td style={{ padding: '6px 9px', color: pc, fontWeight: 700 }}>
                    {t.pnl != null ? money(t.pnl) : '–'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {total > 1 && (
        <div style={{ display: 'flex', gap: 4, marginTop: 8, justifyContent: 'center' }}>
          {Array.from({ length: total }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)} style={{
              width: 24, height: 24, borderRadius: 4, border: `1px solid ${T.border}`,
              background: p === page ? T.accent : 'transparent',
              color: p === page ? T.bg : M,
              fontFamily: 'inherit', fontSize: 8, cursor: 'pointer', fontWeight: 700,
            }}>{p}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ResultCard ────────────────────────────────────────────────────────────
function ResultCard({ r, onSelect, selected }) {
  const good = r.totalPnl >= 0;
  return (
    <div
      onClick={() => onSelect(r)}
      style={{
        background: selected ? fa(B) : T.card,
        border: `1px solid ${selected ? B : T.border}`,
        borderRadius: 8, padding: '10px 13px',
        cursor: 'pointer', transition: 'all .15s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontWeight: 700, fontSize: 11 }}>{r.pair}</span>
        <span style={{ fontSize: 8, color: M }}>{fmtDate(r.createdAt)}</span>
      </div>
      <div style={{ display: 'flex', gap: 12, fontSize: 9 }}>
        <span style={{ color: good ? G : R, fontWeight: 700 }}>{money(r.totalPnl)}</span>
        <span style={{ color: M }}>{r.winRate}% WR</span>
        <span style={{ color: M }}>{r.totalSignals} trades</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export default function BacktestTab() {
  // Config
  const [pair,     setPair]     = useState('EUR/USD');
  const [bars,     setBars]     = useState(500);
  const [balance,  setBalance]  = useState(10000);
  const [minScore, setMinScore] = useState(7);

  // UI state
  const [running,  setRunning]  = useState(false);
  const [progress, setProgress] = useState('');
  const [result,   setResult]   = useState(null);
  const [history,  setHistory]  = useState([]);
  const [showHist, setShowHist] = useState(false);
  const [selHist,  setSelHist]  = useState(null);
  const [tradeTab, setTradeTab] = useState(false);

  const active = selHist ?? result;

  // Load history once
  const loadHistory = async () => {
    try {
      const r = await Backtest.history();
      setHistory(r.data || []);
    } catch { /* ignore */ }
  };

  const runBacktest = async () => {
    setRunning(true);
    setResult(null);
    setSelHist(null);
    setProgress('Fetching historical candles…');
    try {
      const r = await Backtest.run({ pair, barsBack: bars, startingBalance: balance, minScore });
      setResult(r.data);
      setProgress('');
      toast.success(`Backtest complete — ${r.data.totalSignals} signals found`);
      loadHistory();
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || 'Backtest failed';
      toast.error(msg);
      setProgress('');
    } finally {
      setRunning(false);
    }
  };

  const clearHistory = async () => {
    if (!confirm('Delete all backtest history?')) return;
    try {
      await Backtest.clear();
      setHistory([]);
      toast.success('History cleared');
    } catch { toast.error('Failed'); }
  };

  // Render
  return (
    <div>

      {/* ── Config panel ─────────────────────────────────────────────── */}
      <div style={{
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
        padding: '14px 16px', marginBottom: 14,
      }}>
        <div style={{ fontSize: 9, color: M, letterSpacing: '0.1em', marginBottom: 10 }}>BACKTEST CONFIGURATION</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>

          {/* Pair */}
          <div>
            <div style={{ fontSize: 7, color: M, marginBottom: 3, letterSpacing: '0.08em' }}>PAIR</div>
            <select value={pair} onChange={e => setPair(e.target.value)} style={{
              height: 30, padding: '0 10px', borderRadius: 5,
              background: T.dim, color: T.text, border: `1px solid ${T.border}`,
              fontFamily: 'inherit', fontSize: 10, cursor: 'pointer', minWidth: 110,
            }}>
              {ALL_PAIRS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Bars back */}
          <div>
            <div style={{ fontSize: 7, color: M, marginBottom: 3, letterSpacing: '0.08em' }}>HISTORY (1h bars)</div>
            <select value={bars} onChange={e => setBars(Number(e.target.value))} style={{
              height: 30, padding: '0 10px', borderRadius: 5,
              background: T.dim, color: T.text, border: `1px solid ${T.border}`,
              fontFamily: 'inherit', fontSize: 10, cursor: 'pointer',
            }}>
              <option value={200}>~8 days (200)</option>
              <option value={350}>~14 days (350)</option>
              <option value={500}>~20 days (500)</option>
              <option value={720}>~30 days (720)</option>
            </select>
          </div>

          {/* Starting balance */}
          <div>
            <div style={{ fontSize: 7, color: M, marginBottom: 3, letterSpacing: '0.08em' }}>STARTING BALANCE ($)</div>
            <input type="number" value={balance}
              onChange={e => setBalance(Number(e.target.value))}
              min={100} max={1000000} step={1000}
              style={{
                height: 30, width: 100, padding: '0 8px', borderRadius: 5,
                background: T.dim, color: T.text, border: `1px solid ${T.border}`,
                fontFamily: 'inherit', fontSize: 10,
              }}
            />
          </div>

          {/* Min score */}
          <div>
            <div style={{ fontSize: 7, color: M, marginBottom: 3, letterSpacing: '0.08em' }}>MIN SCORE</div>
            <input type="number" value={minScore}
              onChange={e => setMinScore(Number(e.target.value))}
              min={4} max={18} step={0.5}
              style={{
                height: 30, width: 70, padding: '0 8px', borderRadius: 5,
                background: T.dim, color: T.text, border: `1px solid ${T.border}`,
                fontFamily: 'inherit', fontSize: 10,
              }}
            />
          </div>

          {/* Run button */}
          <button
            onClick={runBacktest}
            disabled={running}
            style={{
              height: 30, padding: '0 20px', borderRadius: 5,
              background: running ? T.dim : fa(G) + '66',
              color: running ? M : G,
              border: `1px solid ${running ? T.border : G + '55'}`,
              fontFamily: 'inherit', fontSize: 10, fontWeight: 700,
              cursor: running ? 'not-allowed' : 'pointer', letterSpacing: '0.05em',
            }}
          >
            {running ? '⟳ Running…' : '▶ Run Backtest'}
          </button>

          {/* History toggle */}
          <button onClick={() => { setShowHist(s => !s); if (!showHist) loadHistory(); }}
            style={{
              height: 30, padding: '0 14px', borderRadius: 5,
              background: 'transparent', color: B,
              border: `1px solid ${B}44`,
              fontFamily: 'inherit', fontSize: 9, cursor: 'pointer',
            }}
          >
            {showHist ? '✕ History' : '⏷ History'}
          </button>
        </div>

        {running && progress && (
          <div style={{ marginTop: 10, fontSize: 8, color: B }}>⟳ {progress}</div>
        )}
        <div style={{ marginTop: 8, fontSize: 8, color: M }}>
          Walk-forward simulation · same SMC engine as live scanner · Kelly sizing · no look-ahead bias
        </div>
      </div>

      {/* ── History panel ────────────────────────────────────────────── */}
      {showHist && history.length > 0 && (
        <div style={{
          background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
          padding: '14px 16px', marginBottom: 14,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: M, letterSpacing: '0.1em' }}>SAVED RESULTS ({history.length})</div>
            <button onClick={clearHistory} style={{
              fontSize: 8, color: R, background: 'transparent',
              border: `1px solid ${R}44`, borderRadius: 4,
              padding: '3px 9px', cursor: 'pointer', fontFamily: 'inherit',
            }}>Clear all</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
            {history.map(r => (
              <ResultCard key={r.id} r={r} selected={selHist?.id === r.id}
                onSelect={r => { setSelHist(r); setResult(null); setTradeTab(false); }} />
            ))}
          </div>
        </div>
      )}

      {/* ── Result display ───────────────────────────────────────────── */}
      {active && (
        <div>

          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 12,
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                <span style={{ color: active.totalPnl >= 0 ? G : R }}>{active.pair}</span>
                <span style={{ color: M, fontSize: 9, marginLeft: 8 }}>
                  {active.range} · {active.interval} · min score {minScore}
                </span>
              </div>
              <div style={{ fontSize: 8, color: M, marginTop: 2 }}>
                Starting ${active.startingBalance?.toLocaleString()} · {active.totalSignals} signals detected
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setTradeTab(false)}
                style={{
                  padding: '4px 12px', borderRadius: 4, fontSize: 8, cursor: 'pointer',
                  fontFamily: 'inherit', fontWeight: 700,
                  background: !tradeTab ? fa(B) : 'transparent',
                  color: !tradeTab ? B : M,
                  border: `1px solid ${!tradeTab ? B + '55' : T.border}`,
                }}>Overview</button>
              <button onClick={() => setTradeTab(true)}
                style={{
                  padding: '4px 12px', borderRadius: 4, fontSize: 8, cursor: 'pointer',
                  fontFamily: 'inherit', fontWeight: 700,
                  background: tradeTab ? fa(B) : 'transparent',
                  color: tradeTab ? B : M,
                  border: `1px solid ${tradeTab ? B + '55' : T.border}`,
                }}>Trades ({active.totalSignals})</button>
            </div>
          </div>

          {!tradeTab ? (
            <>
              {/* Stats row */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                <Stat label="FINAL BALANCE"
                  value={`$${active.finalBalance?.toLocaleString()}`}
                  color={active.finalBalance >= active.startingBalance ? G : R}
                  sub={`${pct((active.finalBalance - active.startingBalance) / active.startingBalance * 100)} return`}
                />
                <Stat label="TOTAL P&L"
                  value={money(active.totalPnl)}
                  color={active.totalPnl >= 0 ? G : R}
                />
                <Stat label="WIN RATE"
                  value={`${active.winRate}%`}
                  color={active.winRate >= 50 ? G : R}
                  sub={`${active.wins}W ${active.losses}L ${active.partials}P`}
                />
                <Stat label="MAX DRAWDOWN"
                  value={`${active.maxDrawdown}%`}
                  color={active.maxDrawdown > 20 ? R : active.maxDrawdown > 10 ? Y : G}
                />
                <Stat label="PROFIT FACTOR"
                  value={active.profitFactor >= 999 ? '∞' : active.profitFactor?.toFixed(2)}
                  color={active.profitFactor >= 1.5 ? G : active.profitFactor >= 1 ? Y : R}
                />
                <Stat label="SHARPE"
                  value={active.sharpeRatio?.toFixed(2)}
                  color={active.sharpeRatio >= 1 ? G : active.sharpeRatio >= 0 ? Y : R}
                />
                <Stat label="AVG SCORE"  value={active.avgScore?.toFixed(1)} color={B} />
                <Stat label="AVG RR"     value={active.avgRR?.toFixed(2) + 'R'} color={B} />
              </div>

              {/* Equity curve */}
              <div style={{
                background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
                padding: '14px 16px', marginBottom: 14,
              }}>
                <div style={{ fontSize: 8, color: M, letterSpacing: '0.08em', marginBottom: 10 }}>EQUITY CURVE</div>
                <EquityChart curve={active.equityCurve} starting={active.startingBalance} />
                {active.equityCurve && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, color: M, marginTop: 4 }}>
                    <span>Start: ${active.startingBalance?.toLocaleString()}</span>
                    <span style={{ color: active.finalBalance >= active.startingBalance ? G : R }}>
                      End: ${active.finalBalance?.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Score calibration */}
              {(active.scoreWins || active.scoreLosses) && (
                <div style={{
                  background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
                  padding: '14px 16px',
                }}>
                  <CalibrationChart wins={active.scoreWins} losses={active.scoreLosses} />
                  <div style={{ fontSize: 8, color: M, marginTop: 8 }}>
                    Higher score bands should have higher win rates — use this to tune your min score threshold
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Trade table */
            <div style={{
              background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
              padding: '14px 16px',
            }}>
              {active.trades?.length > 0
                ? <TradeTable trades={active.trades} />
                : <div style={{ textAlign: 'center', padding: 40, color: M }}>No trades in this backtest</div>
              }
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!active && !running && (
        <div style={{ textAlign: 'center', padding: 60, color: M }}>
          <div style={{ fontSize: 20, marginBottom: 10 }}>📊</div>
          <div style={{ fontSize: 11, marginBottom: 6 }}>Configure and run a backtest above</div>
          <div style={{ fontSize: 9 }}>
            The same SMC analysis engine used for live signals runs on historical data<br />
            in walk-forward mode — no look-ahead bias
          </div>
        </div>
      )}
    </div>
  );
}
