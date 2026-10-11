import type { Params, TopologySpec } from '../api';

const ADV = new Set(['dt', 'n_cycles', 'spc', 'spc_c', 'pulse_deg']);

interface Props { spec: TopologySpec; p: Params; set: (p: Params) => void; auto: boolean; setAuto: (b: boolean) => void }

export function ControlPanel({ spec, p, set, auto, setAuto }: Props) {
  const inp = 'w-24 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-right font-mono text-sm focus:outline-none focus:border-sky-500';
  const hero = spec.sweep ? spec.params.find((q) => q.key === spec.sweep!.key) : undefined;
  const row = (q: (typeof spec.params)[number]) => q.type === 'select' ? (
    <label key={q.key} className="flex items-center justify-between gap-2 text-slate-300">
      <span>{q.label}</span>
      <select value={p[q.key] as string} onChange={(e) => set({ ...p, [q.key]: e.target.value })} className="bg-slate-950 border border-slate-700 rounded px-1 py-1 text-xs max-w-[130px]">
        {q.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
    </label>) : (
    <label key={q.key} className="flex items-center justify-between gap-2 text-slate-300">
      <span>{q.label}</span>
      <span className="flex items-center gap-1">
        <input type="number" className={inp} step={q.step} min={q.min} max={q.max} value={p[q.key] as number}
          onChange={(e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) set({ ...p, [q.key]: v }); }} />
        <span className="w-8 text-slate-500 text-xs">{q.unit}</span>
      </span>
    </label>);
  return (
    <div className="p-3 space-y-3 text-sm overflow-y-auto h-full">
      <h3 className="text-xs uppercase tracking-wider text-slate-400">Parameters</h3>
      {hero && (
        <div>
          <div className="flex justify-between text-slate-300"><span>{hero.label}</span>
            <span className="font-mono text-emerald-400">{(p[hero.key] as number).toFixed(hero.step < 1 ? 2 : 0)}{hero.unit}</span></div>
          <input type="range" min={hero.min} max={hero.max} step={hero.step} value={p[hero.key] as number} className="w-full accent-emerald-500"
            onChange={(e) => set({ ...p, [hero.key]: +e.target.value })} />
        </div>)}
      {spec.params.filter((q) => q !== hero && !ADV.has(q.key)).map(row)}
      {spec.flags.map((f) => (
        <label key={f.key} className="flex items-center gap-2 text-slate-300"><input type="checkbox" checked={!!p[f.key]} onChange={(e) => set({ ...p, [f.key]: e.target.checked })} />{f.label}</label>))}
      <details className="text-slate-400"><summary className="cursor-pointer text-xs uppercase tracking-wider">Simulation settings</summary>
        <div className="space-y-2 mt-2">{spec.params.filter((q) => ADV.has(q.key)).map(row)}</div></details>
      <label className="flex items-center gap-2 text-slate-300"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />Re-run on change</label>
    </div>
  );
}
