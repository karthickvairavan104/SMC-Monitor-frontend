import useStore from '../store/useStore';
import { Pill } from '../components/Atoms';
import { T, gc, fmtTime, fmtDateTime, weekendWarning } from '../utils/format';

export default function AlertsTab() {
  const { signals, autoCloseLog, settings } = useStore();
  const alerts = [...signals]
    .filter(s => s.score >= settings.alertScore)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* Auto-close event feed */}
      {autoCloseLog.length > 0 && (
        <div style={{ background: T.card, border: `1px solid ${T.blue}44`, borderRadius: 10, padding: 14, marginBottom: 4 }}>
          <div style={{ fontSize: 9, color: T.blue, fontWeight: 700, marginBottom: 10 }}>⚡ AUTO-CLOSE LOG</div>
          {autoCloseLog.map((ac, k) => {
            const col = ac.outcome === 'win' ? T.accent : ac.outcome === 'partial' ? T.yellow : T.red;
            return (
              <div key={k} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '5px 0', borderBottom: `1px solid ${T.border}18`, fontSize: 9 }}>
                <Pill label={ac.outcome?.toUpperCase()} color={col} sz={8} />
                <span style={{ color: T.text, fontWeight: 700 }}>{ac.pair?.replace('.NS','').replace('^','') || ac.pair}</span>
                <span style={{ color: T.muted, flex: 1 }}>{ac.reason}</span>
                <span style={{ color: ac.pnl >= 0 ? T.accent : T.red, fontWeight: 700 }}>
                  {ac.pnl >= 0 ? '+' : ''}${ac.pnl?.toFixed(2)}
                </span>
                <span style={{ color: T.muted, fontSize: 8 }}>{fmtTime(ac.ts || new Date())}</span>
              </div>
            );
          })}
        </div>
      )}

      {alerts.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: T.muted, fontSize: 12 }}>
          No alerts yet — watching for score ≥ {settings.alertScore}
        </div>
      )}

      {alerts.map((a, k) => {
        // Prefer explicit entryTime; fall back to createdAt
        const ts       = a.entryTime ?? a.createdAt;
        const warnInfo = weekendWarning(ts);

        return (
          <div key={a.id + k} style={{
            background: T.card,
            border: `1px solid ${warnInfo.isWeekend ? T.red + '55' : T.border}`,
            borderRadius: 9, padding: '10px 14px', display: 'flex', gap: 12, alignItems: 'center',
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: gc(a.grade) + '16', border: `1px solid ${gc(a.grade)}44`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: gc(a.grade) }}>{a.grade}</div>
              <div style={{ fontSize: 8, color: gc(a.grade), opacity: .7 }}>{a.score?.toFixed(1)}</div>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700 }}>
                {a.pair?.replace('.NS','').replace('^','') || a.pair}{' '}
                <span style={{ color: a.isBull ? T.accent : T.red }}>{a.isBull ? '▲ BUY' : '▼ SELL'}</span>
              </div>
              <div style={{ display: 'flex', gap: 5, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                {a.idmConfirmed && <Pill label="IDM ✓"  color={T.pink}   sz={7} />}
                {!a.idmConfirmed && <Pill label="⚠ IDM" color={T.red}    sz={7} />}
                {a.isBreaker    && <Pill label="BREAKER" color={T.violet} sz={7} />}
                {a.inOTE        && <Pill label="OTE"     color={T.violet} sz={7} />}
                {/* Entry time */}
                <span style={{ fontSize: 8, color: warnInfo.isWeekend ? T.red : T.muted }}>
                  {warnInfo.isWeekend ? `⚠ ${warnInfo.dayName}` : a.session} · {fmtDateTime(ts)}
                </span>
              </div>
            </div>

            <div style={{ textAlign: 'right', fontSize: 9, color: T.muted }}>
              Score {a.score?.toFixed(1)}/20
              {warnInfo.isWeekend && (
                <div style={{ fontSize: 7, color: T.red, fontWeight: 700, marginTop: 2 }}>
                  WEEKEND
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
