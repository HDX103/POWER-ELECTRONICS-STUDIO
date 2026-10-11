import type { SimResult } from '../api';

const col = (id: string, kind?: string) => (kind === 'inv' && id[0] === 'D' ? '#a78bfa' : /^[TDS](1|4)$/.test(id) ? '#34d399' : /^[TDS](2|3)$/.test(id) ? '#fb923c' : '#a78bfa');

export function ConductionTimeline({ r, cursorDeg }: { r: SimResult | null; cursorDeg: number }) {
  const ids = r?.devices ?? [];
  if (!r || !ids.length) return <div className="text-xs text-slate-500 py-2">—</div>;
  const W = 600, x = (d: number) => 40 + (d / 360) * W, H = ids.length * 20;
  return (
    <svg viewBox={`0 0 ${W + 60} ${H + 28}`} className="w-full">
      {[0, 90, 180, 270, 360].map((d) => (<g key={d}><line x1={x(d)} x2={x(d)} y1={4} y2={H + 6} stroke="#1e293b" /><text x={x(d)} y={H + 20} fontSize={10} fill="#94a3b8" textAnchor="middle">{d}°</text></g>))}
      {ids.map((id, i) => (<g key={id}><text x={4} y={i * 20 + 17} fontSize={11} fill="#cbd5e1">{id}</text><rect x={40} y={i * 20 + 6} width={W} height={14} fill="#0f172a" />
        {r.conduction_deg[id]?.map(([a, b], k) => <rect key={k} x={x(a)} y={i * 20 + 6} width={Math.max(x(b) - x(a), 1)} height={14} fill={col(id, r.kind)} opacity={0.85} />)}</g>))}
      <line x1={x(cursorDeg)} x2={x(cursorDeg)} y1={2} y2={H + 8} stroke="#e2e8f0" strokeDasharray="3 2" />
    </svg>
  );
}
