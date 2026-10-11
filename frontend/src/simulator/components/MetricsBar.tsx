import { MetricResults } from '../types';

interface Props {
  metrics: MetricResults;
}

export function MetricsBar({ metrics }: Props) {
  const items = [
    { label: 'Vdc (Avg)', val: `${metrics.vdc} V`, color: 'text-emerald-400' },
    { label: 'Vrms', val: `${metrics.vrms} V`, color: 'text-emerald-300' },
    { label: 'Idc (Avg)', val: `${metrics.idc} A`, color: 'text-cyan-400' },
    { label: 'Irms', val: `${metrics.irms} A`, color: 'text-cyan-300' },
    { label: 'Power (Avg)', val: `${metrics.pavg} W`, color: 'text-amber-400' },
    { label: 'Power Factor', val: `${metrics.pf}`, color: 'text-purple-400' },
    { label: 'Ripple Factor', val: `${metrics.rf}`, color: 'text-rose-400' },
    { label: 'Form Factor', val: `${metrics.ff}`, color: 'text-sky-400' },
    { label: 'Efficiency', val: `${metrics.eff} %`, color: 'text-green-400' },
    { label: 'THD (V)', val: `${metrics.thd_v} %`, color: 'text-orange-400' },
    { label: 'THD (I)', val: `${metrics.thd_i} %`, color: 'text-pink-400' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-2 bg-slate-900 border border-slate-800 rounded-lg p-2.5">
      {items.map((it) => (
        <div key={it.label} className="flex flex-col items-center justify-center p-1.5 rounded bg-slate-950 border border-slate-800/80">
          <span className="text-[10px] text-slate-400 font-sans tracking-wide uppercase">{it.label}</span>
          <span className={`text-xs font-mono font-bold mt-0.5 ${it.color}`}>{it.val}</span>
        </div>
      ))}
    </div>
  );
}
