import useStore from '../store/useStore';
import { T, fa, md, PAIRS_WATCH, INDIA_PAIRS_WATCH } from '../utils/format';
import { Portfolio } from '../api/endpoints';
import toast from 'react-hot-toast';

const TIERS = [
  { min: 11, max: 99, label: 'PERFECT STORM',   color: '#00baff', size: 'Scale in'  },
  { min: 8,  max: 10, label: 'HIGH CONVICTION',  color: '#00e8b0', size: 'Full size' },
  { min: 6,  max: 7,  label: 'CAUTION',          color: '#ffbe00', size: '½ size'   },
];

function PairsSection({ title, color, groups, watchPairs, onToggle, onToggleGroup }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 10, padding: 16,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color, marginBottom: 14 }}>{title}</div>
      {Object.entries(groups).map(([cat, pairs]) => (
        <div key={cat} style={{ marginBottom: 12 }}>
          <div style={{
            fontSize: 8, color: T.muted, letterSpacing: '0.1em', marginBottom: 6,
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span>{cat.toUpperCase()}</span>
            <span
              style={{ cursor: 'pointer', color, fontSize: 8 }}
              onClick={() => onToggleGroup(pairs)}
            >toggle all</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {pairs.map(p => {
              const on = watchPairs.includes(p);
              // Display label: strip .NS/.BO and ^ from Indian symbols
              const label = p.replace('.NS','').replace('.BO','').replace('^','');
              return (
                <button key={p}
                  onClick={() => onToggle(p, on)}
                  style={{
                    padding: '3px 8px', borderRadius: 5,
                    background: on ? fa(color) : 'transparent',
                    border: `1px solid ${on ? color : T.border}`,
                    color: on ? color : T.muted,
                    cursor: 'pointer', fontFamily: 'monospace', fontSize: 9,
                    fontWeight: on ? 700 : 400,
                  }}>{label}</button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SettingsTab() {
  const { settings, patchSettings } = useStore();

  async function save(patch) {
    patchSettings(patch);
    const next = { ...settings, ...patch };
    try {
      await Portfolio.updateSettings(next);
    } catch { toast.error('Settings save failed'); }
  }

  function togglePair(pair, currentlyOn) {
    save({
      watchPairs: currentlyOn
        ? settings.watchPairs.filter(x => x !== pair)
        : [...settings.watchPairs, pair],
    });
  }

  function toggleGroup(pairs) {
    const allIn = pairs.every(p => settings.watchPairs.includes(p));
    save({
      watchPairs: allIn
        ? settings.watchPairs.filter(p => !pairs.includes(p))
        : [...new Set([...settings.watchPairs, ...pairs])],
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Top row: Scanner config + conviction tiers ─────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* Scanner settings */}
        <div style={{
          background: T.card, border: `1px solid ${T.border}`,
          borderRadius: 10, padding: 16,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.accent, marginBottom: 14 }}>SCANNER</div>

          {/* Alert score threshold */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 9, color: T.muted }}>Alert Score Threshold</span>
              <span style={{ fontSize: 9, color: T.accent, fontWeight: 700 }}>≥ {settings.alertScore}/20</span>
            </div>
            <input type="range" min={4} max={20} step={1} value={settings.alertScore}
              onChange={e => save({ alertScore: +e.target.value })}
              style={{ width: '100%', accentColor: T.accent, cursor: 'pointer' }} />
          </div>

          {/* Toggles */}
          {[
            ['soundOn',   '🔊 Sound Alerts',    'Tones on new signals',              T.blue],
            ['notifOn',   '🔔 Notifications',   'Browser push (requires permission)', T.violet],
            ['autoClose', '⚡ Auto-Close',       'Server monitors SL/TP every 30s',  T.accent],
          ].map(([key, label, desc, col]) => (
            <label key={key} style={{
              display: 'flex', gap: 10, cursor: 'pointer',
              padding: '9px 0', borderBottom: `1px solid ${T.border}18`, alignItems: 'center',
            }}>
              <div
                onClick={() => save({ [key]: !settings[key] })}
                style={{
                  width: 36, height: 20, borderRadius: 10, flexShrink: 0,
                  background: settings[key] ? col : T.dim,
                  border: `1px solid ${settings[key] ? md(col) : T.border}`,
                  position: 'relative', transition: 'background .2s',
                }}>
                <div style={{
                  position: 'absolute', top: 3,
                  left: settings[key] ? 18 : 3,
                  width: 14, height: 14, borderRadius: '50%',
                  background: '#fff', transition: 'left .2s',
                }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: settings[key] ? T.text : T.muted, fontWeight: settings[key] ? 600 : 400 }}>{label}</div>
                <div style={{ fontSize: 8, color: T.muted }}>{desc}</div>
              </div>
            </label>
          ))}

          {/* Conviction tiers */}
          <div style={{ marginTop: 16, padding: 12, background: T.dim, borderRadius: 8 }}>
            <div style={{ fontSize: 8, color: T.muted, letterSpacing: '0.1em', marginBottom: 8 }}>CONVICTION TIERS</div>
            {TIERS.map(t => (
              <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <div style={{ width: 24, height: 4, background: t.color, borderRadius: 2 }} />
                <span style={{ fontSize: 8, color: t.color, fontWeight: 700 }}>{t.label}</span>
                <span style={{ fontSize: 7, color: T.muted }}>Score {t.min}{t.max < 99 ? `–${t.max}` : '+'} · {t.size}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Info panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            background: T.card, border: `1px solid ${T.border}`,
            borderRadius: 10, padding: 16, flex: 1,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.blue, marginBottom: 12 }}>HOW PAIRS WORK</div>
            {[
              ['Forex watchlist', 'These are scanned 24/5 whenever forex market is open (Sun 22:00 – Fri 22:00 UTC).', T.accent],
              ['Indian watchlist', 'Scanned only during NSE hours (Mon–Fri 9:15–15:30 IST). Symbols use Yahoo Finance format (.NS for NSE).', T.indigo],
              ['Dynamic pool', 'Chartink alerts and Yahoo screener add stocks automatically — they are scanned alongside your watchlist.', T.blue],
              ['Server-side', 'All scanning runs on the backend. Watchlist filters which signals appear in your dashboard.', T.muted],
            ].map(([title, desc, color]) => (
              <div key={title} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color, marginBottom: 2 }}>{title}</div>
                <div style={{ fontSize: 8, color: T.muted, lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Forex pairs ───────────────────────────────────────────────── */}
      <PairsSection
        title="FOREX · METALS · INDICES"
        color={T.blue}
        groups={PAIRS_WATCH}
        watchPairs={settings.watchPairs}
        onToggle={togglePair}
        onToggleGroup={toggleGroup}
      />

      {/* ── Indian pairs ──────────────────────────────────────────────── */}
      <PairsSection
        title="🇮🇳 INDIAN MARKET (NSE)"
        color={T.indigo}
        groups={INDIA_PAIRS_WATCH}
        watchPairs={settings.watchPairs}
        onToggle={togglePair}
        onToggleGroup={toggleGroup}
      />

      {/* ── Note ─────────────────────────────────────────────────────── */}
      <div style={{
        background: fa(T.indigo), border: `1px solid ${md(T.indigo)}`,
        borderRadius: 8, padding: '10px 14px', fontSize: 8, color: T.muted, lineHeight: 1.7,
      }}>
        <span style={{ color: T.indigo, fontWeight: 700 }}>Indian symbols: </span>
        Indices use Yahoo caret format (^NSEI = Nifty 50, ^NSEBANK = Bank Nifty).
        Stocks use .NS suffix (RELIANCE.NS). These resolve directly to Yahoo Finance — no extra mapping needed.
        Chartink webhooks add symbols dynamically on top of this static list.
      </div>

    </div>
  );
}
