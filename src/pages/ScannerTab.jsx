import useStore from '../store/useStore';
import SignalCard from '../components/SignalCard';
import { T, fa, md, isIndianSignal } from '../utils/format';

export default function ScannerTab() {
  const { signals, newSigIds, settings, scanning, marketMode, setMarketMode } = useStore();

  const live = signals.filter(s => s.status === 'LIVE');

  // Apply market mode filter
  const filtered = live.filter(sig => {
    if (marketMode === 'forex') return !isIndianSignal(sig);
    if (marketMode === 'india') return isIndianSignal(sig);
    return true; // 'all'
  });

  const forexCount  = live.filter(s => !isIndianSignal(s)).length;
  const indiaCount  = live.filter(s =>  isIndianSignal(s)).length;

  return (
    <div>
      {/* ── Market mode filter ──────────────────────────────────────── */}
      {live.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center' }}>
          {[
            { id: 'all',   label: `All (${live.length})` },
            { id: 'forex', label: `Forex / Metals (${forexCount})` },
            { id: 'india', label: `🇮🇳 India (${indiaCount})` },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setMarketMode(id)} style={{
              padding: '5px 12px', borderRadius: 5, fontSize: 9,
              background: marketMode === id ? fa(T.accent) : 'transparent',
              border: `1px solid ${marketMode === id ? T.accent : T.border}`,
              color: marketMode === id ? T.accent : T.muted,
              fontFamily: 'inherit', cursor: 'pointer', fontWeight: marketMode === id ? 700 : 400,
            }}>{label}</button>
          ))}
          <div style={{ marginLeft: 'auto', fontSize: 8, color: T.muted }}>
            Server scans every {settings.scanInterval}s
          </div>
        </div>
      )}

      {/* ── Content ─────────────────────────────────────────────────── */}
      {scanning && live.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: T.muted }}>
          <div style={{ fontSize: 12 }}>⟳ Waiting for first scan…</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: T.muted }}>
          <div style={{ fontSize: 14, marginBottom: 8 }}>
            {live.length > 0
              ? `No ${marketMode === 'india' ? 'Indian' : 'Forex'} signals above score ${settings.alertScore}`
              : `No signals above score ${settings.alertScore}`}
          </div>
          <div style={{ fontSize: 10 }}>
            Watching {settings.watchPairs.length} pairs · Server scans every {settings.scanInterval}s
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {filtered.map(sig => (
            <SignalCard key={sig.id} sig={sig} isNew={newSigIds.has(sig.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
