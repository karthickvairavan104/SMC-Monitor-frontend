import api from './client';

export const Auth = {
  google: (credential) => api.post('/auth/google', { credential }),
  me:     ()           => api.get('/auth/me'),
};

export const Signals = {
  live:        ()            => api.get('/signals'),
  all:         ()            => api.get('/signals/all'),
  close:       (id, outcome) => api.patch(`/signals/${id}/close`, { outcome }),
};

export const Journal = {
  list:    (from, to) => {
    const params = {};
    if (from) params.from = from.toISOString();
    if (to)   params.to   = to.toISOString();
    return api.get('/journal', { params });
  },
  log:     (trade)      => api.post('/journal', trade),
  update:  (id, data)   => api.patch(`/journal/${id}`, data),
  remove:  (id)         => api.delete(`/journal/${id}`),
  clear:   ()           => api.delete('/journal'),
  exportUrl: (from, to) => {
    const base = (import.meta.env.VITE_API_URL || '/api') + '/journal/export';
    const p = new URLSearchParams();
    if (from) p.set('from', from.toISOString());
    if (to)   p.set('to',   to.toISOString());
    const token = localStorage.getItem('smc_token');
    if (token) p.set('_token', token);
    return { url: base + (p.toString() ? '?' + p.toString() : ''), token };
  },
};

export const Portfolio = {
  get:            ()         => api.get('/portfolio'),
  reset:          ()         => api.post('/portfolio/reset'),
  updateSettings: (settings) => api.patch('/portfolio/settings', settings),
};

export const Backtest = {
  run:     (params) => api.post('/backtest', params),
  history: ()       => api.get('/backtest'),
  clear:   ()       => api.delete('/backtest'),
};

// ── Chartink / Indian market endpoints ───────────────────────────────────
export const Chartink = {
  /** Returns current dynamic candidate pool for display in IndiaTab */
  candidates: () => api.get('/chartink/candidates'),

  /** Health check — verify webhook URL is reachable */
  ping:       () => api.get('/chartink/webhook/ping'),
};
