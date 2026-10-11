import React from 'react';
import { SwitchModel, SwitchState } from '../types';

interface SwitchSymbolProps {
  x: number;
  y: number;
  slotId: string;
  state: SwitchState;
  device?: SwitchModel;
  orientation?: 'horizontal' | 'vertical'; // default horizontal (anode/drain/collector at left/top)
  direction?: 'forward' | 'reverse'; // forward: left->right or top->bottom; reverse: right->left or bottom->top
  selected?: boolean;
  onClick?: () => void;
  showBadge?: boolean;
}

/**
 * Renders an authentic IEEE/IEC schematic symbol for a semiconductor switch:
 * - Diode (triangle + cathode bar)
 * - Thyristor / SCR (diode + gate electrode)
 * - TRIAC (bidirectional anti-parallel thyristors)
 * - MOSFET (insulated gate, broken channel, drain/source arrow)
 * - IGBT (insulated gate + BJT emitter arrow)
 * - Ideal Switch (open/closed knife-blade contact)
 *
 * Color codes live switch state (ON = emerald, TRIGGERED = cyan, FREEWHEELING = amber, OFF = slate).
 */
export const SwitchSymbol: React.FC<SwitchSymbolProps> = ({
  x,
  y,
  slotId,
  state,
  device,
  orientation = 'horizontal',
  direction = 'forward',
  selected = false,
  onClick,
  showBadge = true,
}) => {
  const switchType = device?.type || 'Diode';

  // State-based glowing colors
  let color = '#94a3b8'; // OFF/default
  let glow = 'none';
  if (state === 'ON') {
    color = '#22c55e'; // Green
    glow = 'drop-shadow(0 0 6px rgba(34, 197, 94, 0.7))';
  } else if (state === 'TRIGGERED') {
    color = '#06b6d4'; // Cyan
    glow = 'drop-shadow(0 0 6px rgba(6, 182, 212, 0.7))';
  } else if (state === 'FREEWHEELING') {
    color = '#f59e0b'; // Amber
    glow = 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.7))';
  }

  // Calculate rotation angle
  let rot = 0;
  if (orientation === 'horizontal') {
    rot = direction === 'reverse' ? 180 : 0;
  } else {
    rot = direction === 'reverse' ? 270 : 90;
  }

  return (
    <g
      transform={`translate(${x}, ${y})`}
      className="cursor-pointer group select-none"
      onClick={onClick}
    >
      {/* Click target hitbox */}
      <circle r="26" fill="transparent" />

      {/* Selected halo */}
      {selected && (
        <circle
          r="24"
          fill="none"
          stroke="#38bdf8"
          strokeWidth="1.5"
          strokeDasharray="3 3"
          className="animate-spin-slow"
        />
      )}

      {/* Symbol Graphics with orientation transform */}
      <g transform={`rotate(${rot})`} style={{ filter: glow }}>
        {/* Terminal leads extending out (left: -24 to -12, right: 12 to 24) */}
        <line x1="-24" y1="0" x2="-10" y2="0" stroke={color} strokeWidth="2.5" />
        <line x1="10" y1="0" x2="24" y2="0" stroke={color} strokeWidth="2.5" />

        {/* DIODE */}
        {switchType === 'Diode' && (
          <g>
            {/* Triangle pointing to the right (cathode bar) */}
            <polygon
              points="-10,-10 -10,10 10,0"
              fill={state !== 'OFF' ? color : '#0f172a'}
              stroke={color}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* Cathode bar */}
            <line x1="10" y1="-10" x2="10" y2="10" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          </g>
        )}

        {/* THYRISTOR (SCR) */}
        {switchType === 'Thyristor' && (
          <g>
            <polygon
              points="-10,-10 -10,10 10,0"
              fill={state !== 'OFF' ? color : '#0f172a'}
              stroke={color}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <line x1="10" y1="-10" x2="10" y2="10" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
            {/* Gate lead angled down */}
            <polyline
              points="4,3 12,14 18,14"
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
        )}

        {/* TRIAC */}
        {switchType === 'TRIAC' && (
          <g>
            {/* Two opposing triangles */}
            <polygon points="-8,-8 -8,8 6,0" fill={state !== 'OFF' ? color : '#0f172a'} stroke={color} strokeWidth="1.8" />
            <polygon points="6,8 6,-8 -8,0" fill={state !== 'OFF' ? color : '#0f172a'} stroke={color} strokeWidth="1.8" />
            <line x1="-8" y1="-9" x2="-8" y2="9" stroke={color} strokeWidth="2" />
            <line x1="6" y1="-9" x2="6" y2="9" stroke={color} strokeWidth="2" />
            <line x1="0" y1="4" x2="8" y2="15" stroke={color} strokeWidth="2" />
          </g>
        )}

        {/* MOSFET (N-Channel) */}
        {switchType === 'MOSFET' && (
          <g>
            {/* Gate bar */}
            <line x1="-12" y1="-10" x2="12" y2="-10" stroke={color} strokeWidth="2" />
            <line x1="0" y1="-10" x2="0" y2="-18" stroke={color} strokeWidth="2" />
            {/* Channel gaps */}
            <line x1="-12" y1="-6" x2="-5" y2="-6" stroke={color} strokeWidth="2.5" />
            <line x1="-3" y1="-6" x2="3" y2="-6" stroke={color} strokeWidth="2.5" />
            <line x1="5" y1="-6" x2="12" y2="-6" stroke={color} strokeWidth="2.5" />
            {/* Drain & Source leads */}
            <line x1="-10" y1="-6" x2="-10" y2="0" stroke={color} strokeWidth="2" />
            <line x1="10" y1="-6" x2="10" y2="0" stroke={color} strokeWidth="2" />
            <line x1="-10" y1="0" x2="-24" y2="0" stroke={color} strokeWidth="2.5" />
            <line x1="10" y1="0" x2="24" y2="0" stroke={color} strokeWidth="2.5" />
            {/* Source arrow pointing inwards */}
            <polygon points="2,-6 6,-3 6,-9" fill={color} />
          </g>
        )}

        {/* IGBT */}
        {switchType === 'IGBT' && (
          <g>
            {/* Gate insulated plate */}
            <line x1="-10" y1="-10" x2="10" y2="-10" stroke={color} strokeWidth="2" />
            <line x1="0" y1="-10" x2="0" y2="-18" stroke={color} strokeWidth="2" />
            {/* Collector plate */}
            <line x1="-10" y1="-6" x2="10" y2="-6" stroke={color} strokeWidth="2" />
            {/* Collector and Emitter diagonals */}
            <line x1="-8" y1="-6" x2="-14" y2="0" stroke={color} strokeWidth="2" />
            <line x1="8" y1="-6" x2="14" y2="0" stroke={color} strokeWidth="2" />
            {/* Emitter arrow */}
            <polygon points="14,0 9,-3 11,-7" fill={color} />
            {/* Anti-parallel body diode indicator if present */}
            <polygon points="6,4 12,4 9,8" fill={color} opacity="0.7" />
          </g>
        )}

        {/* IDEAL SWITCH */}
        {switchType === 'IdealSwitch' && (
          <g>
            <circle cx="-10" cy="0" r="2.5" fill={color} />
            <circle cx="10" cy="0" r="2.5" fill={color} />
            {state === 'ON' ? (
              <line x1="-10" y1="0" x2="10" y2="0" stroke={color} strokeWidth="2.5" />
            ) : (
              <line x1="-10" y1="0" x2="7" y2="-10" stroke={color} strokeWidth="2.5" />
            )}
          </g>
        )}
      </g>

      {/* Label and Badge Overlay */}
      {showBadge && (
        <g transform={orientation === 'vertical' ? 'translate(22, -8)' : 'translate(0, 18)'}>
          <rect
            x={orientation === 'vertical' ? 0 : -22}
            y="0"
            width={orientation === 'vertical' ? 36 : 44}
            height="15"
            rx="3"
            fill="#090d16"
            stroke={selected ? '#38bdf8' : '#334155'}
            strokeWidth="1"
          />
          <text
            x={orientation === 'vertical' ? 18 : 0}
            y="11"
            fill={selected ? '#38bdf8' : '#e2e8f0'}
            fontSize="9"
            fontWeight="bold"
            fontFamily="monospace"
            textAnchor="middle"
          >
            {slotId}
          </text>
        </g>
      )}
    </g>
  );
};
