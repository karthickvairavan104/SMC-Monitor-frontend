import { useState, useMemo, useCallback } from 'react';
import useStore from '../store/useStore';
import { Pill, ScoreRing } from '../components/Atoms';
import { T, fa, md, gc, fmtDate, fmtTime } from '../utils/format';
import { Journal } from '../api/endpoints';
import toast from 'react-hot-toast';

const PER_PAGE = 50;
const OUTCOME_COL = { win: T.accent, partial: T.yellow, loss: T.red };
const DIR_COL     = { BUY: T.accent, SELL: T.red };

// Score breakdown labels + colours — match ScoringService bd.put() keys exactly
const BD_LABELS = {
  bos:'BoS', choch:'CHoCH', fvg:'FVG', ob:'OB', mtf:'MTF',
  liqSweep:'Sweep', session:'Session', news:'News', momentum:'Mom',
  idm:'IDM', breaker:'Breaker', ote:'OTE', zoneAge:'Age',
  obSes:'OB Ses', closeConf:'Close', pd:'P/D', volume:'Volume',
};
const BD_COLORS = {
  bos:T.blue, choch:T.violet, fvg:T.teal, ob:T.accent, mtf:T.yellow,
  liqSweep:T.pink, session:T.lime, news:T.amber, momentum:T.orange,
  idm:T.pink, breaker:T.violet, ote:T.violet, zoneAge:T.teal,
  obSes:T.lime, closeConf:T.teal, pd:T.blue, volume:T.orange,
};

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtPrice(v, pair) {
  if (v == null || isNaN(v)) return '–';
  const dp = (pair?.includes('JPY') || pair === 'XAU/USD' || pair === 'NAS100'
            || pair?.endsWith('.NS') || pair?.endsWith('.BO')) ? 2 : 4;
  return Number(v).toFixed(dp);
}

// Format a timestamp as "Apr 19  09:32" (date omitted if today)
function fmtDateTime(ts) {
  if (!ts) return '–';
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.getFullYear() === now.getFullYear()
               && d.getMonth()    === now.getMonth()
               && d.getDate()     === now.getDate();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return time;
  const date = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `${date} ${time}`;
}

// "2h 34m" / "45m" / "3d 2h"
function fmtDuration(start, end) {
  if (!start || !end) return '–';
  const ms = new Date(end) - new Date(start);
  if (ms < 0) return '–';
  const mins  = Math.floor(ms / 60_000);
  const days  = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const m     = mins % 60;
  if (days  > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${m}m`;
  return `${m}m`;
}

function validateSLTP(t) {
  const { entry, sl, tp1, isBull } = t;
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

function fromDateInput(s, eod = false) {
  if (!s) return null;
  const d = new Date(s);
  if (eod) d.setHours(23, 59, 59, 999);
  return d;
}

function getSetupType(t) {
  if (t.isBreaker)             return 'breaker';
  if (t.hasOB && t.hasFVG)    return 'ob+fvg';
  if (t.hasOB)                 return 'ob';
  if (t.hasFVG)                return 'fvg';
  return 'other';
}

const SETUP_LABELS = { breaker:'Breaker', 'ob+fvg':'OB+FVG', ob:'OB', fvg:'FVG', other:'–' };
const SETUP_COLORS = { breaker:T.violet, 'ob+fvg':T.teal, ob:T.accent, fvg:T.blue, other:T.muted };

// ── Sub-components ─────────────────────────────────────────────────────────
function SortTH({ col, label, sortCol, sortDir, onSort }) {
  const active = sortCol === col;
  return (
    <th onClick={() => onSort(col)} style={{
      padding:'7px 10px', textAlign:'left', fontSize:7,
      color: active ? T.accent : T.muted,
      whiteSpace:'nowrap', cursor:'pointer', userSelect:'none',
      letterSpacing:'0.08em',
    }}>
      {label}
      {active && <span style={{ marginLeft:3, opacity:0.7 }}>{sortDir===1?'↑':'↓'}</span>}
    </th>
  );
}

function StatCard({ label, value, color=T.text, sub }) {
  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:8, padding:'9px 12px', minWidth:90 }}>
      <div style={{ fontSize:7, color:T.muted, letterSpacing:'0.1em', marginBottom:3 }}>{label}</div>
      <div style={{ fontSize:16, fontWeight:700, color, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:7, color:T.muted, marginTop:2 }}>{sub}</div>}
    </div>
  );
}

function Sel({ label, value, onChange, options }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
      <div style={{ fontSize:7, color:T.muted, letterSpacing:'0.08em' }}>{label}</div>
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        height:28, padding:'0 8px', borderRadius:5,
        background:T.dim, color:T.text, border:`1px solid ${T.border}`,
        fontFamily:'inherit', fontSize:9, cursor:'pointer',
      }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function DateInput({ label, value, onChange }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:3, minWidth:140 }}>
      <div style={{ fontSize:7, color:T.muted, letterSpacing:'0.08em' }}>{label}</div>
      <input type="date" value={value} onChange={e => onChange(e.target.value)} style={{
        height:28, padding:'0 8px', borderRadius:5,
        background:'#111', color:'#fff', border:'1px solid #444',
        fontFamily:'inherit', fontSize:9, cursor:'pointer',
        outline:'none', colorScheme:'dark', width:'100%',
      }} />
    </div>
  );
}

// ── Expandable strategy row ────────────────────────────────────────────────
function StrategyRow({ trade, colSpan }) {
  const regColor = trade.regime === 'trending' ? T.accent
                 : trade.regime === 'volatile' ? T.red : T.yellow;
  return (
    <tr>
      <td colSpan={colSpan} style={{ padding:0 }}>
        <div style={{
          padding:'12px 16px 14px 40px',
          background:`${T.dim}cc`,
          borderTop:`1px solid ${T.border}`,
          borderBottom:`2px solid ${T.border}`,
        }}>
          {/* Strategy label banner */}
          {trade.strategyLabel && (
            <div style={{
              fontSize:10, fontWeight:700, color:T.text,
              padding:'6px 10px', marginBottom:10,
              background:T.card, borderRadius:6,
              borderLeft:`3px solid ${trade.isBull ? T.accent : T.red}`,
            }}>
              {trade.strategyLabel}
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>

            {/* Left: timing + context */}
            <div>
              <div style={{ fontSize:7, color:T.muted, letterSpacing:'0.1em', marginBottom:7, fontWeight:700 }}>
                TIMING
              </div>
              <div style={{ fontSize:8, display:'grid', gridTemplateColumns:'90px 1fr', gap:'4px 0', marginBottom:12 }}>
                {[
                  ['Entry time', fmtDateTime(trade.entryTime), T.text],
                  ['Exit time',  fmtDateTime(trade.closedAt),  T.text],
                  ['Duration',   fmtDuration(trade.entryTime, trade.closedAt), T.blue],
                  ['Close type', trade.closeReason ?? (trade.autoClose ? 'AUTO' : 'Manual'), T.muted],
                ].map(([lbl, val, col]) => val && val !== '–' ? (
                  <><span key={lbl+'l'} style={{ color:T.muted }}>{lbl}</span>
                    <span key={lbl+'v'} style={{ color:col, fontWeight:600 }}>{val}</span></>
                ) : null)}
              </div>

              <div style={{ fontSize:7, color:T.muted, letterSpacing:'0.1em', marginBottom:7, fontWeight:700 }}>
                CONTEXT
              </div>
              <div style={{ fontSize:8, display:'grid', gridTemplateColumns:'90px 1fr', gap:'4px 0', marginBottom:10 }}>
                {[
                  ['Session',    trade.session,      T.lime],
                  ['Regime',     trade.regime,       regColor],
                  ['LTF bias',   trade.ltfDir,       trade.ltfDir==='bull'?T.accent:trade.ltfDir==='bear'?T.red:T.muted],
                  ['HTF bias',   trade.htfDir,       trade.htfDir==='bull'?T.accent:trade.htfDir==='bear'?T.red:T.muted],
                  ['P/D zone',   trade.pdZone,       trade.pdZone==='discount'?T.accent:trade.pdZone==='premium'?T.red:T.muted],
                  ['Zone age',   trade.zoneAgeLabel, T.teal],
                  ['SL method',  trade.slMethod,     T.blue],
                  ['TP2 target', trade.htfLiqLabel,  T.blue],
                  ['ATR',        trade.curATR > 0 ? trade.curATR?.toFixed(5) : null, T.muted],
                ].filter(([,v]) => v && v !== '–').map(([lbl, val, col]) => (
                  <><span key={lbl+'l'} style={{ color:T.muted }}>{lbl}</span>
                    <span key={lbl+'v'} style={{ color:col, fontWeight:600 }}>{val}</span></>
                ))}
              </div>

              <div style={{ fontSize:7, color:T.muted, letterSpacing:'0.1em', marginBottom:7, fontWeight:700 }}>
                CONDITIONS
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                {trade.hasOB      && <Pill label="OB"         color={T.accent}  />}
                {trade.hasFVG     && <Pill label="FVG"        color={T.blue}    />}
                {trade.isBreaker  && <Pill label="BREAKER"    color={T.violet}  />}
                {trade.choch      && <Pill label="CHoCH"      color={T.violet}  />}
                {trade.sweep      && <Pill label="★ Sweep"    color={T.pink}    />}
                {trade.strongMom  && <Pill label="Inst."      color={T.amber}   />}
                {trade.idmConfirmed && <Pill label="IDM ✓"    color={T.pink}    />}
                {!trade.idmConfirmed && (trade.hasOB||trade.isBreaker) &&
                  <Pill label="IDM ✗" color={T.red} />}
                {trade.inOTE && (
                  <Pill label={`OTE ${((trade.oteFibPct||0)*100).toFixed(0)}%`} color={T.violet} />
                )}
                {trade.candleClose && <Pill label="Close ✓"  color={T.teal}    />}
                {trade.volumeQuiet && <Pill label="⚠ Low vol" color={T.orange}  />}
                {trade.slMethod === 'smart' && <Pill label="Smart SL" color={T.teal} />}
              </div>
            </div>

            {/* Right: score breakdown */}
            <div>
              <div style={{ fontSize:7, color:T.muted, letterSpacing:'0.1em', marginBottom:7, fontWeight:700 }}>
                SCORE BREAKDOWN
              </div>
              {trade.breakdown ? (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2px 8px' }}>
                  {Object.entries(trade.breakdown)
                    .filter(([,v]) => v !== 0)
                    .map(([k, v]) => {
                      const pos = v > 0;
                      const col = pos ? (BD_COLORS[k] || T.accent) : T.red;
                      return (
                        <div key={k} style={{
                          display:'flex', justifyContent:'space-between', fontSize:8,
                          borderRadius:3, padding:'2px 5px',
                          background: pos ? fa(col) : fa(T.red),
                        }}>
                          <span style={{ color:T.muted }}>{BD_LABELS[k]||k}</span>
                          <span style={{ color:col, fontWeight:700 }}>{v>0?`+${v}`:v}</span>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div style={{ fontSize:8, color:T.muted, fontStyle:'italic' }}>
                  Breakdown not stored on this trade.
                  <br />It will appear on trades closed after the backend update.
                </div>
              )}

              {/* TP1 / TP2 explanation */}
              <div style={{ marginTop:12 }}>
                <div style={{ fontSize:7, color:T.muted, letterSpacing:'0.1em', marginBottom:6, fontWeight:700 }}>
                  TARGETS
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
                  {[
                    ['SL',     trade.sl?.toFixed(fmtPrice(trade.sl,trade.pair).length > 5 ? 4 : 2), T.red],
                    ['TP1 (2R)', fmtPrice(trade.tp1, trade.pair), T.accent],
                    ['TP2',   fmtPrice(trade.tp2, trade.pair),  T.blue],
                  ].map(([lbl, val, col]) => (
                    <div key={lbl} style={{ background:T.card, borderRadius:5, padding:'5px 7px' }}>
                      <div style={{ fontSize:7, color:T.muted }}>{lbl}</div>
                      <div style={{ fontSize:11, fontWeight:700, color:col, fontFamily:'monospace' }}>{val}</div>
                    </div>
                  ))}
                </div>
                {trade.rr > 0 && (
                  <div style={{ fontSize:8, color:T.muted, marginTop:6 }}>
                    RR: <span style={{ color:T.blue, fontWeight:700 }}>{trade.rr?.toFixed(2)}R</span>
                    {' '}· Regime: <span style={{ color:regColor }}>{trade.regime}</span>
                    {trade.htfLiqLabel && ` · ${trade.htfLiqLabel}`}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function JournalTab() {
  const { journal, setJournal } = useStore();

  const [fromStr,  setFromStr]  = useState('');
  const [toStr,    setToStr]    = useState('');
  const [dirF,     setDirF]     = useState('');
  const [outF,     setOutF]     = useState('');
  const [pairF,    setPairF]    = useState('');
  const [gradeF,   setGradeF]   = useState('');
  const [validF,   setValidF]   = useState('');
  const [setupF,   setSetupF]   = useState('');
  const [sessionF, setSessionF] = useState('');
  const [regimeF,  setRegimeF]  = useState('');

  const [expandedId, setExpandedId] = useState(null);
  const [sortCol, setSortCol] = useState('date');
  const [sortDir, setSortDir] = useState(-1);
  const [page, setPage] = useState(1);

  const pairs    = useMemo(() => [...new Set(journal.map(j => j.pair))].sort(), [journal]);
  const grades   = useMemo(() => [...new Set(journal.map(j => j.grade).filter(Boolean))].sort(), [journal]);
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
        case 'date':     av = new Date(a.createdAt).getTime(); bv = new Date(b.createdAt).getTime(); break;
        case 'entry_t':  av = new Date(a.entryTime||a.createdAt).getTime(); bv = new Date(b.entryTime||b.createdAt).getTime(); break;
        case 'exit_t':   av = new Date(a.closedAt||0).getTime(); bv = new Date(b.closedAt||0).getTime(); break;
        case 'pair':     av = a.pair;     bv = b.pair;     break;
        case 'score':    av = a.score;    bv = b.score;    break;
        case 'pnl':      av = a.pnl??0;   bv = b.pnl??0;   break;
        case 'outcome':  av = a.outcome;  bv = b.outcome;  break;
        case 'entry':    av = a.entry;    bv = b.entry;    break;
        default: return 0;
      }
      if (typeof av === 'string') return sortDir * av.localeCompare(bv);
      return sortDir * ((av??0) - (bv??0));
    });
    return rows;
  }, [journal, fromDate, toDate, dirF, outF, pairF, gradeF, validF, setupF, sessionF, regimeF, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const pageRows   = filtered.slice((safePage-1)*PER_PAGE, safePage*PER_PAGE);

  const stats = useMemo(() => {
    const wins    = filtered.filter(j => j.outcome === 'win').length;
    const losses  = filtered.filter(j => j.outcome === 'loss').length;
    const partial = filtered.filter(j => j.outcome === 'partial').length;
    const closed  = wins + losses;
    const wr      = closed ? (wins/closed*100).toFixed(1) : '–';
    const totalPnl = filtered.reduce((s,j) => s+(j.pnl??0), 0);
    const avgScore = filtered.length
      ? (filtered.reduce((s,j) => s+(j.score??0),0)/filtered.length).toFixed(1) : '–';
    const invalid  = filtered.filter(j => j._invalid).length;
    return { wins, losses, partial, wr, totalPnl, avgScore, invalid, total: filtered.length };
  }, [filtered]);

  // Setup performance tiles
  const setupStats = useMemo(() => {
    const closed = filtered.filter(j => j.outcome && j.outcome !== 'timeout');
    return ['breaker','ob+fvg','ob','fvg'].map(type => {
      const rows = closed.filter(j => j._setupType === type);
      const w = rows.filter(j => j.outcome === 'win').length;
      const l = rows.filter(j => j.outcome === 'loss').length;
      const wr = (w+l) > 0 ? (w/(w+l)*100).toFixed(0) : null;
      const pnl = rows.reduce((s,j) => s+(j.pnl??0), 0);
      return { type, count: rows.length, wins:w, losses:l, wr, pnl };
    }).filter(s => s.count > 0);
  }, [filtered]);

  const handleSort = useCallback(col => {
    setSortCol(prev => {
      if (prev === col) setSortDir(d => d*-1);
      else setSortDir(-1);
      return col;
    });
    setPage(1);
  }, []);

  const reset = () => {
    setFromStr(''); setToStr('');
    setDirF(''); setOutF(''); setPairF(''); setGradeF('');
    setValidF(''); setSetupF(''); setSessionF(''); setRegimeF('');
    setPage(1);
  };

  const handleClear = async () => {
    if (!confirm('Clear all journal entries?')) return;
    try { await Journal.clear(); setJournal([]); toast.success('Journal cleared'); }
    catch { toast.error('Failed to clear journal'); }
  };

  const exportCSV = () => {
    if (!filtered.length) return;
    const hdr = [
      'ENTRY TIME','EXIT TIME','DURATION','PAIR','DIR',
      'ENTRY','SL','TP1','TP2','RR','SCORE','GRADE',
      'SESSION','REGIME','OUTCOME','P&L','KELLY%','CLOSE',
      'STRATEGY','SETUP','OB','FVG','BREAKER','CHOCH','SWEEP',
      'OTE','OTE_PCT','IDM','CLOSE_CONF','LOW_VOL',
      'LTF','HTF','PD','ZONE_AGE','SL_METHOD','VALID',
    ].join(',');
    const rows = filtered.map(j => [
      j.entryTime ? new Date(j.entryTime).toISOString() : (j.createdAt ? new Date(j.createdAt).toISOString() : ''),
      j.closedAt  ? new Date(j.closedAt).toISOString()  : '',
      fmtDuration(j.entryTime||j.createdAt, j.closedAt),
      j.pair,
      j.isBull ? 'BUY' : 'SELL',
      fmtPrice(j.entry,j.pair), fmtPrice(j.sl,j.pair),
      fmtPrice(j.tp1,j.pair),   fmtPrice(j.tp2,j.pair),
      j.rr?.toFixed(2) ?? '',
      j.score??'', j.grade??'',
      j.session??'', j.regime??'',
      j.outcome??'',
      j.pnl != null ? j.pnl.toFixed(2) : '',
      j.kellyPct??'',
      j.autoClose ? 'AUTO' : 'Manual',
      `"${(j.strategyLabel||'').replace(/"/g,"'")}"`,
      j._setupType,
      j.hasOB?1:0, j.hasFVG?1:0, j.isBreaker?1:0,
      j.choch?1:0, j.sweep?1:0,
      j.inOTE?1:0, j.inOTE ? ((j.oteFibPct||0)*100).toFixed(0)+'%' : '',
      j.idmConfirmed?1:0, j.candleClose?1:0, j.volumeQuiet?1:0,
      j.ltfDir??'', j.htfDir??'', j.pdZone??'',
      j.zoneAgeLabel??'', j.slMethod??'',
      j._invalid ? j._invalid : 'OK',
    ].join(','));
    const blob = new Blob([[hdr,...rows].join('\n')],{type:'text/csv'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `smc_journal_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const hasFilters = fromStr||toStr||dirF||outF||pairF||gradeF||validF||setupF||sessionF||regimeF;
  const COL_COUNT  = 17; // must match <th> count below

  return (
    <div>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
        <StatCard label="TOTAL TRADES" value={stats.total} color={T.text} />
        <StatCard label="WIN RATE"
          value={stats.wr==='–'?'–':`${stats.wr}%`}
          color={stats.wr!=='–'?(+stats.wr>=50?T.accent:T.red):T.muted}
          sub={`${stats.wins}W · ${stats.losses}L · ${stats.partial}P`}
        />
        <StatCard label="TOTAL P&L"
          value={stats.totalPnl>=0?`+$${stats.totalPnl.toFixed(2)}`:`-$${Math.abs(stats.totalPnl).toFixed(2)}`}
          color={stats.totalPnl>0?T.accent:stats.totalPnl<0?T.red:T.muted}
        />
        <StatCard label="AVG SCORE"    value={stats.avgScore}  color={T.blue} />
        <StatCard label="INVALID SL/TP" value={stats.invalid}
          color={stats.invalid>0?T.red:T.accent}
          sub={stats.invalid>0?'click Valid filter ↓':'all clean'}
        />
      </div>

      {/* ── Setup performance ──────────────────────────────────────────── */}
      {setupStats.length > 0 && (
        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:'12px 16px', marginBottom:14 }}>
          <div style={{ fontSize:9, color:T.muted, letterSpacing:'0.1em', marginBottom:10, fontWeight:700 }}>
            SETUP TYPE PERFORMANCE — click to filter
          </div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {setupStats.map(({ type, count, wr, pnl }) => {
              const col = SETUP_COLORS[type];
              const wrNum = wr != null ? +wr : null;
              const wrCol = wrNum==null?T.muted:wrNum>=55?T.accent:wrNum>=45?T.yellow:T.red;
              return (
                <div key={type}
                  onClick={() => { setSetupF(setupF===type?'':type); setPage(1); }}
                  style={{
                    background: setupF===type ? fa(col) : T.dim,
                    border:`1px solid ${setupF===type?col:T.border}`,
                    borderRadius:8, padding:'8px 14px', cursor:'pointer', minWidth:90,
                    transition:'all .15s',
                  }}
                >
                  <div style={{ fontSize:9, fontWeight:700, color:col, marginBottom:3 }}>
                    {SETUP_LABELS[type]}
                  </div>
                  <div style={{ fontSize:8, color:T.muted }}>{count} trades</div>
                  <div style={{ fontSize:11, fontWeight:700, color:wrCol }}>
                    {wr!=null?`${wr}% WR`:'–'}
                  </div>
                  <div style={{ fontSize:8, color:pnl>=0?T.accent:T.red }}>
                    {pnl>=0?'+':''}${pnl.toFixed(0)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:10, alignItems:'flex-end', marginBottom:12 }}>
        <DateInput label="FROM" value={fromStr} onChange={v=>{setFromStr(v);setPage(1);}} />
        <DateInput label="TO"   value={toStr}   onChange={v=>{setToStr(v);  setPage(1);}} />

        <Sel label="DIR"     value={dirF}    onChange={v=>{setDirF(v);   setPage(1);}}
          options={[{value:'',label:'All dirs'},{value:'BUY',label:'BUY'},{value:'SELL',label:'SELL'}]} />
        <Sel label="OUTCOME" value={outF}    onChange={v=>{setOutF(v);   setPage(1);}}
          options={[{value:'',label:'All outcomes'},{value:'win',label:'Win'},{value:'loss',label:'Loss'},{value:'partial',label:'Partial'}]} />
        <Sel label="PAIR"    value={pairF}   onChange={v=>{setPairF(v);  setPage(1);}}
          options={[{value:'',label:'All pairs'},...pairs.map(p=>({value:p,label:p}))]} />
        <Sel label="GRADE"   value={gradeF}  onChange={v=>{setGradeF(v); setPage(1);}}
          options={[{value:'',label:'All grades'},...grades.map(g=>({value:g,label:g}))]} />
        <Sel label="SETUP"   value={setupF}  onChange={v=>{setSetupF(v); setPage(1);}}
          options={[
            {value:'',label:'All setups'},
            {value:'breaker',label:'Breaker'},
            {value:'ob+fvg', label:'OB+FVG'},
            {value:'ob',     label:'OB only'},
            {value:'fvg',    label:'FVG only'},
          ]} />
        <Sel label="SESSION" value={sessionF} onChange={v=>{setSessionF(v);setPage(1);}}
          options={[{value:'',label:'All sessions'},...sessions.map(s=>({value:s,label:s}))]} />
        <Sel label="REGIME"  value={regimeF}  onChange={v=>{setRegimeF(v);setPage(1);}}
          options={[
            {value:'',label:'All regimes'},
            {value:'trending',label:'Trending'},
            {value:'ranging', label:'Ranging'},
            {value:'volatile',label:'Volatile'},
          ]} />
        <Sel label="VALID"   value={validF}  onChange={v=>{setValidF(v); setPage(1);}}
          options={[{value:'',label:'All'},{value:'valid',label:'✓ Valid'},{value:'invalid',label:'✗ Invalid'}]} />

        {hasFilters && (
          <button onClick={reset} style={{
            alignSelf:'flex-end', height:28, padding:'0 10px', borderRadius:5,
            background:'transparent', color:T.muted, border:`1px solid ${T.border}`,
            fontFamily:'inherit', fontSize:9, cursor:'pointer',
          }}>Reset</button>
        )}

        <div style={{ flex:1 }} />

        <button onClick={exportCSV} disabled={!filtered.length} style={{
          alignSelf:'flex-end', height:28, padding:'0 12px', borderRadius:5,
          background:'transparent', color:T.blue, border:`1px solid ${T.blue}55`,
          fontFamily:'inherit', fontSize:9, cursor:'pointer', fontWeight:700,
          opacity:filtered.length?1:0.4, display:'flex', alignItems:'center', gap:5,
        }}>
          <span>↓</span> Export CSV ({filtered.length})
        </button>

        <button onClick={handleClear} style={{
          alignSelf:'flex-end', height:28, padding:'0 10px', borderRadius:5,
          background:'transparent', color:T.red, border:`1px solid ${T.red}44`,
          fontFamily:'inherit', fontSize:9, cursor:'pointer',
        }}>Clear All</button>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:T.muted, fontSize:11 }}>
          {journal.length === 0 ? 'No trades logged yet.' : 'No trades match the current filters.'}
        </div>
      ) : (
        <>
          <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, overflow:'hidden' }}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:9 }}>
                <thead style={{ background:T.dim }}>
                  <tr>
                    {/* expand toggle column */}
                    <th style={{ width:28, padding:'7px 6px' }} />
                    <SortTH col="entry_t" label="ENTRY TIME"  {...{sortCol,sortDir,onSort:handleSort}} />
                    <SortTH col="exit_t"  label="EXIT TIME"   {...{sortCol,sortDir,onSort:handleSort}} />
                    <th style={{ padding:'7px 8px', fontSize:7, color:T.muted }}>HELD</th>
                    <SortTH col="pair"    label="PAIR"         {...{sortCol,sortDir,onSort:handleSort}} />
                    <th style={{ padding:'7px 10px', fontSize:7, color:T.muted }}>DIR</th>
                    <SortTH col="entry"   label="ENTRY PX"     {...{sortCol,sortDir,onSort:handleSort}} />
                    <th style={{ padding:'7px 10px', fontSize:7, color:T.muted }}>SL</th>
                    <th style={{ padding:'7px 10px', fontSize:7, color:T.accent }}>TP1</th>
                    <th style={{ padding:'7px 10px', fontSize:7, color:T.blue  }}>TP2</th>
                    <SortTH col="score"   label="SCORE"        {...{sortCol,sortDir,onSort:handleSort}} />
                    <th style={{ padding:'7px 10px', fontSize:7, color:T.muted }}>GR</th>
                    <th style={{ padding:'7px 10px', fontSize:7, color:T.accent, minWidth:140 }}>STRATEGY</th>
                    <SortTH col="outcome" label="OUTCOME"      {...{sortCol,sortDir,onSort:handleSort}} />
                    <SortTH col="pnl"     label="P&L"          {...{sortCol,sortDir,onSort:handleSort}} />
                    <th style={{ padding:'7px 10px', fontSize:7, color:T.muted }}>KELLY%</th>
                    <th style={{ padding:'7px 10px', fontSize:7, color:T.muted }}>VALID</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((j, k) => {
                    const rowKey   = j.id ?? k;
                    const dir      = j.isBull ? 'BUY' : 'SELL';
                    const pnlColor = (j.pnl??0)>0?T.accent:(j.pnl??0)<0?T.red:T.muted;
                    const invalid  = j._invalid;
                    const isOpen   = expandedId === rowKey;
                    const setupCol = SETUP_COLORS[j._setupType] || T.muted;

                    // TP1/TP2 same-value detection (shows orange when equal)
                    const tp1str = fmtPrice(j.tp1, j.pair);
                    const tp2str = fmtPrice(j.tp2, j.pair);
                    const tpSame = tp1str !== '–' && tp1str === tp2str;

                    return (
                      <>
                        <tr key={rowKey}
                          onClick={() => setExpandedId(isOpen ? null : rowKey)}
                          style={{
                            borderBottom: invalid ? `1px solid ${T.red}18` : `1px solid ${T.border}10`,
                            background: isOpen ? `${T.dim}aa` : invalid ? `${T.red}06` : 'transparent',
                            cursor: 'pointer',
                          }}
                        >
                          {/* expand toggle */}
                          <td style={{ padding:'6px', textAlign:'center', fontSize:8,
                            color: isOpen ? T.accent : T.muted, userSelect:'none' }}>
                            {isOpen ? '▲' : '▼'}
                          </td>

                          {/* Entry time */}
                          <td style={{ padding:'7px 10px', fontSize:8, whiteSpace:'nowrap', color:T.text }}>
                            {fmtDateTime(j.entryTime || j.createdAt)}
                          </td>

                          {/* Exit time */}
                          <td style={{ padding:'7px 10px', fontSize:8, whiteSpace:'nowrap', color:T.muted }}>
                            {j.closedAt ? fmtDateTime(j.closedAt) : '—'}
                          </td>

                          {/* Duration */}
                          <td style={{ padding:'7px 8px', fontSize:8, color:T.blue }}>
                            {fmtDuration(j.entryTime||j.createdAt, j.closedAt)}
                          </td>

                          {/* Pair */}
                          <td style={{ padding:'7px 10px', fontWeight:700, color:T.text }}>{j.pair}</td>

                          {/* Dir */}
                          <td style={{ padding:'7px 10px', color:DIR_COL[dir], fontWeight:700 }}>
                            {j.isBull?'▲':'▼'} {dir}
                          </td>

                          {/* Entry price */}
                          <td style={{ padding:'7px 10px', fontFamily:'monospace', fontSize:8 }}>
                            {fmtPrice(j.entry, j.pair)}
                          </td>

                          {/* SL */}
                          <td style={{ padding:'7px 10px', fontFamily:'monospace', fontSize:8,
                            color: invalid ? T.red : T.muted }}>
                            {fmtPrice(j.sl, j.pair)}
                          </td>

                          {/* TP1 — green-tinted */}
                          <td style={{ padding:'7px 10px', fontFamily:'monospace', fontSize:8,
                            color: tpSame ? T.orange : T.accent, fontWeight: tpSame ? 400 : 600 }}>
                            {tp1str}
                          </td>

                          {/* TP2 — blue-tinted, orange when = TP1 */}
                          <td style={{ padding:'7px 10px', fontFamily:'monospace', fontSize:8 }}>
                            <span
                              title={tpSame ? 'TP1 = TP2: single target. Fixed in updated backend.' : undefined}
                              style={{ color: tpSame ? T.orange : T.blue,
                                       cursor: tpSame ? 'help' : 'default',
                                       fontWeight: tpSame ? 400 : 600 }}
                            >
                              {tp2str}
                              {tpSame && <span style={{ fontSize:6, marginLeft:2 }}>⚠</span>}
                            </span>
                          </td>

                          {/* Score bar */}
                          <td style={{ padding:'7px 10px' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                              <div style={{ width:`${(j.score/20)*34}px`, height:3, background:gc(j.grade), borderRadius:2 }} />
                              <span style={{ fontSize:8, color:gc(j.grade) }}>{j.score?.toFixed(1)}</span>
                            </div>
                          </td>

                          {/* Grade */}
                          <td style={{ padding:'7px 10px' }}><Pill label={j.grade} color={gc(j.grade)} sz={8} /></td>

                          {/* Strategy summary */}
                          <td style={{ padding:'7px 10px', maxWidth:180 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                              {/* Setup pill */}
                              {j._setupType !== 'other' && (
                                <span style={{
                                  fontSize:7, padding:'1px 5px', borderRadius:3,
                                  background:fa(setupCol), color:setupCol,
                                  border:`1px solid ${setupCol}44`,
                                  fontWeight:700, whiteSpace:'nowrap', flexShrink:0,
                                }}>
                                  {SETUP_LABELS[j._setupType]}
                                </span>
                              )}
                              {/* Label preview or condition pills */}
                              {j.strategyLabel ? (
                                <span style={{ fontSize:7, color:T.muted, overflow:'hidden',
                                  textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:150 }}>
                                  {j.strategyLabel}
                                </span>
                              ) : (
                                <div style={{ display:'flex', gap:3 }}>
                                  {j.choch  && <Pill label="CHoCH"  color={T.violet} sz={6} />}
                                  {j.sweep  && <Pill label="Sweep"  color={T.pink}   sz={6} />}
                                  {j.inOTE  && <Pill label="OTE"    color={T.violet} sz={6} />}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Outcome */}
                          <td style={{ padding:'7px 10px', color:OUTCOME_COL[j.outcome]??T.muted, fontWeight:700 }}>
                            {j.outcome?.toUpperCase()??'–'}
                          </td>

                          {/* PnL */}
                          <td style={{ padding:'7px 10px', color:pnlColor, fontWeight:700 }}>
                            {j.pnl!=null?`${j.pnl>=0?'+':''}$${j.pnl.toFixed?j.pnl.toFixed(2):j.pnl}`:'–'}
                          </td>

                          {/* Kelly */}
                          <td style={{ padding:'7px 10px', color:T.muted, fontSize:8 }}>
                            {j.kellyPct!=null?`${j.kellyPct}%`:'–'}
                          </td>

                          {/* Valid */}
                          <td style={{ padding:'7px 10px' }}>
                            {invalid ? (
                              <span title={invalid} style={{
                                fontSize:7, padding:'2px 5px', borderRadius:3,
                                background:fa(T.red), color:T.red, border:`1px solid ${T.red}44`,
                                fontWeight:700, cursor:'help', whiteSpace:'nowrap',
                              }}>✗ {invalid}</span>
                            ) : (
                              <span style={{ fontSize:9, color:T.accent }}>✓</span>
                            )}
                          </td>
                        </tr>

                        {/* Expanded strategy panel */}
                        {isOpen && <StrategyRow key={`${rowKey}-s`} trade={j} colSpan={COL_COUNT} />}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:10, fontSize:8, color:T.muted }}>
              <span>Showing {((safePage-1)*PER_PAGE)+1}–{Math.min(safePage*PER_PAGE,filtered.length)} of {filtered.length}</span>
              <div style={{ display:'flex', gap:4 }}>
                {Array.from({length:totalPages},(_,i)=>i+1).map(p=>(
                  <button key={p} onClick={()=>setPage(p)} style={{
                    width:24, height:24, borderRadius:4, border:`1px solid ${T.border}`,
                    background:p===safePage?T.accent:'transparent',
                    color:p===safePage?T.bg:T.muted,
                    fontFamily:'inherit', fontSize:8, cursor:'pointer', fontWeight:700,
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
