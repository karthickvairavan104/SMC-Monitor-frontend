export const fmtTime  = s => new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
export const fmtDate  = s => new Date(s).toLocaleDateString([], { month: 'short', day: 'numeric' });
export const fmtMoney = v => (v >= 0 ? '+$' : '-$') + Math.abs(v).toFixed(2);
export const pc       = v => v >= 0 ? T.accent : T.red;

export const T = {
  bg: '#010409', panel: '#050b14', card: '#080f1c', dim: '#0a1220', border: '#0e1e35',
  accent: '#00e8b0', red: '#ff1e3c', yellow: '#ffbe00', blue: '#00baff',
  violet: '#b07af5', orange: '#ff7820', text: '#d8e8ff', muted: '#364d68',
  teal: '#00c4cc', pink: '#ff5090', lime: '#8fea28', amber: '#ffaa00',
  indigo: '#6366f1',  // India market accent
};
export const fa  = c => c + '16';
export const md  = c => c + '44';
export const GC  = { 'A+': '#00e0aa', A: '#00b8f5', B: '#ffbc00', C: '#ff7520', D: '#3d5070' };
export const gc  = g => GC[g] ?? '#3d5070';
export const gradeColor = gc;

export const MAX_SCORE = 20;
export const gradeOf = s => s >= 16 ? 'A+' : s >= 12 ? 'A' : s >= 8 ? 'B' : s >= 6 ? 'C' : 'D';

// ── Forex pairs (existing) ─────────────────────────────────────────────────
export const PAIRS_WATCH = {
  Majors:  ['EUR/USD','GBP/USD','USD/JPY','USD/CHF','AUD/USD','USD/CAD','NZD/USD'],
  Minors:  ['EUR/GBP','EUR/JPY','GBP/JPY','EUR/AUD','AUD/JPY','CAD/JPY'],
  Indices: ['XAU/USD','NAS100'],
};
export const ALL_PAIRS = Object.values(PAIRS_WATCH).flat();

// ── Indian market constants ────────────────────────────────────────────────
export const INDIA_PAIRS_WATCH = {
  Indices: ['^NSEI', '^NSEBANK', '^BSESN', '^NSEMDCP50'],
  LargeCap: [
    'RELIANCE.NS','TCS.NS','HDFCBANK.NS','INFY.NS','ICICIBANK.NS',
    'HINDUNILVR.NS','ITC.NS','SBIN.NS','BHARTIARTL.NS','KOTAKBANK.NS',
  ],
  MidCap: [
    'WIPRO.NS','AXISBANK.NS','LT.NS','ASIANPAINT.NS','DMART.NS',
    'BAJFINANCE.NS','NESTLEIND.NS','TITAN.NS','ULTRACEMCO.NS','PIDILITIND.NS',
  ],
};
export const ALL_INDIA_PAIRS = Object.values(INDIA_PAIRS_WATCH).flat();

// ── Signal source helpers ──────────────────────────────────────────────────
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

// ── Price decimal helper (handles Indian stock prices) ────────────────────
export const priceDec = pair => {
  if (!pair) return 4;
  if (pair.includes('JPY') || pair === 'XAU/USD' || pair === 'NAS100') return 2;
  if (pair.endsWith('.NS') || pair.endsWith('.BO') || pair.startsWith('^')) return 2;
  return 4;
};
