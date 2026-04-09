import { useEffect } from 'react';
import { Signals, Journal, Portfolio } from '../api/endpoints';
import useStore from '../store/useStore';

export default function useData() {
  const { token, setSignals, setJournal, setPortfolio, setSettings } = useStore();

  useEffect(() => {
    if (!token) return;

    Signals.live().then(r => setSignals(r.data)).catch(() => {});
    Journal.list().then(r => setJournal(r.data)).catch(() => {});
    Portfolio.get().then(r => {
      setPortfolio(r.data);
    }).catch(() => {});
  }, [token]);
}
