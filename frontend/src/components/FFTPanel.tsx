import { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import type { SimResult } from '../api';

export function FFTPanel({ r }: { r: SimResult | null }) {
  const keys = r ? Object.keys(r.fft) : [];
  const [sig, setSig] = useState('Is');
  const [hmax, setHmax] = useState(25);
  const [pct, setPct] = useState(true);
  useEffect(() => { if (keys.length && !keys.includes(sig)) setSig(keys.includes('Is') ? 'Is' : keys[0]); }, [keys.join(), sig]);
  const h = r?.fft[sig];
  const view = useMemo(() => {
    if (!h) return null;
    const H = Math.min(hmax, h.order.length - 1);
    const vals = (pct ? (h.percent_of_fundamental ?? h.peak) : h.peak).slice(1, H + 1);
    const thd = h.fundamental_peak > 1e-9 ? Math.sqrt(h.peak.slice(2, H + 1).reduce((a, b) => a + b * b, 0)) / h.fundamental_peak * 100 : null;
    return { orders: h.order.slice(1, H + 1), vals, thd, H };
  }, [h, hmax, pct]);
  if (!r || !h || !view) return <div className="h-full flex items-center justify-center text-slate-500">Run the simulation to see the spectrum</div>;
  const base = r.kind === 'ac' ? 'line frequency' : r.kind === 'inv' ? 'output frequency' : 'switching frequency';
  const opt = {
    backgroundColor: 'transparent', animation: false, grid: { left: 56, right: 16, top: 16, bottom: 30 },
    tooltip: { trigger: 'axis', backgroundColor: '#0f172a', textStyle: { color: '#e2e8f0' } },
    xAxis: { type: 'category', data: view.orders.map((o) => `H${o}`), axisLabel: { color: '#94a3b8', interval: view.H > 25 ? 1 : 0 } },
    yAxis: { type: 'value', name: pct ? '% of H1' : 'peak', nameTextStyle: { color: '#94a3b8' }, axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: '#1e293b' } } },
    series: [{ type: 'bar', data: view.vals, itemStyle: { color: '#38bdf8' } }],
  };
  return (
    <div className="h-full flex flex-col text-xs">
      <div className="flex flex-wrap items-center gap-3 px-3 py-1.5 border-b border-slate-800">
        <select value={sig} onChange={(e) => setSig(e.target.value)} className="bg-slate-950 border border-slate-700 rounded px-1 py-0.5">{keys.map((s) => <option key={s}>{s}</option>)}</select>
        <label>Max harmonic <input type="number" min={2} max={h.order.length - 1} value={hmax} onChange={(e) => setHmax(Math.max(2, Math.min(h.order.length - 1, +e.target.value || 2)))} className="w-14 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 ml-1" /></label>
        <label><input type="checkbox" checked={pct} onChange={(e) => setPct(e.target.checked)} /> % of fundamental</label>
        <span className="text-slate-500">H1 = {base}</span>
        <span className="ml-auto font-mono text-slate-300">DC {h.dc.toFixed(2)} · H1 {h.fundamental_peak.toFixed(2)} pk · THD {view.thd != null ? view.thd.toFixed(1) + ' %' : '—'}</span>
      </div>
      <ReactECharts className="flex-1 min-h-0" style={{ height: '100%' }} option={opt} />
    </div>
  );
}
