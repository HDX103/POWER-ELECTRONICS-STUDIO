import type { ReactNode } from 'react';

export const ON = '#34d399', OFF = '#64748b', WIRE = '#94a3b8', BG = '#0b1220';

export interface SymProps { x: number; y: number; ang?: number; label?: string; lx?: number; ly?: number; on?: boolean }

/** A part is drawn along its local +x axis (-30..30), centred on (x,y) and rotated by `ang` degrees. */
export function Part({ x, y, ang = 0, label, lx = 0, ly = -22, on, children, color }: {
  x: number; y: number; ang?: number; label?: string; lx?: number; ly?: number; on?: boolean; children: ReactNode; color?: string }) {
  const c = color ?? (on ? ON : OFF);
  return (
    <g transform={`translate(${x},${y}) rotate(${ang})`} stroke={c} strokeWidth={on ? 2.5 : 1.8} fill="none">
      {children}
      {label && <g transform={`rotate(${-ang})`}><text x={lx} y={ly} textAnchor="middle" fontSize={12} fontWeight={700} stroke="none" fill={on ? ON : '#cbd5e1'}>{label}</text></g>}
    </g>
  );
}

export const Resistor = (p: SymProps) => (
  <Part {...p} color={WIRE}><polyline points="-30,0 -20,0 -16,-8 -8,8 0,-8 8,8 16,-8 20,0 30,0" /></Part>);
export const Inductor = (p: SymProps) => (
  <Part {...p} color={WIRE}><path d="M-30 0 H-24 a6 6 0 0 1 12 0 a6 6 0 0 1 12 0 a6 6 0 0 1 12 0 a6 6 0 0 1 12 0 H30" /></Part>);
export const Capacitor = (p: SymProps) => (
  <Part {...p} color={WIRE}><line x1={-30} y1={0} x2={-4} y2={0} /><line x1={-4} y1={-12} x2={-4} y2={12} /><line x1={4} y1={-12} x2={4} y2={12} /><line x1={4} y1={0} x2={30} y2={0} /></Part>);
export const Diode = (p: SymProps) => (
  <Part {...p}><line x1={-30} y1={0} x2={30} y2={0} /><polygon points="-10,-10 -10,10 10,0" fill={p.on ? 'rgba(52,211,153,.35)' : BG} /><line x1={10} y1={-10} x2={10} y2={10} /></Part>);
export const Thyristor = (p: SymProps) => (
  <Part {...p}><line x1={-30} y1={0} x2={30} y2={0} /><polygon points="-12,-11 -12,11 12,0" fill={p.on ? 'rgba(52,211,153,.35)' : BG} /><line x1={12} y1={-11} x2={12} y2={11} /><line x1={3} y1={4} x2={14} y2={20} strokeWidth={1.5} /></Part>);
export const Switch = (p: SymProps) => (
  <Part {...p}><line x1={-30} y1={0} x2={-12} y2={0} /><line x1={12} y1={0} x2={30} y2={0} /><circle cx={-12} cy={0} r={2.5} fill={WIRE} /><circle cx={12} cy={0} r={2.5} fill={WIRE} />
    <line x1={-12} y1={0} x2={p.on ? 12 : 8} y2={p.on ? 0 : -14} /><line x1={0} y1={14} x2={0} y2={24} strokeWidth={1.3} strokeDasharray="3 2" /></Part>);

export function Ground({ x, y }: { x: number; y: number }) {
  return (<g stroke={WIRE} strokeWidth={1.5}><line x1={x} y1={y} x2={x} y2={y + 8} /><line x1={x - 12} y1={y + 8} x2={x + 12} y2={y + 8} />
    <line x1={x - 8} y1={y + 13} x2={x + 8} y2={y + 13} /><line x1={x - 4} y1={y + 18} x2={x + 4} y2={y + 18} /></g>);
}

export function Source({ x, y, kind, label }: { x: number; y: number; kind: 'ac' | 'dc'; label: string }) {
  return (<g>
    <circle cx={x} cy={y} r={24} fill={BG} stroke={WIRE} strokeWidth={1.5} />
    {kind === 'ac' ? <path d={`M${x - 14} ${y} q7 -14 14 0 t14 0`} stroke="#38bdf8" strokeWidth={2} fill="none" />
      : <g stroke="#fbbf24" strokeWidth={2}><line x1={x - 5} y1={y - 12} x2={x + 5} y2={y - 12} /><line x1={x} y1={y - 17} x2={x} y2={y - 7} /><line x1={x - 5} y1={y + 12} x2={x + 5} y2={y + 12} /></g>}
    <text x={x - 32} y={y + 4} textAnchor="end" fontSize={12} fill="#94a3b8">{label}</text></g>);
}

export const wire = (pts: [number, number][], on = false) => (
  <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={on ? ON : WIRE} strokeWidth={on ? 2.5 : 1.5} />);
export const dot = (x: number, y: number) => <circle cx={x} cy={y} r={3.5} fill={WIRE} />;
export const Label = ({ x, y, t, anchor = 'middle' as const }: { x: number; y: number; t: string; anchor?: 'start' | 'middle' | 'end' }) => (
  <text x={x} y={y} textAnchor={anchor} fontSize={12} fill="#94a3b8">{t}</text>);
