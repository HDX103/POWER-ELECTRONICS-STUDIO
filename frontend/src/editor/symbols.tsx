import type { ReactNode } from 'react';
import { localBounds, pinOffsets } from './geometry';
import type { ComponentSpec } from './types';

const BG = '#0b1220';

/** Symbol bodies in LOCAL coordinates (pins at (±30,0) for two-terminal parts), drawn with currentColor. */
const BODY: Record<string, () => ReactNode> = {
  resistor: () => <polyline points="-30,0 -20,0 -16,-8 -8,8 0,-8 8,8 16,-8 20,0 30,0" />,
  inductor: () => <path d="M-30 0 H-24 a6 6 0 0 1 12 0 a6 6 0 0 1 12 0 a6 6 0 0 1 12 0 a6 6 0 0 1 12 0 H30" />,
  capacitor: () => (<><line x1={-30} y1={0} x2={-4} y2={0} /><line x1={-4} y1={-12} x2={-4} y2={12} /><line x1={4} y1={-12} x2={4} y2={12} /><line x1={4} y1={0} x2={30} y2={0} /></>),
  diode: () => (<><line x1={-30} y1={0} x2={30} y2={0} /><polygon points="-10,-10 -10,10 10,0" fill={BG} /><line x1={10} y1={-10} x2={10} y2={10} /></>),
  thyristor: () => (<><line x1={-30} y1={0} x2={30} y2={0} /><polygon points="-12,-11 -12,11 12,0" fill={BG} /><line x1={12} y1={-11} x2={12} y2={11} /><line x1={3} y1={4} x2={14} y2={20} strokeWidth={1.4} /></>),
  switch: () => (<><line x1={-30} y1={0} x2={-12} y2={0} /><line x1={12} y1={0} x2={30} y2={0} /><circle cx={-12} cy={0} r={2.5} fill="currentColor" /><circle cx={12} cy={0} r={2.5} fill="currentColor" /><line x1={-12} y1={0} x2={8} y2={-14} /><line x1={0} y1={14} x2={0} y2={24} strokeWidth={1.3} strokeDasharray="3 2" /></>),
  // channel drawn as three dashes between the drain/source leads, gate plate below it, gate stub = control signal
  mosfet: () => (<><line x1={-30} y1={0} x2={-12} y2={0} /><line x1={12} y1={0} x2={30} y2={0} />
    <line x1={-12} y1={0} x2={-7} y2={0} /><line x1={-2.5} y1={0} x2={2.5} y2={0} /><line x1={7} y1={0} x2={12} y2={0} />
    <line x1={-12} y1={-6} x2={-12} y2={0} /><line x1={12} y1={-6} x2={12} y2={0} />
    <line x1={-12} y1={6} x2={12} y2={6} /><line x1={0} y1={6} x2={0} y2={24} strokeWidth={1.3} strokeDasharray="3 2" /></>),
  igbt: () => (<><line x1={-30} y1={0} x2={-12} y2={0} /><line x1={12} y1={0} x2={30} y2={0} />
    <line x1={-12} y1={0} x2={12} y2={0} /><polygon points="12,0 5,-4 5,4" fill="currentColor" />
    <line x1={-12} y1={-6} x2={-12} y2={0} /><line x1={12} y1={-6} x2={12} y2={0} />
    <line x1={-12} y1={6} x2={12} y2={6} /><line x1={0} y1={6} x2={0} y2={24} strokeWidth={1.3} strokeDasharray="3 2" /></>),
  dc_voltage_source: () => (<><line x1={-30} y1={0} x2={-16} y2={0} /><line x1={16} y1={0} x2={30} y2={0} /><circle r={16} fill={BG} />
    <line x1={-8} y1={-5} x2={-2} y2={-5} /><line x1={-5} y1={-8} x2={-5} y2={-2} /><line x1={3} y1={-5} x2={9} y2={-5} /></>),
  ac_voltage_source: () => (<><line x1={-30} y1={0} x2={-16} y2={0} /><line x1={16} y1={0} x2={30} y2={0} /><circle r={16} fill={BG} /><path d="M-9 0 q4.5 -9 9 0 t9 0" /></>),
  ground: () => (<><line x1={0} y1={0} x2={0} y2={8} /><line x1={-12} y1={8} x2={12} y2={8} /><line x1={-8} y1={13} x2={8} y2={13} /><line x1={-4} y1={18} x2={4} y2={18} /></>),
  junction: () => <circle r={3.5} fill="currentColor" />,
  net_label: () => <path d="M-8 0 L-3 -6 H12 V6 H-3 Z" />,
};

function GenericBody({ spec }: { spec: Pick<ComponentSpec, 'pins' | 'category'> }) {
  const b = localBounds(spec), pins = pinOffsets(spec);
  return (<>
    <rect x={b.x0 + 8} y={b.y0} width={b.x1 - b.x0 - 16} height={b.y1 - b.y0} fill={BG} />
    {Object.values(pins).map((p, i) => <line key={i} x1={p.x} y1={p.y} x2={p.x > 0 ? 22 : -22} y2={p.y} />)}
  </>);
}

export function SymbolBody({ spec }: { spec?: ComponentSpec }) {
  const draw = spec ? BODY[spec.symbol] : undefined;
  return <>{draw ? draw() : <GenericBody spec={spec ?? { pins: ['p', 'n'], category: 'passive' }} />}</>;
}

/** Small icon used by the library palette. */
export function SymbolIcon({ spec, size = 36 }: { spec: ComponentSpec; size?: number }) {
  return (
    <svg width={size} height={size * 0.6} viewBox="-36 -22 72 44" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <SymbolBody spec={spec} />
    </svg>
  );
}
