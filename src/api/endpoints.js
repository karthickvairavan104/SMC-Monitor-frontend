import api from './client';

export const Auth = {
  google: (credential) => api.post('/auth/google', { credential }),
  me:     ()           => api.get('/auth/me'),
};

export const Signals = {
  live:        ()           => api.get('/signals'),
  all:         ()           => api.get('/signals/all'),
  close:       (id, outcome)=> api.patch(`/signals/${id}/close`, { outcome }),
};

export const Journal = {
  list:    ()           => api.get('/journal'),
  log:     (trade)      => api.post('/journal', trade),
  update:  (id, data)   => api.patch(`/journal/${id}`, data),
  remove:  (id)         => api.delete(`/journal/${id}`),
  clear:   ()           => api.delete('/journal'),
};

export const Portfolio = {
  get:            ()         => api.get('/portfolio'),
  reset:          ()         => api.post('/portfolio/reset'),
  updateSettings: (settings) => api.patch('/portfolio/settings', settings),
};
