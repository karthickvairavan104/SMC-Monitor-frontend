import useStore from '../store/useStore';
import SignalCard from '../components/SignalCard';
import { T } from '../utils/format';

export default function ScannerTab() {
  const { signals, newSigIds, settings, scanning } = useStore();
  const live = signals.filter(s => s.status === 'LIVE');

  if (scanning && live.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: T.muted }}>
        <div style={{ fontSize: 12 }}>⟳ Waiting for first scan…</div>
      </div>
    );
  }

  if (live.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: T.muted }}>
        <div style={{ fontSize: 14, marginBottom: 8 }}>No signals above score {settings.alertScore}</div>
        <div style={{ fontSize: 10 }}>
          Watching {settings.watchPairs.length} pairs · Server scans every {settings.scanInterval}s
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {live.map(sig => (
        <SignalCard key={sig.id} sig={sig} isNew={newSigIds.has(sig.id)} />
      ))}
    </div>
  );
}
