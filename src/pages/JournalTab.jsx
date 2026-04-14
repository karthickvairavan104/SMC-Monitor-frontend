import { useState, useMemo, useCallback } from 'react';
import useStore from '../store/useStore';
import { Pill, ScoreRing } from '../components/Atoms';
import { T, fa, md, gc, fmtDate, fmtTime, isIndianSignal } from '../utils/format';
import { Journal } from '../api/endpoints';
import toast from 'react-hot-toast';

// ── constants ──────────────────────────────────────────────────────────────
const PER_PAGE = 50;

const OUTCOME_COL = { win: T.accent, partial: T.yellow, loss: T.red };
const DIR_COL     = { BUY: T.accent, SELL: T.red };

// ── helpers ────────────────────────────────────────────────────────────────
function fmtPrice(v, pair) {
  if (v == null || isNaN(v)) return '–';
  // Indian stocks: price in INR, show 2 decimal places
  const isIndian = pair?.endsWith('.NS') || pair?.endsWith('.BO') || pair?.startsWith('^NSE') || pair?.startsWith('^BSE');
  if (isIndian) return Number(v).toFixed(2);
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

function toDateInput(d) {
  if (!d) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function fromDateInput(s, endOfDay = false) {
  if (!s) return null;
  const d = new Date(s);
  if (endOfDay) d.setHours(23, 59, 59, 999);
  return d;
}

// Detect if a journal entry is from Indian market
function isIndianTrade(j) {
  return (
    j?.pair?.endsWith('.NS') ||
    j?.pair?.endsWith('.BO') ||
    j?.pair?.startsWith('^NSE') ||
    j?.pair?.startsWith('^BSE') ||
    j?.pairCat?.startsWith('INDIA') ||
    j?.pairCat?.startsWith('CHARTINK')
  );
}

// ── SortHeader ─────────────────────────────────────────────────────────────
function SortTH({ col, label, sortCol, sortDir, onSort, style = {} }) {
  const active = sortCol === col;
  return (
    <th
      onClick={() => onSort(col)}
      style={{
        padding: '7px 10px', textAlign: 'left', fontSize: 7,
        color: active ? T.accent : T.muted,
        whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none',
        letterSpacing: '0.08em',
        ...style,
      }}
    >
      {label}
      {active && <span style={{ marginLeft: 3, opacity: 0.7 }}>{sortDir === 1 ? '↑' : '↓'}</span>}
    </th>
  );
}

// ── StatCard ───────────────────────────────────────────────────────────────
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

// ── FilterSelect ───────────────────────────────────────────────────────────
function FilterSelect({ label, value, onChange, options }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ fontSize: 7, color: T.muted, letterSpacing: '0.08em' }}>{label}</div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          height: 28, padding: '0 8px', borderRadius: 5,
          background: T.dim, color: T.text,
          border: `1px solid ${T.border}`,
          fontFamily: 'inherit', fontSize: 9, cursor: 'pointer',
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ── DateInput ──────────────────────────────────────────────────────────────
function DateInput({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 140 }}>
      <div style={{ fontSize: 7, color: T.muted, letterSpacing: '0.08em' }}>
        {label}
      </div>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          height: 28,
          padding: '0 8px',
          borderRadius: 5,
          background: '#111',
          color: '#fff',
          border: '1px solid #444',
          fontFamily: 'inherit',
          fontSize: 9,
          cursor: 'pointer',
          outline: 'none',
          colorScheme: 'dark',
          width: '100%'
        }}
      />
    </div>
  );
}

// ── Tab button ─────────────────────────────────────────────────────────────
function TabButton({ active, onClick, children, color = T.accent, count }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 18px',
        borderRadius: 7,
        border: `1px solid ${active ? color : T.border}`,
        background: active ? fa(color) : 'transparent',
        color: active ? color : T.muted,
        fontFamily: 'inherit',
        fontSize: 10,
        fontWeight: active ? 700 : 400,
        cursor: 'pointer',
        transition: 'all .15s',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {children}
      {count !== undefined && (
        <span style={{
          fontSize: 8,
          padding: '1px 6px',
          borderRadius: 10,
          background: active ? `${color}33` : T.dim,
          color: active ? color : T.muted,
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

// ── Journal Table (shared between Forex & India tabs) ─────────────────────
function JournalTable({ rows, sortCol, sortDir, onSort, isIndian = false }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const pageRows   = rows.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  return (
    <>
      {rows.length === 0 ? null : (
        <>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
                <thead style={{ background: T.dim }}>
                  <tr>
                    <SortTH col="date"    label="DATE"    {...{sortCol, sortDir, onSort}} />
                    <SortTH col="pair"    label={isIndian ? 'SYMBOL' : 'PAIR'}  {...{sortCol, sortDir, onSort}} />
                    <th style={{ padding: '7px 10px', fontSize: 7, color: T.muted, whiteSpace: 'nowrap' }}>DIR</th>
                    <SortTH col="entry"   label={isIndian ? 'ENTRY (₹)' : 'ENTRY'} {...{sortCol, sortDir, onSort}} />
                    <th style={{ padding: '7px 10px', fontSize: 7, color: T.muted }}>SL</th>
                    <th style={{ padding: '7px 10px', fontSize: 7, color: T.muted }}>TP1</th>
                    <th style={{ padding: '7px 10px', fontSize: 7, color: T.muted }}>TP2</th>
                    <SortTH col="score"   label="SCORE"   {...{sortCol, sortDir, onSort}} />
                    <th style={{ padding: '7px 10px', fontSize: 7, color: T.muted }}>GRADE</th>
                    {!isIndian && <th style={{ padding: '7px 10px', fontSize: 7, color: T.muted }}>SESSION</th>}
                    {isIndian  && <th style={{ padding: '7px 10px', fontSize: 7, color: T.muted }}>SOURCE</th>}
                    <SortTH col="outcome" label="OUTCOME" {...{sortCol, sortDir, onSort}} />
                    <SortTH col="pnl"     label={isIndian ? 'P&L (₹)' : 'P&L'}  {...{sortCol, sortDir, onSort}} />
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
                    const rowBorder = invalid
                      ? `1px solid ${T.red}18`
                      : `1px solid ${T.border}10`;
                    const source = j.pairCat?.replace('CHARTINK:', '') || (j.session ?? '–');
                    return (
                      <tr key={j.id ?? k} style={{ borderBottom: rowBorder, background: invalid ? `${T.red}06` : 'transparent' }}>
                        <td style={{ padding: '7px 10px', color: T.muted, fontSize: 8, whiteSpace: 'nowrap' }}>
                          {fmtDate(j.createdAt)}<br />
                          <span style={{ fontSize: 7, opacity: 0.6 }}>{fmtTime(j.createdAt)}</span>
                        </td>
                        <td style={{ padding: '7px 10px', fontWeight: 700, color: T.text }}>
                          {isIndian
                            ? j.pair.replace('.NS','').replace('.BO','').replace('^','')
                            : j.pair}
                          {isIndian && (
                            <div style={{ fontSize: 7, color: T.muted, marginTop: 1 }}>{j.pair}</div>
                          )}
                        </td>
                        <td style={{ padding: '7px 10px', color: DIR_COL[dir], fontWeight: 700 }}>
                          {j.isBull ? '▲' : '▼'} {dir}
                        </td>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 8 }}>{fmtPrice(j.entry, j.pair)}</td>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 8, color: invalid ? T.red : T.muted }}>
                          {fmtPrice(j.sl, j.pair)}
                        </td>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 8, color: invalid ? T.red : T.muted }}>
                          {fmtPrice(j.tp1, j.pair)}
                        </td>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 8, color: T.muted }}>
                          {fmtPrice(j.tp2, j.pair)}
                        </td>
                        <td style={{ padding: '7px 10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <div style={{ width: `${(j.score / 20) * 36}px`, height: 3, background: gc(j.grade), borderRadius: 2 }} />
                            <span style={{ fontSize: 8, color: gc(j.grade) }}>{j.score?.toFixed(1)}</span>
                          </div>
                        </td>
                        <td style={{ padding: '7px 10px' }}><Pill label={j.grade} color={gc(j.grade)} sz={8} /></td>
                        <td style={{ padding: '7px 10px', color: T.muted, fontSize: 8 }}>
                          {isIndian
                            ? <Pill label={source?.startsWith('Yahoo') ? 'YAHOO' : 'CHARTINK'} color={source?.startsWith('Yahoo') ? T.blue : '#6366f1'} sz={7} />
                            : (j.session ?? '–')}
                        </td>
                        <td style={{ padding: '7px 10px', color: OUTCOME_COL[j.outcome] ?? T.muted, fontWeight: 700 }}>
                          {j.outcome?.toUpperCase() ?? '–'}
                        </td>
                        <td style={{ padding: '7px 10px', color: pnlColor, fontWeight: 700 }}>
                          {j.pnl != null
                            ? `${j.pnl >= 0 ? '+' : ''}${isIndian ? '₹' : '$'}${Math.abs(j.pnl).toFixed(2)}`
                            : '–'}
                        </td>
                        <td style={{ padding: '7px 10px', color: T.muted, fontSize: 8 }}>
                          {j.kellyPct != null ? `${j.kellyPct}%` : '–'}
                        </td>
                        <td style={{ padding: '7px 10px' }}>
                          {j.autoClose
                            ? <span title={j.closeReason ?? ''} style={{ fontSize: 7, padding: '2px 6px', borderRadius: 3, background: fa(T.blue), color: T.blue, border: `1px solid ${T.blue}44`, fontWeight: 700, cursor: 'help' }}>AUTO</span>
                            : <span style={{ fontSize: 7, color: T.muted }}>Manual</span>}
                        </td>
                        <td style={{ padding: '7px 10px' }}>
                          {invalid
                            ? (
                              <span title={invalid} style={{
                                fontSize: 7, padding: '2px 6px', borderRadius: 3,
                                background: fa(T.red), color: T.red,
                                border: `1px solid ${T.red}44`,
                                fontWeight: 700, cursor: 'help', whiteSpace: 'nowrap',
                              }}>✗ {invalid}</span>
                            ) : (
                              <span style={{ fontSize: 9, color: T.accent }}>✓</span>
                            )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, fontSize: 8, color: T.muted }}>
              <span>
                Showing {((safePage-1)*PER_PAGE)+1}–{Math.min(safePage*PER_PAGE, rows.length)} of {rows.length} trades
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    style={{
                      width: 24, height: 24, borderRadius: 4, border: `1px solid ${T.border}`,
                      background: p === safePage ? T.accent : 'transparent',
                      color: p === safePage ? T.bg : T.muted,
                      fontFamily: 'inherit', fontSize: 8, cursor: 'pointer', fontWeight: 700,
                    }}
                  >{p}</button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function JournalTab() {
  const { journal, setJournal } = useStore();

  // ── market tab ────────────────────────────────────────────────────────
  const [marketTab, setMarketTab] = useState('forex'); // 'forex' | 'india' | 'all'

  // ── filter state ──────────────────────────────────────────────────────
  const [fromStr, setFromStr] = useState('');
  const [toStr,   setToStr]   = useState('');
  const [dirF,    setDirF]    = useState('');
  const [outF,    setOutF]    = useState('');
  const [pairF,   setPairF]   = useState('');
  const [gradeF,  setGradeF]  = useState('');
  const [validF,  setValidF]  = useState('');

  // ── sort state ────────────────────────────────────────────────────────
  const [sortCol, setSortCol] = useState('date');
  const [sortDir, setSortDir] = useState(-1);

  // ── split journal into forex / indian ─────────────────────────────────
  const forexJournal  = useMemo(() => journal.filter(j => !isIndianTrade(j)), [journal]);
  const indiaJournal  = useMemo(() => journal.filter(j =>  isIndianTrade(j)), [journal]);

  const activeJournal = marketTab === 'forex' ? forexJournal
                      : marketTab === 'india'  ? indiaJournal
                      : journal;

  const isIndian = marketTab === 'india';

  // ── derived data ──────────────────────────────────────────────────────
  const pairs  = useMemo(() => [...new Set(activeJournal.map(j => j.pair))].sort(), [activeJournal]);
  const grades = useMemo(() => [...new Set(activeJournal.map(j => j.grade).filter(Boolean))].sort(), [activeJournal]);

  const fromDate = useMemo(() => fromDateInput(fromStr, false), [fromStr]);
  const toDate   = useMemo(() => fromDateInput(toStr, true),    [toStr]);

  const filtered = useMemo(() => {
    let rows = activeJournal.map(j => ({ ...j, _invalid: validateSLTP(j) }));

    if (fromDate) rows = rows.filter(j => new Date(j.createdAt) >= fromDate);
    if (toDate)   rows = rows.filter(j => new Date(j.createdAt) <= toDate);
    if (dirF)     rows = rows.filter(j => (j.isBull ? 'BUY' : 'SELL') === dirF);
    if (outF)     rows = rows.filter(j => j.outcome === outF);
    if (pairF)    rows = rows.filter(j => j.pair === pairF);
    if (gradeF)   rows = rows.filter(j => j.grade === gradeF);
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
  }, [activeJournal, fromDate, toDate, dirF, outF, pairF, gradeF, validF, sortCol, sortDir]);

  // ── stats ─────────────────────────────────────────────────────────────
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

  // ── handlers ──────────────────────────────────────────────────────────
  const handleSort = useCallback(col => {
    setSortCol(prev => {
      if (prev === col) setSortDir(d => d * -1);
      else { setSortDir(-1); }
      return col;
    });
  }, []);

  const resetFilters = () => {
    setFromStr(''); setToStr('');
    setDirF(''); setOutF(''); setPairF(''); setGradeF(''); setValidF('');
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
    const currencySymbol = isIndian ? '₹' : '$';
    const header = ['DATE','PAIR','DIR','ENTRY','SL','TP1','TP2','SCORE','GRADE','SESSION','OUTCOME','P&L','KELLY%','CLOSE TYPE','VALID'].join(',');
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
      j.outcome ?? '',
      j.pnl != null ? j.pnl.toFixed(2) : '',
      j.kellyPct != null ? j.kellyPct : '',
      j.autoClose ? 'AUTO' : 'Manual',
      j._invalid ? j._invalid : 'OK',
    ].join(','));
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const range = (fromStr || toStr) ? `_${fromStr || 'start'}_to_${toStr || 'end'}` : '';
    const mktLabel = marketTab === 'india' ? '_india' : marketTab === 'forex' ? '_forex' : '';
    a.href = url;
    a.download = `smc_journal${mktLabel}${range}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasFilters = fromStr || toStr || dirF || outF || pairF || gradeF || validF;
  const currency   = isIndian ? '₹' : '$';

  // ── India-specific stats ───────────────────────────────────────────────
  const indiaSourceStats = useMemo(() => {
    if (marketTab !== 'india') return null;
    const chartink = filtered.filter(j => j.pairCat?.startsWith('CHARTINK')).length;
    const yahoo    = filtered.filter(j => !j.pairCat?.startsWith('CHARTINK')).length;
    return { chartink, yahoo };
  }, [filtered, marketTab]);

  // ── render ─────────────────────────────────────────────────────────────
  return (
    <div>

      {/* ── Market Tab Switcher ────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center',
        borderBottom: `1px solid ${T.border}`, paddingBottom: 12,
      }}>
        <TabButton
          active={marketTab === 'forex'}
          onClick={() => { setMarketTab('forex'); setPairF(''); }}
          color={T.blue}
          count={forexJournal.length}
        >
          💱 Forex / Crypto
        </TabButton>
        <TabButton
          active={marketTab === 'india'}
          onClick={() => { setMarketTab('india'); setPairF(''); }}
          color="#6366f1"
          count={indiaJournal.length}
        >
          🇮🇳 Indian Market
        </TabButton>
        <TabButton
          active={marketTab === 'all'}
          onClick={() => { setMarketTab('all'); setPairF(''); }}
          color={T.muted}
          count={journal.length}
        >
          All Trades
        </TabButton>

        {/* Indian market badge */}
        {marketTab === 'india' && (
          <div style={{
            marginLeft: 'auto', fontSize: 8, color: '#6366f1',
            background: fa('#6366f1'), border: `1px solid ${'#6366f1'}44`,
            borderRadius: 6, padding: '4px 10px',
          }}>
            NSE · BSE · Prices in ₹ INR
          </div>
        )}
      </div>

      {/* ── Stats bar ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <StatCard label="TOTAL TRADES" value={stats.total} color={T.text} />
        <StatCard
          label="WIN RATE"
          value={stats.wr === '–' ? '–' : `${stats.wr}%`}
          color={stats.wr !== '–' ? (stats.wr >= 50 ? T.accent : T.red) : T.muted}
          sub={`${stats.wins}W · ${stats.losses}L · ${stats.partial}P`}
        />
        <StatCard
          label={`TOTAL P&L (${currency})`}
          value={stats.totalPnl >= 0
            ? `+${currency}${stats.totalPnl.toFixed(2)}`
            : `-${currency}${Math.abs(stats.totalPnl).toFixed(2)}`}
          color={stats.totalPnl > 0 ? T.accent : stats.totalPnl < 0 ? T.red : T.muted}
        />
        <StatCard label="AVG SCORE"  value={stats.avgScore} color={T.blue} />
        <StatCard
          label="INVALID SL/TP"
          value={stats.invalid}
          color={stats.invalid > 0 ? T.red : T.accent}
          sub={stats.invalid > 0 ? 'click Valid filter ↓' : 'all clean'}
        />
        {/* India-specific source breakdown */}
        {indiaSourceStats && (
          <>
            <StatCard label="CHARTINK TRADES" value={indiaSourceStats.chartink} color="#6366f1" />
            <StatCard label="YAHOO TRADES"     value={indiaSourceStats.yahoo}    color={T.blue}   />
          </>
        )}
      </div>

      {/* ── Toolbar ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 12 }}>
        <DateInput label="FROM" value={fromStr} onChange={v => setFromStr(v)} />
        <DateInput label="TO"   value={toStr}   onChange={v => setToStr(v)}   />

        <FilterSelect label="DIRECTION" value={dirF} onChange={v => setDirF(v)}
          options={[{value:'',label:'All dirs'},{value:'BUY',label:'BUY'},{value:'SELL',label:'SELL'}]} />

        <FilterSelect label="OUTCOME" value={outF} onChange={v => setOutF(v)}
          options={[{value:'',label:'All outcomes'},{value:'win',label:'Win'},{value:'loss',label:'Loss'},{value:'partial',label:'Partial'}]} />

        <FilterSelect
          label={isIndian ? 'SYMBOL' : 'PAIR'}
          value={pairF}
          onChange={v => setPairF(v)}
          options={[
            {value:'',label: isIndian ? 'All symbols' : 'All pairs'},
            ...pairs.map(p => ({
              value: p,
              label: isIndian
                ? p.replace('.NS','').replace('.BO','').replace('^','')
                : p,
            }))
          ]}
        />

        <FilterSelect label="GRADE" value={gradeF} onChange={v => setGradeF(v)}
          options={[{value:'',label:'All grades'}, ...grades.map(g => ({value:g,label:g}))]} />

        <FilterSelect label="VALID" value={validF} onChange={v => setValidF(v)}
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
          background: 'transparent', color: T.blue,
          border: `1px solid ${T.blue}55`,
          fontFamily: 'inherit', fontSize: 9, cursor: 'pointer', fontWeight: 700,
          opacity: filtered.length ? 1 : 0.4,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <span>↓</span> Export CSV {fromStr || toStr ? '(range)' : `(${filtered.length})`}
        </button>

        <button onClick={handleClear} style={{
          alignSelf: 'flex-end', height: 28, padding: '0 10px', borderRadius: 5,
          background: 'transparent', color: T.red,
          border: `1px solid ${T.red}44`,
          fontFamily: 'inherit', fontSize: 9, cursor: 'pointer',
        }}>Clear All</button>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: T.muted, fontSize: 11 }}>
          {marketTab === 'india' && indiaJournal.length === 0 ? (
            <>
              <div style={{ fontSize: 20, marginBottom: 10 }}>🇮🇳</div>
              <div style={{ marginBottom: 6 }}>No Indian market trades logged yet.</div>
              <div style={{ fontSize: 9 }}>
                Trades on NSE/BSE stocks (e.g. RELIANCE.NS, ^NSEI) will appear here automatically.
              </div>
            </>
          ) : activeJournal.length === 0 ? (
            'No trades logged yet.'
          ) : (
            'No trades match the current filters.'
          )}
        </div>
      ) : (
        <JournalTable
          rows={filtered}
          sortCol={sortCol}
          sortDir={sortDir}
          onSort={handleSort}
          isIndian={isIndian}
        />
      )}
    </div>
  );
}