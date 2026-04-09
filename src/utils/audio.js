export function playAlert(grade) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const freqs = grade === 'A+' ? [880, 1100, 1320]
                : grade === 'A'  ? [660, 880]
                : grade === 'B'  ? [440, 550]
                : [330];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.value = f; osc.type = 'sine';
      g.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.15);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.3);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.35);
    });
  } catch {}
}
