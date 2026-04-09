import { useState } from 'react';
import useStore from '../store/useStore';
import { KPI, Spark } from '../components/Atoms';
import { T, fa, md } from '../utils/format';
import { Portfolio } from '../api/endpoints';
import toast from 'react-hot-toast';

const DD_TIERS = [
  { pct: 0.08, mult: 0.5,  label: 'Caution', col: '#ffbe00' },
  { pct: 0.12, mult: 0.25, label: 'Danger',  col: '#ff7820' },
  { pct: 0.18, mult: 0,    label: 'Halt',     col: '#ff1e3c' },
];

export default function PortfolioTab() {
  const { portfolio, setPortfolio } = useStore();
  const [resetting, setResetting] = useState(false);

  if (!portfolio) {
    return <div style={{ textAlign: 'center', padding: 60, color: T.muted, fontSize: 12 }}>Loading portfolio…</div>;
  }

  const { balance, peakBalance, equityCurve, totalTrades, wins, losses, partials } = portfolio;
  const STARTING_BAL = 10_000;
  const ddPct  = peakBalance > 0 ? +((peakBalance - balance) / peakBalance * 100).toFixed(1) : 0;
  const ddTier = DD_TIERS.find(t => ddPct / 100 >= t.pct);
  const ddColor= ddTier?.col ?? T.accent;
  const retPct = +((balance / STARTING_BAL - 1) * 100).toFixed(1);
  const balCol = balance >= STARTING_BAL ? T.accent : T.red;
  const closed = (wins || 0) + (losses || 0) + (partials || 0);
  const wr     = closed ? +((wins / closed) * 100).toFixed(1) : 0;

  async function handleReset() {
    if (!confirm('Reset portfolio to $10,000? This cannot be undone.')) return;
    setResetting(true);
    try {
      const r = await Portfolio.reset();
      setPortfolio({ ...portfolio, balance: 10000, peakBalance: 10000, equityCurve: [10000] });
      toast.success('Portfolio reset to $10,000');
    } catch {
      toast.error('Reset failed');
    } finally {
      setResetting(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        <KPI label="BALANCE"      value={`$${balance.toLocaleString()}`}   color={balCol} spark={equityCurve} />
        <KPI label="TOTAL RETURN" value={`${retPct >= 0 ? '+' : ''}${retPct}%`} color={balCol} />
        <KPI label="PEAK BALANCE" value={`$${peakBalance.toLocaleString()}`} color={T.yellow} />
        <KPI label="DRAWDOWN"     value={`${ddPct}%`} color={ddColor} />
        <KPI label="TRADES"       value={totalTrades || 0} color={T.blue} sub={`${wins || 0}W · ${losses || 0}L`} />
        <KPI label="WIN RATE"     value={`${wr}%`} color={wr >= 50 ? T.accent : T.red} />
        <KPI label="WINS"         value={wins || 0} color={T.accent} />
        <KPI label="LOSSES"       value={losses || 0} color={T.red} />
      </div>

      {/* Equity curve */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: T.muted, letterSpacing: '0.1em' }}>EQUITY CURVE</div>
          <button onClick={handleReset} disabled={resetting}
            style={{ fontSize: 8, color: T.red, background: 'transparent', border: `1px solid ${T.red}44`, borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontFamily: 'monospace' }}>
            {resetting ? '…' : 'Reset Portfolio'}
          </button>
        </div>
        <Spark data={equityCurve} color={balCol} h={130} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
          <span style={{ fontSize: 8, color: T.muted }}>Start: $10,000</span>
          <span style={{ fontSize: 8, color: balCol }}>Now: ${balance.toLocaleString()}</span>
        </div>
      </div>

      {/* DD tiers */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 9, color: T.muted, marginBottom: 10, letterSpacing: '0.1em' }}>DRAWDOWN PROTECTION</div>
        {[{ pct: 0, label: 'Normal', mult: 1, col: T.accent }, ...DD_TIERS].map(tier => {
          const active = tier.label === 'Normal' ? !ddTier : ddTier?.label === tier.label;
          return (
            <div key={tier.label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 10px', background: active ? fa(tier.col) : 'transparent',
              borderRadius: 7, marginBottom: 4,
              border: `1px solid ${active ? md(tier.col) : T.border + '44'}`,
            }}>
              <span style={{ fontSize: 9, color: tier.col, fontWeight: active ? 700 : 400 }}>{tier.label}</span>
              <span style={{ fontSize: 8, color: T.muted }}>
                {tier.pct === 0 ? '< 8%' : tier.label === 'Caution' ? '8–12%' : tier.label === 'Danger' ? '12–18%' : '≥ 18%'}
              </span>
              <span style={{ fontSize: 9, color: tier.col, fontWeight: 700 }}>
                {tier.mult === 0 ? 'HALT' : `${(tier.mult * 100).toFixed(0)}% Kelly`}
              </span>
              {active && <span style={{ fontSize: 7, padding: '2px 6px', background: fa(tier.col), color: tier.col, border: `1px solid ${md(tier.col)}`, borderRadius: 3, fontWeight: 700 }}>ACTIVE</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
