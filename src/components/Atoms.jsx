import { T, fa, md, MAX_SCORE } from '../utils/format';

export function Pill({ label, color = T.muted, sz = 8 }) {
  return (
    <span style={{
      background: fa(color), color, border: `1px solid ${md(color)}`,
      fontSize: sz, padding: '1px 6px', borderRadius: 3, fontWeight: 700,
      marginRight: 3, whiteSpace: 'nowrap',
    }}>{label}</span>
  );
}

export function ScoreRing({ score, size = 44 }) {
  const pct  = (score / MAX_SCORE) * 100;
  const r    = 16, circ = 2 * Math.PI * r;
  const col  = score >= 14 ? T.accent : score >= 11 ? T.blue
             : score >= 8  ? T.yellow : score >= 6  ? T.orange : T.muted;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ flexShrink: 0 }}>
      <circle cx="20" cy="20" r={r} fill="none" stroke={T.dim} strokeWidth="3" />
      <circle cx="20" cy="20" r={r} fill="none" stroke={col} strokeWidth="3"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct / 100)}
        strokeLinecap="round" transform="rotate(-90 20 20)" />
      <text x="20" y="20" textAnchor="middle" dominantBaseline="central"
        fontSize="9" fontWeight="700" fill={col} fontFamily="monospace">{score}</text>
    </svg>
  );
}

const TIERS = [
  { min: 11, label: 'PERFECT STORM',  color: '#00baff', size: 'Scale in'  },
  { min: 8,  label: 'HIGH CONVICTION',color: '#00e8b0', size: 'Full size' },
  { min: 6,  label: 'CAUTION',        color: '#ffbe00', size: '½ size'    },
];

export function QualityBar({ score }) {
  const tier = TIERS.find(t => score >= t.min);
  if (!tier) return null;
  const pct = Math.min((score / MAX_SCORE) * 100, 100);
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ height: 5, background: T.dim, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: tier.color, borderRadius: 3, transition: 'width .5s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        <span style={{ fontSize: 7, color: tier.color, fontWeight: 700 }}>{tier.label}</span>
        <span style={{ fontSize: 7, color: T.muted }}>{tier.size}</span>
      </div>
    </div>
  );
}

export function Spark({ data, color, h = 36 }) {
  if (!data || data.length < 2) return null;
  const W = 200, H = h, mn = Math.min(...data), mx = Math.max(...data), rng = mx - mn || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - mn) / rng) * (H - 4) - 2}`).join(' ');
  const id  = `sp${Math.random().toString(36).slice(2, 6)}`;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity=".3" />
          <stop offset="100%" stopColor={color} stopOpacity="0"  />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={pts} />
      <polygon  fill={`url(#${id})`} points={`0,${H} ${pts} ${W},${H}`} />
    </svg>
  );
}

export function KPI({ label, value, sub, color = T.text, spark, pulse }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${pulse ? T.accent : T.border}`,
      borderRadius: 10, padding: '11px 14px', position: 'relative', overflow: 'hidden',
    }}>
      {spark && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, opacity: .4 }}>
          <Spark data={spark} color={color} h={28} />
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 8, color: T.muted, letterSpacing: '0.1em' }}>{label}</div>
        <div style={{ fontSize: 19, fontWeight: 700, color, marginTop: 2 }}>{value}</div>
        {sub && <div style={{ fontSize: 8, color: T.muted, marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}
