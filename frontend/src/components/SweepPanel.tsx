import { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { sweep, type Params, type SweepPoint, type TopologySpec } from '../api';

export function SweepPanel({ spec, p }: { spec: TopologySpec; p: Params }) {
  const [pts, setPts] = useState<SweepPoint[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { setPts(null); setErr(''); }, [spec.id]);
  const sw = spec.sweep;
  if (!sw) return <div className="h-full flex items-center justify-center text-slate-500 text-sm">No parameter sweep defined for this topology</div>;
  const run = async () => {
    setBusy(true); setErr('');
    try { const r = await sweep(spec.id, p); if (!r.success) throw new Error(r.error); setPts(r.points); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const opt = pts && {
    backgroundColor: 'transparent', animation: false, tooltip: { trigger: 'axis', backgroundColor: '#0f172a', textStyle: { color: '#e2e8f0' } },
    legend: { textStyle: { color: '#cbd5e1' }, top: 0 }, grid: { left: 56, right: 16, top: 30, bottom: 36 },
    xAxis: { type: 'value', name: sw.label, min: sw.start, max: sw.stop, nameLocation: 'middle', nameGap: 22, nameTextStyle: { color: '#94a3b8' }, axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { type: 'value', name: sw.ylabel ?? 'Vo avg (V)', nameTextStyle: { color: '#94a3b8' }, axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: '#1e293b' } } },
    series: [
      { name: 'Simulated', type: 'line', symbolSize: 6, data: pts.map((q) => [q.x, q.y_sim]), itemStyle: { color: '#34d399' } },
      { name: 'Theory', type: 'line', showSymbol: false, lineStyle: { type: 'dashed' }, data: pts.map((q) => [q.x, q.y_theory]), itemStyle: { color: '#38bdf8' } },
    ],
  };
  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-1.5 border-b border-slate-800 text-xs flex items-center gap-3">
        <button onClick={run} disabled={busy} className="px-3 py-1 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white">{busy ? 'Sweeping…' : `Sweep ${sw.label}: ${sw.start} → ${sw.stop}`}</button>
        <span className="text-slate-500">{sw.points} full simulations with the current parameters</span>{err && <span className="text-red-400">{err}</span>}
      </div>
      {opt ? <ReactECharts className="flex-1 min-h-0" style={{ height: '100%' }} option={opt} /> : <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">{sw.ylabel ?? 'Vo_avg'} vs {sw.label}</div>}
    </div>
  );
}
