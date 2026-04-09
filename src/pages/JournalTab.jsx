import useStore from '../store/useStore';
import { Pill } from '../components/Atoms';
import { T, gc, fmtDate, fmtTime } from '../utils/format';
import { Journal } from '../api/endpoints';
import toast from 'react-hot-toast';

export default function JournalTab() {
  const { journal, setJournal } = useStore();

  async function handleClear() {
    if (!confirm('Clear all journal entries?')) return;
    try {
      await Journal.clear();
      setJournal([]);
      toast.success('Journal cleared');
    } catch { toast.error('Failed to clear journal'); }
  }

  function exportCSV() {
    const rows = [
      ['DATE','PAIR','DIR','ENTRY','SL','TP1','TP2','SCORE','GRADE','SESSION','OUTCOME','P&L','KELLY%','CLOSE TYPE'].join(','),
      ...journal.map(j => [
        fmtDate(j.createdAt), j.pair, j.isBull ? 'BUY' : 'SELL',
        j.entry, j.sl, j.tp1, j.tp2, j.score, j.grade,
        j.session ?? '-', j.outcome ?? '-',
        j.pnl ?? 0, j.kellyPct ?? '-',
        j.autoClose ? 'AUTO' : 'Manual',
      ].join(','))
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `smc_journal_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const outcomeColor = o => o === 'win' ? T.accent : o === 'partial' ? T.yellow : o === 'loss' ? T.red : T.muted;

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
        <div style={{ fontSize: 9, color: T.muted }}>{journal.length} entries</div>
        <button onClick={exportCSV} disabled={!journal.length}
          style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 6, background: 'transparent', color: T.blue, border: `1px solid ${T.blue}55`, fontFamily: 'monospace', fontSize: 9, cursor: 'pointer', fontWeight: 700 }}>
          ↓ Export CSV
        </button>
        <button onClick={handleClear}
          style={{ padding: '6px 12px', borderRadius: 6, background: 'transparent', color: T.red, border: `1px solid ${T.red}44`, fontFamily: 'monospace', fontSize: 9, cursor: 'pointer' }}>
          Clear
        </button>
      </div>

      {journal.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: T.muted, fontSize: 12 }}>
          No trades logged yet.
        </div>
      )}

      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
          <thead style={{ background: T.dim }}>
            <tr>
              {['DATE','PAIR','DIR','ENTRY','SCORE','GRADE','SESSION','OUTCOME','P&L','KELLY%','CLOSE'].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 7, color: T.muted, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {journal.map((j, k) => (
              <tr key={k} style={{ borderBottom: `1px solid ${T.border}10` }}>
                <td style={{ padding: '7px 10px', color: T.muted, fontSize: 8 }}>{fmtDate(j.createdAt)} {fmtTime(j.createdAt)}</td>
                <td style={{ padding: '7px 10px', fontWeight: 700, color: T.text }}>{j.pair}</td>
                <td style={{ padding: '7px 10px', color: j.isBull ? T.accent : T.red, fontWeight: 700 }}>{j.isBull ? '▲ BUY' : '▼ SELL'}</td>
                <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 8 }}>{j.entry}</td>
                <td style={{ padding: '7px 10px', minWidth: 70 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: `${(j.score / 20) * 40}px`, height: 4, background: gc(j.grade), borderRadius: 2 }} />
                    <span style={{ fontSize: 8, color: gc(j.grade) }}>{j.score?.toFixed(1)}</span>
                  </div>
                </td>
                <td style={{ padding: '7px 10px' }}><Pill label={j.grade} color={gc(j.grade)} sz={8} /></td>
                <td style={{ padding: '7px 10px', color: T.muted, fontSize: 8 }}>{j.session ?? '-'}</td>
                <td style={{ padding: '7px 10px', color: outcomeColor(j.outcome), fontWeight: 700 }}>{j.outcome?.toUpperCase() ?? '–'}</td>
                <td style={{ padding: '7px 10px', color: (j.pnl ?? 0) >= 0 ? T.accent : T.red, fontWeight: 700 }}>
                  {j.pnl != null ? `${j.pnl >= 0 ? '+' : ''}$${j.pnl}` : '–'}
                </td>
                <td style={{ padding: '7px 10px', color: T.muted, fontSize: 8 }}>{j.kellyPct ?? '-'}%</td>
                <td style={{ padding: '7px 10px' }}>
                  {j.autoClose
                    ? <span title={j.closeReason ?? ''} style={{ fontSize: 7, padding: '2px 6px', borderRadius: 3, background: T.blue + '16', color: T.blue, border: `1px solid ${T.blue}44`, fontWeight: 700, cursor: 'help' }}>AUTO</span>
                    : <span style={{ fontSize: 7, color: T.muted }}>Manual</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
