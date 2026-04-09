import { create } from 'zustand';

const useStore = create((set, get) => ({
  // ── Auth ─────────────────────────────────────────────────────────────
  user:     null,
  token:    localStorage.getItem('smc_token') || null,
  setAuth:  (user, token) => {
    localStorage.setItem('smc_token', token);
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem('smc_token');
    set({ user: null, token: null, signals: [], journal: [], portfolio: null });
  },

  // ── Signals ───────────────────────────────────────────────────────────
  signals:    [],
  newSigIds:  new Set(),
  setSignals: (signals) => set({ signals }),
  addSignal:  (sig) => {
    set(s => ({
      signals:   [sig, ...s.signals.filter(x => x.id !== sig.id)].slice(0, 40),
      newSigIds: new Set([...s.newSigIds, sig.id]),
    }));
    setTimeout(() => set(s => {
      const n = new Set(s.newSigIds); n.delete(sig.id); return { newSigIds: n };
    }), 8000);
  },
  closeSignal: (sigId, outcome) => set(s => ({
    signals: s.signals.map(sig =>
      sig.id === sigId ? { ...sig, status: 'CLOSED', outcome } : sig
    ),
  })),

  // ── Auto-close log ────────────────────────────────────────────────────
  autoCloseLog: [],
  addAutoCloseEvent: (event) => set(s => ({
    autoCloseLog: [event, ...s.autoCloseLog].slice(0, 50),
  })),

  // ── Journal ───────────────────────────────────────────────────────────
  journal:    [],
  setJournal: (journal) => set({ journal }),
  addTrade:   (trade)   => set(s => ({ journal: [trade, ...s.journal].slice(0, 500) })),

  // ── Portfolio ─────────────────────────────────────────────────────────
  portfolio:    null,
  setPortfolio: (portfolio) => set({ portfolio }),
  updateBalance: (balance) => set(s => ({
    portfolio: s.portfolio ? { ...s.portfolio, balance } : null,
  })),

  // ── Settings ──────────────────────────────────────────────────────────
  settings: {
    soundOn:      true,
    notifOn:      false,
    autoClose:    true,
    scanInterval: 60,
    alertScore:   6,
    maxSignals:   20,
    watchPairs:   [
      'EUR/USD','GBP/USD','USD/JPY','USD/CHF','AUD/USD','USD/CAD','NZD/USD',
      'EUR/GBP','EUR/JPY','GBP/JPY','EUR/AUD','AUD/JPY','CAD/JPY',
      'XAU/USD','NAS100',
    ],
  },
  setSettings: (settings) => set({ settings }),
  patchSettings: (patch) => set(s => ({ settings: { ...s.settings, ...patch } })),

  // ── UI ────────────────────────────────────────────────────────────────
  tab:    'scanner',
  setTab: (tab) => set({ tab }),
  scanning: false,
  setScanning: (scanning) => set({ scanning }),
}));

export default useStore;
