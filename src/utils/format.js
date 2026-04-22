export const fmtTime  = s => new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
export const fmtDate  = s => new Date(s).toLocaleDateString([], { month: 'short', day: 'numeric' });
export const fmtMoney = v => (v >= 0 ? '+$' : '-$') + Math.abs(v).toFixed(2);
export const pc       = v => v >= 0 ? T.accent : T.red;

export const T = {
  bg: '#010409', panel: '#050b14', card: '#080f1c', dim: '#0a1220', border: '#0e1e35',
  accent: '#00e8b0', red: '#ff1e3c', yellow: '#ffbe00', blue: '#00baff',
  violet: '#b07af5', orange: '#ff7820', text: '#d8e8ff', muted: '#364d68',
  teal: '#00c4cc', pink: '#ff5090', lime: '#8fea28', amber: '#ffaa00',
  indigo: '#6366f1',
};
export const fa  = c => c + '16';
export const md  = c => c + '44';
export const GC  = { 'A+': '#00e0aa', A: '#00b8f5', B: '#ffbc00', C: '#ff7520', D: '#3d5070' };
export const gc  = g => GC[g] ?? '#3d5070';
export const gradeColor = gc;

export const MAX_SCORE = 20;
export const gradeOf = s => s >= 16 ? 'A+' : s >= 12 ? 'A' : s >= 8 ? 'B' : s >= 6 ? 'C' : 'D';

export const PAIRS_WATCH = {
  Majors:  ['EUR/USD','GBP/USD','USD/JPY','USD/CHF','AUD/USD','USD/CAD','NZD/USD'],
  Minors:  ['EUR/GBP','EUR/JPY','GBP/JPY','EUR/AUD','AUD/JPY','CAD/JPY'],
  Indices: ['XAU/USD','NAS100'],
};
export const ALL_PAIRS = Object.values(PAIRS_WATCH).flat();

export const INDIA_PAIRS_WATCH = {
  Indices:  ['^NSEI', '^NSEBANK', '^BSESN', '^NSEMDCP50'],
  LargeCap: ['RELIANCE.NS','TCS.NS','HDFCBANK.NS','INFY.NS','ICICIBANK.NS',
              'HINDUNILVR.NS','ITC.NS','SBIN.NS','BHARTIARTL.NS','KOTAKBANK.NS'],
  MidCap:   ['WIPRO.NS','AXISBANK.NS','LT.NS','ASIANPAINT.NS','DMART.NS',
              'BAJFINANCE.NS','NESTLEIND.NS','TITAN.NS','ULTRACEMCO.NS','PIDILITIND.NS'],
};
export const ALL_INDIA_PAIRS = Object.values(INDIA_PAIRS_WATCH).flat();

// ── Indian signal helpers ──────────────────────────────────────────────────
export const isIndianSignal = sig =>
  sig?.pairCat?.startsWith('INDIA') ||
  sig?.pairCat?.startsWith('CHARTINK') ||
  sig?.pair?.endsWith('.NS') ||
  sig?.pair?.endsWith('.BO') ||
  sig?.pair?.startsWith('^NSE') ||
  sig?.pair?.startsWith('^BSE');

export const isChartinkSignal = sig => sig?.pairCat?.startsWith('CHARTINK');

export const signalSource = sig => {
  if (!sig?.pairCat) return 'FOREX';
  if (sig.pairCat.startsWith('CHARTINK:')) return sig.pairCat.replace('CHARTINK:', '');
  if (sig.pairCat === 'INDIA') return 'Yahoo Screener';
  return sig.pairCat;
};

export const priceDec = pair => {
  if (!pair) return 4;
  if (pair.includes('JPY') || pair === 'XAU/USD' || pair === 'NAS100') return 2;
  if (pair.endsWith('.NS') || pair.endsWith('.BO') || pair.startsWith('^')) return 2;
  return 4;
};

// ── Entry / Exit time helpers ──────────────────────────────────────────────
// Prefer explicit entryTime/exitTime fields; fall back to createdAt / closedAt.

/**
 * Returns the best available entry timestamp from a signal or trade object.
 * Priority: sig.entryTime → sig.createdAt
 */
export const getEntryTime = obj => obj?.entryTime ?? obj?.createdAt ?? null;

/**
 * Returns the best available exit timestamp from a signal or trade object.
 * Priority: sig.exitTime → trade.closedAt
 */
export const getExitTime = obj => obj?.exitTime ?? obj?.closedAt ?? null;

/**
 * Formats a UTC ISO timestamp as a compact date+time string.
 * e.g. "Apr 19  09:32"  — date only shown when different from today.
 */
export const fmtDateTime = ts => {
  if (!ts) return '–';
  const d   = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth()    === now.getMonth()    &&
    d.getDate()     === now.getDate();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return time;
  const date = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `${date}  ${time}`;
};

/**
 * Returns a human-readable duration string between two timestamps.
 * e.g. "2h 34m",  "45m",  "3d 2h"
 */
export const fmtDuration = (start, end) => {
  if (!start) return '–';
  const ms  = (end ? new Date(end) : new Date()) - new Date(start);
  if (ms < 0) return '–';
  const totalMin = Math.floor(ms / 60_000);
  const days  = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins  = totalMin % 60;
  if (days  > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

/**
 * Returns the UTC day-of-week for a timestamp and a warning flag if it
 * falls on a Saturday or Sunday (weekend — forex market closed).
 */
export const weekendWarning = ts => {
  if (!ts) return { dayName: '', isWeekend: false };
  const d   = new Date(ts);
  const day = d.getUTCDay(); // 0=Sun, 6=Sat
  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return {
    dayName:   DAYS[day],
    isWeekend: day === 0 || day === 6,
  };
};
