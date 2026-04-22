import { useState, useMemo, useCallback } from 'react';
import useStore from '../store/useStore';
import { Pill, ScoreRing } from '../components/Atoms';
import { T, fa, md, gc, fmtDate, fmtTime } from '../utils/format';
import { Journal } from '../api/endpoints';
import toast from 'react-hot-toast';

const PER_PAGE = 50;

const OUTCOME_COL = { win: T.accent, partial: T.yellow, loss: T.red };
const DIR_COL     = { BUY: T.accent, SELL: T.red };

// Score breakdown label / colour maps — must match ScoringService.java bd.put() keys exactly
const BD_LABELS = {
  bos: 'BoS', choch: 'CHoCH', fvg: 'FVG', ob: 'OB', mtf: 'MTF',
  liqSweep: 'Sweep', session: 'Session', news: 'News', momentum: 'Mom',
  idm: 'IDM', breaker: 'Breaker', ote: 'OTE', zoneAge: 'Age',
  obSes: 'OB Ses', closeConf: 'Close', pd: 'P/D', volume: 'Volume',
};
const BD_COLORS = {
  bos: T.blue, choch: T.violet, fvg: T.teal, ob: T.accent, mtf: T.yellow,
  liqSweep: T.pink, session: T.lime, news: T.amber, momentum: T.orange,
  idm: T.pink, breaker: T.violet, ote: T.violet, zoneAge: T.teal,
  obSes: T.lime, closeConf: T.teal, pd: T.blue, volume: T.orange,
};

function fmtPrice(v, pair) {
  if (v == null || isNaN(v)) return '–';
  const dp = (pair?.includes('JPY') || pair === 'XAU/USD' || pair === 'NAS100') ? 2 : 4;
  return Number(v).toFixed(dp);
}

function validateSLTP(trade) {
  const { entry, sl, tp1, isBull } = trade;
  if (entry == null || sl == null || tp1 == null) return null;
  if (isBull) {
    if (sl >= entry)  return 'SL above entry';
    if (tp1 <= entry) return 'TP below entry';
  } else {
    if (sl <= entry)  return 'SL below entry';
    if (tp1 >= entry) return 'TP above entry';
  }
  return null;
}

function fromDateInput(s, endOfDay = false) {
  if (!s) return null;
  const d = new Date(s);
  if (endOfDay) d.setHours(23, 59, 59, 999);
  return d;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function SortTH({ col, label, sortCol, sortDir, onSort }) {
  const active = sortCol === col;
  return (
    <th onClick={() => onSort(col)} style={{
      padding: '7px 10px', textAlign: 'left', fontSize: 7,
      color: active ? T.accent : T.muted,
      whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none',
      letterSpacing: '0.08em',
    }}>
      {label}
      {active && <span style={{ marginLeft: 3, opacity: 0.7 }}>{sortDir === 1 ? '↑' : '↓'}</span>}
    </th>
  );
}

function StatCard({ label, value, color = T.text, sub }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 8, padding: '9px 12px', minWidth: 90,
    }}>
      <div style={{ fontSize: 7, color: T.muted, letterSpacing: '0.1em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 7, color: T.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ fontSize: 7, color: T.muted, letterSpacing: '0.08em' }}>{label}</div>
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        height: 28, padding: '0 8px', borderRadius: 5,
        background: T.dim, color: T.text, border: `1px solid ${T.border}`,
        fontFamily: 'inherit', fontSize: 9, cursor: 'pointer',
      }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function DateInput({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 140 }}>
      <div style={{ fontSize: 7, color: T.muted, letterSpacing: '0.08em' }}>{label}</div>
      <input type="date" value={value} onChange={e => onChange(e.target.value)} style={{
        height: 28, padding: '0 8px', borderRadius: 5,
        background: '#111', color: '#fff', border: '1px solid #444',
        fontFamily: 'inherit', fontSize: 9, cursor: 'pointer',
        outline: 'none', colorScheme: 'dark', width: '100%',
      }} />
    </div>
  );
}

// ── Inline strategy breakdown (shown when a row is expanded) ───────────────
function StrategyBreakdown({ trade }) {
  const regColor = trade.regime === 'trending' ? T.accent
                 : trade.regime === 'volatile' ? T.red : T.yellow;

  return (
    <div style={{
      padding: '12px 16px 14px',
      background: T.dim,
      borderTop: `1px solid ${T.border}`,
    }}>
      {/* Strategy label — the full sentence */}
      {trade.strategyLabel && (
        <div style={{
          fontSize: 10, fontWeight: 700, color: T.text,
          marginBottom: 10, lineHeight: 1.5,
          padding: '6px 10px',
          background: T.card,
          borderRadius: 6,
          borderLeft: `3px solid ${trade.isBull ? T.accent : T.red}`,
        }}>
          {trade.strategyLabel}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {/* Left — condition badges */}
        <div>
          <div style={{ fontSize: 7, color: T.muted, letterSpacing: '0.1em', marginBottom: 6 }}>
            CONDITIONS
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
            {trade.hasOB      && <Pill label="OB"         color={T.accent}  />}
            {trade.hasFVG     && <Pill label="FVG"         color={T.blue}    />}
            {trade.isBreaker  && <Pill label="BREAKER"     color={T.violet}  />}
            {trade.choch      && <Pill label="CHoCH"       color={T.violet}  />}
            {trade.sweep      && <Pill label="★ Sweep"     color={T.pink}    />}
            {trade.strongMom  && <Pill label="Inst. candle" color={T.amber}  />}
            {trade.idmConfirmed && <Pill label="IDM ✓"    color={T.pink}    />}
            {!trade.idmConfirmed && (trade.hasOB || trade.isBreaker) &&
              <Pill label="IDM ✗" color={T.red} />}
            {trade.inOTE      && (
              <Pill label={`OTE ${((trade.oteFibPct || 0) * 100).toFixed(0)}%`} color={T.violet} />
            )}
            {trade.candleClose && <Pill label="Close ✓"   color={T.teal}    />}
            {trade.volumeQuiet && <Pill label="⚠ Low vol"  color={T.orange}  />}
            {trade.slMethod === 'smart' && <Pill label="Smart SL" color={T.teal} />}
          </div>

          {/* Context grid */}
          <div style={{ fontSize: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px' }}>
            {[
              ['LTF bias',   trade.ltfDir,       trade.ltfDir === 'bull' ? T.accent : trade.ltfDir === 'bear' ? T.red : T.muted],
              ['HTF bias',   trade.htfDir,       trade.htfDir === 'bull' ? T.accent : trade.htfDir === 'bear' ? T.red : T.muted],
              ['P/D zone',   trade.pdZone,       trade.pdZone === 'discount' ? T.accent : trade.pdZone === 'premium' ? T.red : T.muted],
              ['Session',    trade.session,      T.lime],
              ['Zone age',   trade.zoneAgeLabel, T.teal],
              ['SL method',  trade.slMethod,     T.blue],
              ['Regime',     trade.regime,       regColor],
              ['TP2 target', trade.htfLiqLabel,  T.blue],
            ].filter(([, v]) => v && v !== '–').map(([label, value, color]) => (
              <div key={label} style={{ display: 'flex', gap: 6 }}>
                <span style={{ color: T.muted }}>{label}:</span>
                <span style={{ color, fontWeight: 600 }}>{value}</span>
              </div>
            ))}
            {trade.curATR > 0 && (
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{ color: T.muted }}>ATR:</span>
                <span style={{ color: T.muted }}>{trade.curATR.toFixed(5)}</span>
              </div>
            )}
            {trade.slLiqLevel != null && (
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{ color: T.muted }}>SL liq:</span>
                <span style={{ color: T.blue }}>{fmtPrice(trade.slLiqLevel, trade.pair)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right — score breakdown bars */}
        <div>
          <div style={{ fontSize: 7, color: T.muted, letterSpacing: '0.1em', marginBottom: 6 }}>
            SCORE BREAKDOWN
          </div>
          {trade.breakdown ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px' }}>
              {Object.entries(trade.breakdown)
                .filter(([, v]) => v !== 0)
                .map(([k, v]) => {
                  const pos = v > 0, col = pos ? (BD_COLORS[k] || T.accent) : T.red;
                  return (
                    <div key={k} style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: 8, borderRadius: 3, padding: '2px 5px',
                      background: pos ? fa(col) : fa(T.red),
                    }}>
                      <span style={{ color: T.muted }}>{BD_LABELS[k] || k}</span>
                      <span style={{ color: col, fontWeight: 700 }}>{v > 0 ? `+${v}` : v}</span>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div style={{ fontSize: 8, color: T.muted, fontStyle: 'italic' }}>
              Breakdown not stored — pre-dates this feature.
              <br />Signal's breakdown is visible in the Scanner tab while LIVE.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Strategy summary pills (shown inline in the collapsed row) ─────────────
function StrategyPills({ trade }) {
  // If we have the label, show first segment + key conditions
  if (trade.strategyLabel) {
    // Show up to first 60 chars of the label
    const preview = trade.strategyLabel.length > 58
      ? trade.strategyLabel.slice(0, 58) + '…'
      : trade.strategyLabel;
    return (
      <span style={{ fontSize: 8, color: T.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200, display: 'block' }}>
        {preview}
      </span>
    );
  }
  // Fallback for old trades without strategyLabel — reconstruct from booleans
  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
      {trade.isBreaker && <Pill label="BREAKER" color={T.violet} sz={7} />}
      {trade.hasOB     && !trade.isBreaker && <Pill label="OB" color={T.accent} sz={7} />}
      {trade.hasFVG    && <Pill label="FVG"     color={T.blue}   sz={7} />}
      {trade.choch     && <Pill label="CHoCH"   color={T.violet} sz={7} />}
      {trade.sweep     && <Pill label="Sweep"   color={T.pink}   sz={7} />}
      {trade.inOTE     && <Pill label="OTE"     color={T.violet} sz={7} />}
    </div>
  );
}

// ── Determine setup type for filtering ────────────────────────────────────
function getSetupType(trade) {
  if (trade.isBreaker)            return 'breaker';
  if (trade.hasOB && trade.hasFVG) return 'ob+fvg';
  if (trade.hasOB)                return 'ob';
  if (trade.hasFVG)               return 'fvg';
  return 'other';
}

// ── Main component ─────────────────────────────────────────────────────────
export default function JournalTab() {
  const { journal, setJournal } = useStore();

  // filter state
  const [fromStr,   setFromStr]   = useState('');
  const [toStr,     setToStr]     = useState('');
  const [dirF,      setDirF]      = useState('');
  const [outF,      setOutF]      = useState('');
  const [pairF,     setPairF]     = useState('');
  const [gradeF,    setGradeF]    = useState('');
  const [validF,    setValidF]    = useState('');
  const [setupF,    setSetupF]    = useState('');   // NEW: setup type filter
  const [sessionF,  setSessionF]  = useState('');   // NEW: session filter
  const [regimeF,   setRegimeF]   = useState('');   // NEW: regime filter

  // expanded row tracking
  const [expandedId, setExpandedId] = useState(null);

  // sort / page
  const [sortCol, setSortCol] = useState('date');
  const [sortDir, setSortDir] = useState(-1);
  const [page, setPage] = useState(1);

  const pairs   = useMemo(() => [...new Set(journal.map(j => j.pair))].sort(), [journal]);
  const grades  = useMemo(() => [...new Set(journal.map(j => j.grade).filter(Boolean))].sort(), [journal]);
  const sessions = useMemo(() => [...new Set(journal.map(j => j.session).filter(Boolean))].sort(), [journal]);

  const fromDate = useMemo(() => fromDateInput(fromStr, false), [fromStr]);
  const toDate   = useMemo(() => fromDateInput(toStr, true),    [toStr]);

  const filtered = useMemo(() => {
    let rows = journal.map(j => ({
      ...j,
      _invalid:   validateSLTP(j),
      _setupType: getSetupType(j),
    }));

    if (fromDate)  rows = rows.filter(j => new Date(j.createdAt) >= fromDate);
    if (toDate)    rows = rows.filter(j => new Date(j.createdAt) <= toDate);
    if (dirF)      rows = rows.filter(j => (j.isBull ? 'BUY' : 'SELL') === dirF);
    if (outF)      rows = rows.filter(j => j.outcome === outF);
    if (pairF)     rows = rows.filter(j => j.pair === pairF);
    if (gradeF)    rows = rows.filter(j => j.grade === gradeF);
    if (setupF)    rows = rows.filter(j => j._setupType === setupF);
    if (sessionF)  rows = rows.filter(j => j.session === sessionF);
    if (regimeF)   rows = rows.filter(j => j.regime === regimeF);
    if (validF === 'invalid') rows = rows.filter(j => j._invalid);
    if (validF === 'valid')   rows = rows.filter(j => !j._invalid);

    rows.sort((a, b) => {
      let av, bv;
      switch (sortCol) {
        case 'date':    av = new Date(a.createdAt).getTime(); bv = new Date(b.createdAt).getTime(); break;
        case 'pair':    av = a.pair;      bv = b.pair;      break;
        case 'score':   av = a.score;     bv = b.score;     break;
        case 'pnl':     av = a.pnl ?? 0;  bv = b.pnl ?? 0;  break;
        case 'outcome': av = a.outcome;   bv = b.outcome;   break;
        case 'entry':   av = a.entry;     bv = b.entry;     break;
        default: return 0;
      }
      if (typeof av === 'string') return sortDir * av.localeCompare(bv);
      return sortDir * (av - bv);
    });
    return rows;
  }, [journal, fromDate, toDate, dirF, outF, pairF, gradeF, validF, setupF, sessionF, regimeF, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const pageRows   = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  // stats
  const stats = useMemo(() => {
    const wins    = filtered.filter(j => j.outcome === 'win').length;
    const losses  = filtered.filter(j => j.outcome === 'loss').length;
    const partial = filtered.filter(j => j.outcome === 'partial').length;
    const closed  = wins + losses;
    const wr      = closed ? (wins / closed * 100).toFixed(1) : '–';
    const totalPnl = filtered.reduce((s, j) => s + (j.pnl ?? 0), 0);
    const avgScore = filtered.length
      ? (filtered.reduce((s, j) => s + (j.score ?? 0), 0) / filtered.length).toFixed(1) : '–';
    const invalid  = filtered.filter(j => j._invalid).length;
    return { wins, losses, partial, wr, totalPnl, avgScore, invalid, total: filtered.length };
  }, [filtered]);

  // setup-type win-rate breakdown (only for closed trades)
  const setupStats = useMemo(() => {
    const closed = filtered.filter(j => j.outcome && j.outcome !== 'timeout');
    const types = ['breaker', 'ob+fvg', 'ob', 'fvg', 'other'];
    return types.map(type => {
      const rows = closed.filter(j => j._setupType === type);
      const w = rows.filter(j => j.outcome === 'win').length;
      const l = rows.filter(j => j.outcome === 'loss').length;
      const wr = (w + l) > 0 ? (w / (w + l) * 100).toFixed(0) : null;
      const pnl = rows.reduce((s, j) => s + (j.pnl ?? 0), 0);
      return { type, count: rows.length, wins: w, losses: l, wr, pnl };
    }).filter(s => s.count > 0);
  }, [filtered]);

  const handleSort = useCallback(col => {
    setSortCol(prev => {
      if (prev === col) setSortDir(d => d * -1);
      else setSortDir(-1);
      return col;
    });
    setPage(1);
  }, []);

  const resetFilters = () => {
    setFromStr(''); setToStr('');
    setDirF(''); setOutF(''); setPairF(''); setGradeF('');
    setValidF(''); setSetupF(''); setSessionF(''); setRegimeF('');
    setPage(1);
  };

  const handleClear = async () => {
    if (!confirm('Clear all journal entries?')) return;
    try {
      await Journal.clear();
      setJournal([]);
      toast.success('Journal cleared');
    } catch { toast.error('Failed to clear journal'); }
  };

  const exportCSV = () => {
    if (!filtered.length) return;
    const header = [
      'DATE','PAIR','DIR','ENTRY','SL','TP1','TP2','SCORE','GRADE',
      'SESSION','REGIME','OUTCOME','P&L','KELLY%','CLOSE TYPE',
      'STRATEGY','SETUP','OB','FVG','BREAKER','CHOCH','SWEEP','OTE','OTE_PCT',
      'IDM','CANDLE_CLOSE','LOW_VOL','LTF','HTF','PD','ZONE_AGE','SL_METHOD','VALID',
    ].join(',');
    const rows = filtered.map(j => [
      fmtDate(j.createdAt),
      j.pair,
      j.isBull ? 'BUY' : 'SELL',
      fmtPrice(j.entry, j.pair),
      fmtPrice(j.sl,    j.pair),
      fmtPrice(j.tp1,   j.pair),
      fmtPrice(j.tp2,   j.pair),
      j.score ?? '',
      j.grade ?? '',
      j.session ?? '',
      j.regime ?? '',
      j.outcome ?? '',
      j.pnl != null ? j.pnl.toFixed(2) : '',
      j.kellyPct != null ? j.kellyPct : '',
      j.autoClose ? 'AUTO' : 'Manual',
      `"${(j.strategyLabel || '').replace(/"/g, "'")}"`,
      j._setupType ?? '',
      j.hasOB   ? 1 : 0,
      j.hasFVG  ? 1 : 0,
      j.isBreaker ? 1 : 0,
      j.choch   ? 1 : 0,
      j.sweep   ? 1 : 0,
      j.inOTE   ? 1 : 0,
      j.inOTE ? ((j.oteFibPct || 0) * 100).toFixed(0) + '%' : '',
      j.idmConfirmed ? 1 : 0,
      j.candleClose  ? 1 : 0,
      j.volumeQuiet  ? 1 : 0,
      j.ltfDir  ?? '',
      j.htfDir  ?? '',
      j.pdZone  ?? '',
      j.zoneAgeLabel ?? '',
      j.slMethod ?? '',
      j._invalid ? j._invalid : 'OK',
    ].join(','));
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `smc_journal_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasFilters = fromStr || toStr || dirF || outF || pairF || gradeF || validF || setupF || sessionF || regimeF;

  const SETUP_LABELS = { breaker: 'Breaker', 'ob+fvg': 'OB+FVG', ob: 'OB', fvg: 'FVG', other: 'Other' };
  const SETUP_COLORS = { breaker: T.violet, 'ob+fvg': T.teal, ob: T.accent, fvg: T.blue, other: T.muted };

  return (
    <div>
      {/* ── Stats bar ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <StatCard label="TOTAL TRADES" value={stats.total} color={T.text} />
        <StatCard
          label="WIN RATE"
          value={stats.wr === '–' ? '–' : `${stats.wr}%`}
          color={stats.wr !== '–' ? (+stats.wr >= 50 ? T.accent : T.red) : T.muted}
          sub={`${stats.wins}W · ${stats.losses}L · ${stats.partial}P`}
        />
        <StatCard
          label="TOTAL P&L"
          value={stats.totalPnl >= 0 ? `+$${stats.totalPnl.toFixed(2)}` : `-$${Math.abs(stats.totalPnl).toFixed(2)}`}
          color={stats.totalPnl > 0 ? T.accent : stats.totalPnl < 0 ? T.red : T.muted}
        />
        <StatCard label="AVG SCORE"    value={stats.avgScore}  color={T.blue} />
        <StatCard
          label="INVALID SL/TP"
          value={stats.invalid}
          color={stats.invalid > 0 ? T.red : T.accent}
          sub={stats.invalid > 0 ? 'click Valid filter ↓' : 'all clean'}
        />
      </div>

      {/* ── Setup-type win-rate summary ─────────────────────────────────── */}
      {setupStats.length > 0 && (
        <div style={{
          background: T.card, border: `1px solid ${T.border}`,
          borderRadius: 10, padding: '12px 16px', marginBottom: 14,
        }}>
          <div style={{ fontSize: 9, color: T.muted, letterSpacing: '0.1em', marginBottom: 10, fontWeight: 700 }}>
            SETUP TYPE PERFORMANCE
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {setupStats.map(({ type, count, wr, pnl, wins, losses }) => {
              const col = SETUP_COLORS[type];
              const wrNum = wr != null ? +wr : null;
              const wrCol = wrNum == null ? T.muted : wrNum >= 55 ? T.accent : wrNum >= 45 ? T.yellow : T.red;
              return (
                <div
                  key={type}
                  onClick={() => { setSetupF(setupF === type ? '' : type); setPage(1); }}
                  style={{
                    background: setupF === type ? fa(col) : T.dim,
                    border: `1px solid ${setupF === type ? col : T.border}`,
                    borderRadius: 8, padding: '8px 12px', cursor: 'pointer',
                    minWidth: 90, transition: 'all .15s',
                  }}
                >
                  <div style={{ fontSize: 9, fontWeight: 700, color: col, marginBottom: 4 }}>
                    {SETUP_LABELS[type]}
                  </div>
                  <div style={{ fontSize: 8, color: T.muted, marginBottom: 2 }}>
                    {count} trades
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: wrCol }}>
                    {wr != null ? `${wr}% WR` : '–'}
                  </div>
                  <div style={{ fontSize: 8, color: pnl >= 0 ? T.accent : T.red }}>
                    {pnl >= 0 ? '+' : ''}${pnl.toFixed(0)}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 7, color: T.muted, marginTop: 8 }}>
            Click a card to filter the table to that setup type.
          </div>
        </div>
      )}

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 12 }}>
        <DateInput label="FROM" value={fromStr} onChange={v => { setFromStr(v); setPage(1); }} />
        <DateInput label="TO"   value={toStr}   onChange={v => { setToStr(v);   setPage(1); }} />

        <FilterSelect label="DIRECTION" value={dirF} onChange={v => { setDirF(v); setPage(1); }}
          options={[{value:'',label:'All dirs'},{value:'BUY',label:'BUY'},{value:'SELL',label:'SELL'}]} />

        <FilterSelect label="OUTCOME" value={outF} onChange={v => { setOutF(v); setPage(1); }}
          options={[{value:'',label:'All outcomes'},{value:'win',label:'Win'},{value:'loss',label:'Loss'},{value:'partial',label:'Partial'}]} />

        <FilterSelect label="PAIR" value={pairF} onChange={v => { setPairF(v); setPage(1); }}
          options={[{value:'',label:'All pairs'}, ...pairs.map(p => ({value:p,label:p}))]} />

        <FilterSelect label="GRADE" value={gradeF} onChange={v => { setGradeF(v); setPage(1); }}
          options={[{value:'',label:'All grades'}, ...grades.map(g => ({value:g,label:g}))]} />

        <FilterSelect label="SETUP" value={setupF} onChange={v => { setSetupF(v); setPage(1); }}
          options={[
            {value:'',label:'All setups'},
            {value:'breaker',label:'Breaker'},
            {value:'ob+fvg', label:'OB+FVG'},
            {value:'ob',     label:'OB only'},
            {value:'fvg',    label:'FVG only'},
          ]} />

        <FilterSelect label="SESSION" value={sessionF} onChange={v => { setSessionF(v); setPage(1); }}
          options={[{value:'',label:'All sessions'}, ...sessions.map(s => ({value:s,label:s}))]} />

        <FilterSelect label="REGIME" value={regimeF} onChange={v => { setRegimeF(v); setPage(1); }}
          options={[
            {value:'',         label:'All regimes'},
            {value:'trending', label:'Trending'},
            {value:'ranging',  label:'Ranging'},
            {value:'volatile', label:'Volatile'},
          ]} />

        <FilterSelect label="VALID" value={validF} onChange={v => { setValidF(v); setPage(1); }}
          options={[{value:'',label:'All'},{value:'valid',label:'✓ Valid'},{value:'invalid',label:'✗ Invalid'}]} />

        {hasFilters && (
          <button onClick={resetFilters} style={{
            alignSelf: 'flex-end', height: 28, padding: '0 10px', borderRadius: 5,
            background: 'transparent', color: T.muted, border: `1px solid ${T.border}`,
            fontFamily: 'inherit', fontSize: 9, cursor: 'pointer',
          }}>Reset</button>
        )}

        <div style={{ flex: 1 }} />

        <button onClick={exportCSV} disabled={!filtered.length} style={{
          alignSelf: 'flex-end', height: 28, padding: '0 12px', borderRadius: 5,
          background: 'transparent', color: T.blue, border: `1px solid ${T.blue}55`,
          fontFamily: 'inherit', fontSize: 9, cursor: 'pointer', fontWeight: 700,
          opacity: filtered.length ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <span>↓</span> Export CSV ({filtered.length})
        </button>

        <button onClick={handleClear} style={{
          alignSelf: 'flex-end', height: 28, padding: '0 10px', borderRadius: 5,
          background: 'transparent', color: T.red, border: `1px solid ${T.red}44`,
          fontFamily: 'inherit', fontSize: 9, cursor: 'pointer',
        }}>Clear All</button>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: T.muted, fontSize: 11 }}>
          {journal.length === 0 ? 'No trades logged yet.' : 'No trades match the current filters.'}
        </div>
      ) : (
        <>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
                <thead style={{ background: T.dim }}>
                  <tr>
                    {/* Expand toggle column */}
                    <th style={{ width: 28, padding: '7px 6px' }} />
                    <SortTH col="date"    label="DATE"     {...{sortCol, sortDir, onSort: handleSort}} />
                    <SortTH col="pair"    label="PAIR"     {...{sortCol, sortDir, onSort: handleSort}} />
                    <th style={{ padding: '7px 10px', fontSize: 7, color: T.muted }}>DIR</th>
                    <SortTH col="entry"   label="ENTRY"    {...{sortCol, sortDir, onSort: handleSort}} />
                    <th style={{ padding: '7px 10px', fontSize: 7, color: T.muted }}>SL</th>
                    <th style={{ padding: '7px 10px', fontSize: 7, color: T.muted }}>TP1</th>
                    <th style={{ padding: '7px 10px', fontSize: 7, color: T.muted }}>TP2</th>
                    <SortTH col="score"   label="SCORE"    {...{sortCol, sortDir, onSort: handleSort}} />
                    <th style={{ padding: '7px 10px', fontSize: 7, color: T.muted }}>GRADE</th>
                    <th style={{ padding: '7px 10px', fontSize: 7, color: T.accent, minWidth: 160 }}>STRATEGY</th>
                    <SortTH col="outcome" label="OUTCOME"  {...{sortCol, sortDir, onSort: handleSort}} />
                    <SortTH col="pnl"     label="P&L"      {...{sortCol, sortDir, onSort: handleSort}} />
                    <th style={{ padding: '7px 10px', fontSize: 7, color: T.muted }}>KELLY%</th>
                    <th style={{ padding: '7px 10px', fontSize: 7, color: T.muted }}>CLOSE</th>
                    <th style={{ padding: '7px 10px', fontSize: 7, color: T.muted }}>VALID</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((j, k) => {
                    const dir       = j.isBull ? 'BUY' : 'SELL';
                    const pnlColor  = (j.pnl ?? 0) > 0 ? T.accent : (j.pnl ?? 0) < 0 ? T.red : T.muted;
                    const invalid   = j._invalid;
                    const isExpanded = expandedId === (j.id ?? k);
                    const hasStrategy = j.strategyLabel || j.breakdown || j.hasOB || j.hasFVG || j.isBreaker;
                    const setupColor = SETUP_COLORS[j._setupType] || T.muted;

                    return (
                      <>
                        <tr
                          key={j.id ?? k}
                          style={{
                            borderBottom: invalid ? `1px solid ${T.red}18` : `1px solid ${T.border}10`,
                            background: isExpanded ? T.dim : invalid ? `${T.red}06` : 'transparent',
                            cursor: hasStrategy ? 'pointer' : 'default',
                          }}
                          onClick={() => hasStrategy && setExpandedId(isExpanded ? null : (j.id ?? k))}
                        >
                          {/* Expand toggle */}
                          <td style={{ padding: '6px 6px', textAlign: 'center' }}>
                            {hasStrategy && (
                              <span style={{
                                fontSize: 8, color: isExpanded ? T.accent : T.muted,
                                userSelect: 'none',
                              }}>
                                {isExpanded ? '▲' : '▼'}
                              </span>
                            )}
                          </td>

                          {/* Date */}
                          <td style={{ padding: '7px 10px', color: T.muted, fontSize: 8, whiteSpace: 'nowrap' }}>
                            {fmtDate(j.createdAt)}<br />
                            <span style={{ fontSize: 7, opacity: 0.6 }}>{fmtTime(j.createdAt)}</span>
                          </td>

                          {/* Pair */}
                          <td style={{ padding: '7px 10px', fontWeight: 700, color: T.text }}>{j.pair}</td>

                          {/* Dir */}
                          <td style={{ padding: '7px 10px', color: DIR_COL[dir], fontWeight: 700 }}>
                            {j.isBull ? '▲' : '▼'} {dir}
                          </td>

                          {/* Prices */}
                          <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 8 }}>
                            {fmtPrice(j.entry, j.pair)}
                          </td>
                          <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 8, color: invalid ? T.red : T.muted }}>
                            {fmtPrice(j.sl, j.pair)}
                          </td>
                          <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 8, color: T.muted }}>
                            {fmtPrice(j.tp1, j.pair)}
                          </td>
                          <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 8, color: T.muted }}>
                            {fmtPrice(j.tp2, j.pair)}
                          </td>

                          {/* Score bar */}
                          <td style={{ padding: '7px 10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <div style={{ width: `${(j.score / 20) * 36}px`, height: 3, background: gc(j.grade), borderRadius: 2 }} />
                              <span style={{ fontSize: 8, color: gc(j.grade) }}>{j.score?.toFixed(1)}</span>
                            </div>
                          </td>

                          {/* Grade */}
                          <td style={{ padding: '7px 10px' }}>
                            <Pill label={j.grade} color={gc(j.grade)} sz={8} />
                          </td>

                          {/* STRATEGY column — setup pill + label preview */}
                          <td style={{ padding: '7px 10px', maxWidth: 200 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {/* Setup type pill */}
                              <span style={{
                                fontSize: 7, padding: '1px 5px', borderRadius: 3,
                                background: fa(setupColor), color: setupColor,
                                border: `1px solid ${setupColor}44`,
                                fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
                              }}>
                                {SETUP_LABELS[j._setupType] || '–'}
                              </span>
                              {/* Label / pills */}
                              <StrategyPills trade={j} />
                            </div>
                          </td>

                          {/* Outcome */}
                          <td style={{ padding: '7px 10px', color: OUTCOME_COL[j.outcome] ?? T.muted, fontWeight: 700 }}>
                            {j.outcome?.toUpperCase() ?? '–'}
                          </td>

                          {/* PnL */}
                          <td style={{ padding: '7px 10px', color: pnlColor, fontWeight: 700 }}>
                            {j.pnl != null ? `${j.pnl >= 0 ? '+' : ''}$${j.pnl.toFixed ? j.pnl.toFixed(2) : j.pnl}` : '–'}
                          </td>

                          {/* Kelly */}
                          <td style={{ padding: '7px 10px', color: T.muted, fontSize: 8 }}>
                            {j.kellyPct != null ? `${j.kellyPct}%` : '–'}
                          </td>

                          {/* Close type */}
                          <td style={{ padding: '7px 10px' }}>
                            {j.autoClose
                              ? <span title={j.closeReason ?? ''} style={{ fontSize: 7, padding: '2px 6px', borderRadius: 3, background: fa(T.blue), color: T.blue, border: `1px solid ${T.blue}44`, fontWeight: 700, cursor: 'help' }}>AUTO</span>
                              : <span style={{ fontSize: 7, color: T.muted }}>Manual</span>}
                          </td>

                          {/* Valid */}
                          <td style={{ padding: '7px 10px' }}>
                            {invalid ? (
                              <span title={invalid} style={{ fontSize: 7, padding: '2px 6px', borderRadius: 3, background: fa(T.red), color: T.red, border: `1px solid ${T.red}44`, fontWeight: 700, cursor: 'help', whiteSpace: 'nowrap' }}>
                                ✗ {invalid}
                              </span>
                            ) : (
                              <span style={{ fontSize: 9, color: T.accent }}>✓</span>
                            )}
                          </td>
                        </tr>

                        {/* ── Expanded strategy breakdown ───────────────── */}
                        {isExpanded && (
                          <tr key={`${j.id ?? k}-strategy`}>
                            <td colSpan={16} style={{ padding: 0 }}>
                              <StrategyBreakdown trade={j} />
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, fontSize: 8, color: T.muted }}>
              <span>Showing {((safePage-1)*PER_PAGE)+1}–{Math.min(safePage*PER_PAGE, filtered.length)} of {filtered.length} trades</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setPage(p)} style={{
                    width: 24, height: 24, borderRadius: 4, border: `1px solid ${T.border}`,
                    background: p === safePage ? T.accent : 'transparent',
                    color: p === safePage ? T.bg : T.muted,
                    fontFamily: 'inherit', fontSize: 8, cursor: 'pointer', fontWeight: 700,
                  }}>{p}</button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
