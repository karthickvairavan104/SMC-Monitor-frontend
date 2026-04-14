import { useState } from 'react';
import { Pill, ScoreRing, QualityBar } from './Atoms';
import { T, fa, md, gc, fmtTime, priceDec, isIndianSignal, signalSource } from '../utils/format';
import { Signals } from '../api/endpoints';
import useStore from '../store/useStore';
import toast from 'react-hot-toast';

export default function SignalCard({ sig, isNew }) {
  const [expanded, setExpanded] = useState(false);
  const [closing,  setClosing]  = useState(false);
  const closeSignalStore = useStore(s => s.closeSignal);

  const dec        = priceDec(sig.pair);
  const col        = sig.isBull ? T.accent : T.red;
  const regColor   = sig.regime === 'trending' ? T.accent : sig.regime === 'volatile' ? T.red : T.yellow;
  const isClosed   = sig.status === 'CLOSED';
  const outcomeCol = sig.outcome === 'win' ? T.accent : sig.outcome === 'partial' ? T.yellow : sig.outcome === 'loss' ? T.red : T.muted;
  const isIndia    = isIndianSignal(sig);
  const source     = isIndia ? signalSource(sig) : null;

  async function handleClose(outcome) {
    setClosing(true);
    try {
      await Signals.close(sig.id, outcome);
      closeSignalStore(sig.id, outcome);
      toast.success(`${sig.pair} logged as ${outcome.toUpperCase()}`);
    } catch {
      toast.error('Failed to close signal');
    } finally {
      setClosing(false);
    }
  }

  const bdLabels = {
    bos: 'BoS', choch: 'CHoCH', fvg: 'FVG', ob: 'OB', mtf: 'MTF',
    liqSweep: 'Sweep', session: 'Session', news: 'News', momentum: 'Mom',
    idm: 'IDM', breaker: 'Breaker', ote: 'OTE', zoneAge: 'Age',
    obSes: 'OB Ses', closeConf: 'Close', pd: 'P/D', volume: 'Volume',
  };
  const bdColors = {
    bos: T.blue, choch: T.violet, fvg: T.teal, ob: T.accent, mtf: T.yellow,
    liqSweep: T.pink, session: T.lime, news: T.amber, momentum: T.orange,
    idm: T.pink, breaker: T.violet, ote: T.violet, zoneAge: T.teal,
    obSes: T.lime, closeConf: T.teal, pd: T.blue, volume: T.orange,
  };

  // Display pair label — strip Yahoo suffixes for Indian stocks
  const pairLabel = sig.pair
    ?.replace('.NS', '').replace('.BO', '').replace('^', '') || sig.pair;

  return (
    <div
      onClick={() => setExpanded(e => !e)}
      style={{
        background: T.card,
        border: `1px solid ${isNew ? T.accent : isClosed ? T.border + '88' : isIndia ? T.indigo + '55' : T.border}`,
        borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
        opacity: isClosed ? 0.6 : 1,
        animation: isNew ? 'signalAppear .5s ease-out' : undefined,
        transition: 'border-color .4s, opacity .3s',
      }}
    >
      {/* ── India / Chartink source badge ─────────────────────────── */}
      {isIndia && source && (
        <div style={{
          fontSize: 7, color: T.indigo, fontWeight: 700,
          marginBottom: 6, letterSpacing: '0.05em',
        }}>
          ⚡ {source}
        </div>
      )}

      {/* ── Header row ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <ScoreRing score={sig.score} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{pairLabel}</span>
            {isIndia && <Pill label="🇮🇳 NSE" color={T.indigo} sz={7} />}
            <Pill label={sig.isBull ? '▲ BUY' : '▼ SELL'} color={col} sz={9} />
            <Pill label={sig.grade} color={gc(sig.grade)} sz={9} />
            {isNew && <Pill label="NEW" color={T.accent} sz={8} />}
            {isClosed && sig.outcome && (
              <Pill label={sig.outcome.toUpperCase()} color={outcomeCol} sz={8} />
            )}
            {sig.autoClose && <Pill label="AUTO" color={T.blue} sz={7} />}
          </div>
          <div style={{ display: 'flex', gap: 10, fontSize: 9, color: T.muted, flexWrap: 'wrap' }}>
            <span style={{ color: sig.ltfDir === 'bull' ? T.accent : sig.ltfDir === 'bear' ? T.red : T.muted }}>LTF:{sig.ltfDir}</span>
            <span style={{ color: sig.htfDir === 'bull' ? T.accent : sig.htfDir === 'bear' ? T.red : T.muted }}>HTF:{sig.htfDir}</span>
            <span style={{ color: sig.pdZone === 'discount' ? T.accent : sig.pdZone === 'premium' ? T.red : T.muted }}>P/D:{sig.pdZone}</span>
            <span style={{ color: regColor }}>{sig.regime}</span>
            <span>{sig.session}</span>
            <span style={{ marginLeft: 'auto', color: T.muted }}>{fmtTime(sig.createdAt)}</span>
          </div>
          <QualityBar score={sig.score} />
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.text }}>{sig.entry?.toFixed(dec)}</div>
          <div style={{ fontSize: 8, color: T.muted }}>Entry</div>
        </div>
      </div>

      {/* ── Signal badges ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
        {sig.hasOB         && <Pill label="OB"           color={T.accent}  />}
        {sig.hasFVG        && <Pill label="FVG"          color={T.blue}    />}
        {sig.sweep         && <Pill label="★Sweep"       color={T.pink}    />}
        {sig.choch         && <Pill label="CHoCH"        color={T.violet}  />}
        {sig.isBreaker     && <Pill label="BREAKER"      color={T.violet}  />}
        {sig.idmConfirmed  && <Pill label="IDM ✓"        color={T.pink}    />}
        {!sig.idmConfirmed && sig.hasOB && <Pill label="⚠ IDM?" color={T.red} />}
        {sig.inOTE         && <Pill label={`OTE ${((sig.oteFibPct||0)*100).toFixed(0)}%`} color={T.violet} />}
        {sig.candleClose   && <Pill label="Close ✓"      color={T.teal}    />}
        {sig.volumeQuiet   && <Pill label="⚠ Low Vol"    color={T.orange}  />}
        {sig.slMethod === 'smart' && <Pill label="Smart SL" color={T.teal} />}
        {sig.regime === 'ranging'  && <Pill label="⚠ Ranging" color={T.yellow} />}
      </div>

      {/* ── Expanded detail ────────────────────────────────────────── */}
      {expanded && (
        <div style={{ marginTop: 10, borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>

          {/* SL / TP grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 10 }}>
            {[['SL', sig.sl?.toFixed(dec), T.red],
              ['TP1 (2R)', sig.tp1?.toFixed(dec), T.accent],
              ['TP2', sig.tp2?.toFixed(dec), T.blue]].map(([l, v, c]) => (
              <div key={l} style={{ background: T.dim, borderRadius: 6, padding: '6px 8px' }}>
                <div style={{ fontSize: 7, color: T.muted }}>{l}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: c }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Score breakdown */}
          {sig.breakdown && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '2px 10px', marginBottom: 10 }}>
              {Object.entries(sig.breakdown).map(([k, v]) => {
                const isPos = v > 0, isNeg = v < 0;
                return (
                  <div key={k} style={{
                    display: 'flex', justifyContent: 'space-between', fontSize: 8,
                    background: isPos ? fa(bdColors[k] || T.muted) : isNeg ? fa(T.red) : 'transparent',
                    borderRadius: 3, padding: '2px 5px',
                  }}>
                    <span style={{ color: T.muted }}>{bdLabels[k] || k}</span>
                    <span style={{ color: isPos ? bdColors[k] : isNeg ? T.red : T.muted, fontWeight: 700 }}>
                      {v > 0 ? `+${v}` : v}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Regime box */}
          <div style={{ background: fa(regColor), border: `1px solid ${md(regColor)}`, borderRadius: 7, padding: '6px 10px', fontSize: 8, marginBottom: 8 }}>
            <span style={{ color: regColor, fontWeight: 700 }}>Regime: </span>
            <span style={{ color: T.text }}>{sig.regime} </span>
            <span style={{ color: T.muted }}>
              {sig.regime === 'ranging' ? '— Score −0.8 · Kelly halved' :
               sig.regime === 'volatile' ? '— Score −0.5 · Elevated risk' :
               '— Trending · Full score applied'}
            </span>
          </div>

          {/* HTF liq label */}
          {sig.htfLiqLabel && (
            <div style={{ fontSize: 8, color: T.blue, marginBottom: 8 }}>
              TP2 target: {sig.htfLiqLabel}
            </div>
          )}

          {/* Source info for Indian signals */}
          {isIndia && (
            <div style={{ background: fa(T.indigo), border: `1px solid ${md(T.indigo)}`, borderRadius: 7, padding: '7px 10px', fontSize: 8, marginBottom: 8 }}>
              <span style={{ color: T.indigo, fontWeight: 700 }}>🇮🇳 NSE SIGNAL — </span>
              <span style={{ color: T.muted }}>
                {source ? `Surfaced by Chartink alert: "${source}". ` : 'Surfaced by Yahoo screener. '}
                Candle data from Yahoo Finance (.NS). ATR-based SL/TP applies.
              </span>
            </div>
          )}

          {/* Auto-close info */}
          <div style={{ background: fa(T.blue), border: `1px solid ${md(T.blue)}`, borderRadius: 7, padding: '7px 10px', fontSize: 8, marginBottom: 8 }}>
            <span style={{ color: T.blue, fontWeight: 700 }}>⚡ AUTO-CLOSE ON — </span>
            <span style={{ color: T.muted }}>Server monitors SL/TP every 30s. Use Force buttons below only to override.</span>
          </div>

          {/* Close buttons — only on LIVE signals */}
          {!isClosed && (
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              {[['win', '✓ Force WIN', T.accent], ['loss', '✗ Force LOSS', T.red], ['partial', '◐ Partial', T.yellow]].map(([outcome, label, color]) => (
                <button key={outcome}
                  onClick={e => { e.stopPropagation(); handleClose(outcome); }}
                  disabled={closing}
                  style={{
                    flex: 1, padding: '7px', borderRadius: 6,
                    background: fa(color), border: `1px solid ${md(color)}`,
                    color, fontFamily: 'monospace', fontSize: 10,
                    cursor: closing ? 'not-allowed' : 'pointer', fontWeight: 700,
                    opacity: closing ? 0.5 : 1,
                  }}>{label}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
