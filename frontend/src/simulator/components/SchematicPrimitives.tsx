import React from 'react';

/**
 * Shared drawing primitives for the power-electronics schematics.
 * Graphic symbols follow IEEE Std 315-1975 (ANSI Y32.2) / IEC 60617:
 *  - resistor: zig-zag            - inductor: series of loops (humps)
 *  - capacitor: two parallel plates (curved plate = polarised, + marked)
 *  - DC source: long (+) / short (-) plates     - AC source: circle with tilde
 *  - ground: IEEE earth symbol (three diminishing bars)
 *  - connections: filled dot where 3+ conductors meet; plain crossing = no connection
 * All wires are drawn in the direction of conventional current so the animated
 * dash-offset overlay shows true current direction.
 */

export const COLORS = {
  wire: '#64748b',
  body: '#7dd3fc',
  label: '#cbd5e1',
  dim: '#94a3b8',
  green: '#22c55e',
  cyan: '#06b6d4',
  amber: '#eab308',
  pink: '#ec4899',
  red: '#ef4444',
  blue: '#3b82f6',
  panel: '#0f172a',
};

const SERIF = "'Times New Roman', 'Liberation Serif', Georgia, serif";

/* ------------------------------------------------------------------ text */

interface TxtProps {
  x: number;
  y: number;
  size?: number;
  fill?: string;
  anchor?: 'start' | 'middle' | 'end';
  weight?: number | string;
  children: React.ReactNode;
}

export const Txt: React.FC<TxtProps> = ({ x, y, size = 11, fill = COLORS.label, anchor = 'middle', weight, children }) => (
  <text x={x} y={y} fontSize={size} fill={fill} textAnchor={anchor} fontWeight={weight} fontFamily="ui-sans-serif, system-ui, sans-serif">
    {children}
  </text>
);

interface VarProps {
  x: number;
  y: number;
  name: string;
  sub?: string;
  value?: string;
  size?: number;
  fill?: string;
  anchor?: 'start' | 'middle' | 'end';
}

/** IEEE Std 280 style quantity symbol: italic base, upright subscript, optional "= value". */
export const Var: React.FC<VarProps> = ({ x, y, name, sub, value, size = 13, fill = COLORS.label, anchor = 'middle' }) => (
  <text x={x} y={y} fontSize={size} fill={fill} textAnchor={anchor} fontFamily={SERIF}>
    <tspan fontStyle="italic">{name}</tspan>
    {sub && (
      <tspan dy={size * 0.28} fontSize={size * 0.7}>
        {sub}
      </tspan>
    )}
    {value && (
      <tspan dy={sub ? -size * 0.28 : 0} fontSize={size * 0.85} fill={COLORS.dim} fontFamily="ui-sans-serif, system-ui, sans-serif">
        {` = ${value}`}
      </tspan>
    )}
  </text>
);

/* ------------------------------------------------------------ connections */

interface WireProps {
  d: string;
  active?: boolean;
  reverse?: boolean;
  color?: string;
}

/** Conductor. `d` must be written in the direction of conventional current when active. */
export const Wire: React.FC<WireProps> = ({ d, active = false, reverse = false, color = COLORS.green }) => (
  <g>
    <path d={d} fill="none" stroke={COLORS.wire} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    {active && (
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={3.2}
        strokeLinejoin="round"
        strokeDasharray="6 6"
        style={{
          animation: `currentFlow 0.8s linear infinite${reverse ? ' reverse' : ''}`,
          filter: `drop-shadow(0 0 3px ${color})`,
        }}
      />
    )}
  </g>
);

/** Junction dot (IEEE 315: connection of three or more conductors). */
export const Dot: React.FC<{ x: number; y: number; r?: number; color?: string }> = ({ x, y, r = 3.4, color = COLORS.dim }) => (
  <circle cx={x} cy={y} r={r} fill={color} />
);

/** Transformer polarity (dot convention) mark. */
export const PolarityDot: React.FC<{ x: number; y: number }> = ({ x, y }) => <circle cx={x} cy={y} r={2.8} fill={COLORS.amber} />;

/** Arrow-head placed on a conductor to indicate reference current direction. */
export const CurrentArrow: React.FC<{ x: number; y: number; dir?: 'r' | 'l' | 'u' | 'd'; color?: string }> = ({
  x,
  y,
  dir = 'r',
  color = COLORS.dim,
}) => {
  const angle = { r: 0, d: 90, l: 180, u: 270 }[dir];
  return <polygon points="6,0 -4,-4 -4,4" fill={color} transform={`translate(${x},${y}) rotate(${angle})`} />;
};

export const Ground: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g stroke={COLORS.wire} strokeWidth={2} strokeLinecap="round">
    <line x1={x} y1={y} x2={x} y2={y + 8} />
    <line x1={x - 11} y1={y + 8} x2={x + 11} y2={y + 8} />
    <line x1={x - 7} y1={y + 12.5} x2={x + 7} y2={y + 12.5} />
    <line x1={x - 3} y1={y + 17} x2={x + 3} y2={y + 17} />
  </g>
);

/* ------------------------------------------------------------ passives */

/** Inductor / winding: `turns` loops starting at (x,y) running `len` along +x (dir 'h') or +y (dir 'v'). */
export const Inductor: React.FC<{
  x: number;
  y: number;
  len?: number;
  turns?: number;
  dir?: 'h' | 'v';
  flip?: boolean;
  color?: string;
}> = ({ x, y, len = 56, turns = 4, dir = 'h', flip = false, color = COLORS.body }) => {
  const r = len / (2 * turns);
  let d = 'M 0 0';
  for (let i = 0; i < turns; i++) d += ` a ${r} ${r} 0 0 ${flip ? 0 : 1} ${2 * r} 0`;
  return (
    <g transform={`translate(${x},${y})${dir === 'v' ? ' rotate(90)' : ''}`}>
      <path d={d} fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </g>
  );
};

/** Resistor (IEEE zig-zag) spanning `len` from (x,y). */
export const Resistor: React.FC<{ x: number; y: number; len?: number; dir?: 'h' | 'v'; color?: string }> = ({
  x,
  y,
  len = 40,
  dir = 'h',
  color = COLORS.body,
}) => {
  const pts: string[] = ['0,0'];
  for (let i = 0; i < 6; i++) pts.push(`${(((2 * i + 1) * len) / 12).toFixed(2)},${i % 2 === 0 ? -5.5 : 5.5}`);
  pts.push(`${len},0`);
  return (
    <g transform={`translate(${x},${y})${dir === 'v' ? ' rotate(90)' : ''}`}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
    </g>
  );
};

/**
 * Capacitor centred on (x,y). dir 'v': conductor axis vertical (shunt cap), plates at y∓3.5.
 * dir 'h': axis horizontal (series cap), plates at x∓3.5. Wires should end on the plates.
 * polarized: straight plate is positive; `plusFirst` puts + on the top / left plate.
 */
export const Capacitor: React.FC<{
  x: number;
  y: number;
  dir?: 'v' | 'h';
  polarized?: boolean;
  plusFirst?: boolean;
  color?: string;
}> = ({ x, y, dir = 'v', polarized = false, plusFirst = true, color = COLORS.body }) => {
  const g = 3.5;
  const hl = 10;
  const straight = (yy: number) => <line x1={-hl} y1={yy} x2={hl} y2={yy} stroke={color} strokeWidth={2.6} strokeLinecap="round" />;
  const curved = (yy: number, toward: 1 | -1) => (
    <path d={`M ${-hl} ${yy + toward * 1.5} Q 0 ${yy - toward * 5} ${hl} ${yy + toward * 1.5}`} fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
  );
  const rot = dir === 'h' ? ` rotate(-90)` : '';
  const plusPos =
    dir === 'v'
      ? { x: x + 14, y: plusFirst ? y - 6 : y + 12 }
      : { x: plusFirst ? x - 8 : x + 8, y: y - 12 };
  return (
    <g>
      <g transform={`translate(${x},${y})${rot}`}>
        {polarized ? (plusFirst ? straight(-g) : curved(-g, -1)) : straight(-g)}
        {polarized ? (plusFirst ? curved(g, 1) : straight(g)) : straight(g)}
      </g>
      {polarized && (
        <text x={plusPos.x} y={plusPos.y} fontSize={11} fontWeight={700} fill={COLORS.dim} textAnchor="middle">
          +
        </text>
      )}
    </g>
  );
};

/** DC voltage source (battery symbol). Terminals sit at ±3 along the axis. dir 'v': + on top; 'h': + on right. */
export const DcSource: React.FC<{ x: number; y: number; dir?: 'v' | 'h'; color?: string }> = ({ x, y, dir = 'v', color = COLORS.body }) => {
  const plus = dir === 'v' ? { x: x + 15, y: y - 5 } : { x: x + 10, y: y - 10 };
  const minus = dir === 'v' ? { x: x + 15, y: y + 13 } : { x: x - 10, y: y - 10 };
  return (
    <g>
      <g transform={`translate(${x},${y})${dir === 'h' ? ' rotate(90)' : ''}`}>
        <line x1={-12} y1={-3} x2={12} y2={-3} stroke={color} strokeWidth={2.4} strokeLinecap="round" />
        <line x1={-6} y1={3} x2={6} y2={3} stroke={color} strokeWidth={4} strokeLinecap="round" />
      </g>
      <text x={plus.x} y={plus.y} fontSize={12} fontWeight={700} fill={COLORS.dim} textAnchor="middle">
        +
      </text>
      <text x={minus.x} y={minus.y} fontSize={12} fontWeight={700} fill={COLORS.dim} textAnchor="middle">
        −
      </text>
    </g>
  );
};

/** Sinusoidal (AC) voltage source: circle with tilde. Terminals at distance r from centre. */
export const AcSource: React.FC<{ x: number; y: number; r?: number; color?: string }> = ({ x, y, r = 17, color = COLORS.body }) => (
  <g>
    <circle cx={x} cy={y} r={r} fill={COLORS.panel} stroke={color} strokeWidth={2.2} />
    <path d={`M ${x - r * 0.55} ${y} q ${r * 0.275} ${-r * 0.55} ${r * 0.55} 0 t ${r * 0.55} 0`} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </g>
);

/** Magnetic core: two parallel lines (IEEE 315 iron/ferrite core). */
export const Core: React.FC<{ x: number; y1: number; y2: number; gap?: number }> = ({ x, y1, y2, gap = 6 }) => (
  <g stroke="#94a3b8" strokeWidth={2} strokeLinecap="round">
    <line x1={x} y1={y1} x2={x} y2={y2} />
    <line x1={x + gap} y1={y1} x2={x + gap} y2={y2} />
  </g>
);

/* ---------------------------------------------------------------- loads */

export const LOAD_H = 124;

const fmtL = (L: number) => (L >= 1 ? `${L.toFixed(1)} H` : `${(L * 1000).toFixed(L * 1000 < 10 ? 1 : 0)} mH`);

interface LoadBranchProps {
  x: number;
  yTop: number;
  showL?: boolean;
  showE?: boolean;
  active?: boolean;
  reverse?: boolean;
  color?: string;
  R?: number;
  L?: number;
  E?: number;
}

/** Vertical series R–L(–E) load branch, 124 px tall. Current reference flows top → bottom. */
export const LoadBranch: React.FC<LoadBranchProps> = ({ x, yTop, showL = true, showE = false, active = false, reverse = false, color = COLORS.green, R, L, E }) => {
  const items: { k: 'R' | 'L' | 'E'; h: number }[] = [{ k: 'R', h: 36 }];
  if (showL) items.push({ k: 'L', h: 40 });
  if (showE) items.push({ k: 'E', h: 6 });
  const gap = 12;
  const content = items.reduce((s, i) => s + i.h, 0) + gap * (items.length - 1);
  let cy = yTop + (LOAD_H - content) / 2;
  let prev = yTop;
  const out: React.ReactNode[] = [];
  items.forEach((it, i) => {
    const s = cy;
    const e = cy + it.h;
    out.push(<Wire key={`w${i}`} d={`M ${x} ${prev} V ${s}`} active={active} reverse={reverse} color={color} />);
    const mid = (s + e) / 2;
    if (it.k === 'R') {
      out.push(<Resistor key="R" x={x} y={s} len={it.h} dir="v" />);
      out.push(<Var key="Rl" x={x + 16} y={mid + 4} name="R" value={R !== undefined ? `${R} Ω` : undefined} size={12} anchor="start" />);
    } else if (it.k === 'L') {
      out.push(<Inductor key="L" x={x} y={s} len={it.h} dir="v" turns={4} />);
      out.push(<Var key="Ll" x={x + 20} y={mid + 4} name="L" value={L !== undefined ? fmtL(L) : undefined} size={12} anchor="start" />);
    } else {
      out.push(<DcSource key="E" x={x} y={s + 3} />);
      out.push(<Var key="El" x={x + 28} y={s + 8} name="E" value={E !== undefined ? `${E} V` : undefined} size={12} anchor="start" />);
    }
    prev = e;
    cy = e + gap;
  });
  out.push(<Wire key="wend" d={`M ${x} ${prev} V ${yTop + LOAD_H}`} active={active} reverse={reverse} color={color} />);
  return <g>{out}</g>;
};

interface LoadRowProps {
  x1: number;
  x2: number;
  y: number;
  showL?: boolean;
  active?: boolean;
  reverse?: boolean;
  color?: string;
  R?: number;
  L?: number;
  labels?: boolean;
  tag?: string;
}

/** Horizontal series R–L load between x1 and x2 (current reference flows left → right). */
export const LoadRow: React.FC<LoadRowProps> = ({ x1, x2, y, showL = true, active = false, reverse = false, color = COLORS.green, R, L, labels = true, tag }) => {
  const w = x2 - x1;
  const rLen = 40;
  const lLen = 52;
  const items: { k: 'R' | 'L'; len: number }[] = [{ k: 'R', len: rLen }];
  if (showL) items.push({ k: 'L', len: lLen });
  const content = items.reduce((s, i) => s + i.len, 0);
  const gap = (w - content) / (items.length + 1);
  let cx = x1;
  const out: React.ReactNode[] = [];
  items.forEach((it, i) => {
    const s = cx + gap;
    out.push(<Wire key={`w${i}`} d={`M ${cx} ${y} H ${s}`} active={active} reverse={reverse} color={color} />);
    if (it.k === 'R') {
      out.push(<Resistor key="R" x={s} y={y} len={it.len} />);
      if (labels) out.push(<Var key="Rl" x={s + it.len / 2} y={y - 12} name="R" sub={tag} size={12} />);
    } else {
      out.push(<Inductor key="L" x={s} y={y} len={it.len} turns={4} />);
      if (labels) out.push(<Var key="Ll" x={s + it.len / 2} y={y - 14} name="L" sub={tag} size={12} />);
    }
    cx = s + it.len;
  });
  out.push(<Wire key="wend" d={`M ${cx} ${y} H ${x2}`} active={active} reverse={reverse} color={color} />);
  if (labels && (R !== undefined || L !== undefined)) {
    const parts: string[] = [];
    if (R !== undefined) parts.push(`${R} Ω`);
    if (showL && L !== undefined) parts.push(fmtL(L));
    out.push(
      <Txt key="val" x={(x1 + x2) / 2} y={y + 24} size={10} fill={COLORS.dim}>
        {parts.join(' + ')}
      </Txt>
    );
  }
  return <g>{out}</g>;
};
