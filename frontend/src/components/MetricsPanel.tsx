import type { SimResult } from '../api';

const n = (x: unknown, d = 2) => (typeof x === 'number' && Number.isFinite(x) ? x.toFixed(d) : '—');

export function MetricsPanel({ r }: { r: SimResult | null }) {
  if (!r) return <div className="p-4 text-slate-500 text-sm">No measurements yet</div>;
  return (
    <div className="p-3 text-sm space-y-3 overflow-y-auto h-full">
      <div>
        <h3 className="text-xs uppercase tracking-wider text-slate-400 mb-1">Theory vs simulation <span className="normal-case text-slate-500">({r.theory.mode})</span></h3>
        <table className="w-full font-mono text-xs">
          <thead><tr className="text-slate-500 text-right"><th className="text-left font-normal"></th><th className="font-normal">Theory</th><th className="font-normal">Sim</th><th className="font-normal">Δ %</th></tr></thead>
          <tbody>{r.table.map((row) => {
            const err = row.theory != null && row.theory !== 0 && row.sim != null ? ((row.sim - row.theory) / Math.abs(row.theory)) * 100 : null;
            return (<tr key={row.label} className="text-right border-t border-slate-800"><td className="text-left text-slate-300 font-sans">{row.label}</td>
              <td className="text-sky-300">{n(row.theory, 3)} {row.unit}</td><td className="text-emerald-300">{n(row.sim, 3)} {row.unit}</td>
              <td className={err != null && Math.abs(err) > 2 ? 'text-amber-400' : 'text-slate-400'}>{err != null ? err.toFixed(2) : '—'}</td></tr>);
          })}</tbody>
        </table>
        <p className="text-[11px] text-slate-500 mt-1">Theory is ideal; simulated devices carry a small on-resistance, so simulation sits slightly lower (more at high current / high gain).{r.theory.note ? ' ' + r.theory.note : ''}</p>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
        {r.other.map((o) => (<div key={o.label} className="flex justify-between border-b border-slate-800/60 py-0.5"><span className="text-slate-400">{o.label}</span>
          <span className="font-mono text-slate-200">{o.value == null && o.unit ? (o.unit.length > 3 ? o.unit : '—') : `${n(o.value, o.dec)} ${o.value == null ? '' : o.unit}`}</span></div>))}
        {r.fft[r.kind === 'ac' ? 'Is' : 'Iin'] && r.kind === 'ac' && (
          <div className="flex justify-between border-b border-slate-800/60 py-0.5"><span className="text-slate-400">THD (Is)</span><span className="font-mono text-slate-200">{n(r.fft.Is.thd_percent, 1)} %</span></div>)}
      </div>
    </div>
  );
}
