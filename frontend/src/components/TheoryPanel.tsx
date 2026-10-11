import type { SimResult } from '../api';
import { THEORY } from '../theoryText';

const Eq = ({ children }: { children: string }) => <div className="font-mono text-sky-300 bg-slate-950 border border-slate-800 rounded px-2 py-1 my-1 overflow-x-auto whitespace-pre">{children}</div>;

export function TheoryPanel({ tid, r }: { tid: string; r: SimResult | null }) {
  const d = THEORY[tid]; const t = r?.theory;
  if (!d) return null;
  const fmt = (x: unknown, dec = 2, u = '') => (typeof x === 'number' && Number.isFinite(x) ? `${x.toFixed(dec)}${u}` : '—');
  return (
    <div className="p-4 text-sm text-slate-300 space-y-2 overflow-y-auto h-full leading-relaxed">
      <h3 className="text-base font-semibold text-slate-100">{d.title}</h3>
      <p><b>Operating principle.</b> {d.principle}</p>
      <p><b>Switching / conduction sequence.</b> {d.sequence}</p>
      <p><b>Equations</b></p>
      {d.equations.map((e, i) => <Eq key={i}>{e}</Eq>)}
      <p><b>Applications.</b> {d.applications}</p>
      <p><b>Advantages.</b> {d.pros}</p>
      <p><b>Disadvantages.</b> {d.cons}</p>
      {t && (
        <div className="border-t border-slate-800 pt-2">
          <h4 className="text-xs uppercase tracking-wider text-slate-400">Live values for the current parameters</h4>
          <div className="font-mono text-xs grid grid-cols-2 gap-x-4">
            <span>mode = {t.mode ?? '—'}</span>
            {t.Z !== undefined && <span>Z = {fmt(t.Z, 2, ' Ω')}, φ = {fmt(t.phi_deg, 1, '°')}</span>}
            {t.extinction_deg != null && <span>β = {fmt(t.extinction_deg, 1, '°')}</span>}
            {t.L_crit_uh !== undefined && <span>L_crit = {fmt(t.L_crit_uh, 1, ' µH')}</span>}
            {t.gain !== undefined && <span>gain Vo/Vin = {fmt(t.gain, 3)}</span>}
            {t.V1_pk !== undefined && <span>V1 (ideal) = {fmt(t.V1_pk, 1, ' V pk')}</span>}
            {t.thd_v != null && <span>THD Vo / Io (ideal) = {fmt(t.thd_v, 1, ' %')} / {fmt(t.thd_i, 1, ' %')}</span>}
            {t.ripple_pp != null && <span>ripple (theory) = {fmt(t.ripple_pp, 2, ' V p-p')}</span>}
          </div>
          {t.note && <p className="text-xs text-slate-500 mt-1">{t.note}</p>}
        </div>)}
    </div>
  );
}
