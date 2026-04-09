import useStore from '../store/useStore';
import { KPI } from '../components/Atoms';
import { T, gc, fmtDate, fmtTime } from '../utils/format';

export default function TradesTab() {
  const journal = useStore(s => s.journal);

  const closed   = journal.filter(j => j.outcome);
  const wins     = closed.filter(j => j.outcome === 'win');
  const losses   = closed.filter(j => j.outcome === 'loss');
  const partials = closed.filter(j => j.outcome === 'partial');
  const wr       = closed.length ? +((wins.length / closed.length) * 100).toFixed(1) : 0;
  const totalPnl = closed.reduce((s, j) => s + (j.pnl || 0), 0);

  // Per-pair breakdown
  const byPair = {};
  closed.forEach(j => {
    if (!byPair[j.pair]) byPair[j.pair] = { w: 0, l: 0, p: 0, pnl: 0 };
    if (j.outcome === 'win')     byPair[j.pair].w++;
    if (j.outcome === 'loss')    byPair[j.pair].l++;
    if (j.outcome === 'partial') byPair[j.pair].p++;
    byPair[j.pair].pnl += (j.pnl || 0);
  });

  const pnlColor = totalPnl >= 0 ? T.accent : T.red;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        <KPI label="TOTAL TRADES" value={closed.length} color={T.blue} sub="closed" />
        <KPI label="WINS"         value={wins.length}   color={T.accent} sub={`${wr}% win rate`} />
        <KPI label="LOSSES"       value={losses.length} color={T.red} />
        <KPI label="PARTIALS"     value={partials.length} color={T.yellow} />
      </div>

      {/* Distribution bar */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 9, color: T.muted, letterSpacing: '0.1em', marginBottom: 10 }}>WIN / LOSS DISTRIBUTION</div>
        {closed.length > 0 ? (
          <>
            <div style={{ display: 'flex', height: 20, borderRadius: 6, overflow: 'hidden', gap: 1 }}>
              <div style={{ flex: wins.length,     background: T.accent, minWidth: wins.length ? 4 : 0 }} />
              <div style={{ flex: partials.length, background: T.yellow, minWidth: partials.length ? 4 : 0 }} />
              <div style={{ flex: losses.length,   background: T.red,    minWidth: losses.length ? 4 : 0 }} />
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 8 }}>
              <span style={{ color: T.accent }}>■ Win {wins.length} ({closed.length ? ((wins.length/closed.length)*100).toFixed(0) : 0}%)</span>
              <span style={{ color: T.yellow }}>■ Partial {partials.length}</span>
              <span style={{ color: T.red }}>■ Loss {losses.length}</span>
              <span style={{ marginLeft: 'auto', color: pnlColor, fontWeight: 700 }}>
                Net: {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
              </span>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', color: T.muted, fontSize: 11, padding: 24 }}>
            No closed trades yet — server auto-closes at SL / TP.
          </div>
        )}
      </div>

      {/* Per-pair table */}
      {Object.keys(byPair).length > 0 && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 9, color: T.muted, letterSpacing: '0.1em', marginBottom: 10 }}>RESULTS BY PAIR</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                {['PAIR', 'W', 'L', 'P', 'WR %', 'NET P&L'].map(h => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 7, color: T.muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(byPair).sort((a,b) => b[1].pnl - a[1].pnl).map(([pair, d]) => {
                const t = d.w + d.l + d.p;
                const wrPct = t ? ((d.w / t) * 100).toFixed(0) : '-';
                return (
                  <tr key={pair} style={{ borderBottom: `1px solid ${T.border}18` }}>
                    <td style={{ padding: '7px 10px', fontWeight: 700, color: T.text }}>{pair}</td>
                    <td style={{ padding: '7px 10px', color: T.accent, fontWeight: 700 }}>{d.w}</td>
                    <td style={{ padding: '7px 10px', color: T.red,    fontWeight: 700 }}>{d.l}</td>
                    <td style={{ padding: '7px 10px', color: T.yellow, fontWeight: 700 }}>{d.p}</td>
                    <td style={{ padding: '7px 10px', color: +wrPct >= 50 ? T.accent : T.red, fontWeight: 700 }}>{wrPct}%</td>
                    <td style={{ padding: '7px 10px', color: d.pnl >= 0 ? T.accent : T.red, fontWeight: 700 }}>
                      {d.pnl >= 0 ? '+' : ''}${d.pnl.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Grade breakdown */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 9, color: T.muted, letterSpacing: '0.1em', marginBottom: 10 }}>RESULTS BY GRADE</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
          {['A+', 'A', 'B', 'C', 'D'].map(g => {
            const gs  = journal.filter(j => j.grade === g && j.outcome);
            const gw  = gs.filter(j => j.outcome === 'win').length;
            const wr2 = gs.length ? ((gw / gs.length) * 100).toFixed(0) : '-';
            const pnl = gs.reduce((s, j) => s + (j.pnl || 0), 0);
            return (
              <div key={g} style={{ background: T.dim, borderRadius: 8, padding: 10, border: `1px solid ${gc(g)}22` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: gc(g) }}>{g}</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 3 }}>{gs.length}</div>
                <div style={{ fontSize: 8, color: +wr2 >= 50 ? T.accent : T.red }}>{wr2}% WR</div>
                <div style={{ fontSize: 7, color: pnl >= 0 ? T.accent : T.red, marginTop: 2 }}>
                  {pnl >= 0 ? '+' : ''}${pnl.toFixed(0)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
