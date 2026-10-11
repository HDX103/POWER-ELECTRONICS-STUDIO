import { SwitchModel, SwitchState, TopologyDefinition } from '../types';
import { SwitchSymbol } from './SwitchSymbol';

interface Props {
  topology: TopologyDefinition;
  cursorIdx: number;
  deviceStates: Record<string, SwitchState[]>;
  activePaths: Record<string, boolean>[];
  devices: Record<string, SwitchModel>;
  onSelectDevice: (slotId: string) => void;
  selectedSlot: string | null;
}

export function SchematicView({
  topology,
  cursorIdx,
  deviceStates,
  activePaths,
  devices,
  onSelectDevice,
  selectedSlot,
}: Props) {
  const currentStates: Record<string, SwitchState> = {};
  topology.deviceSlots.forEach((slot) => {
    currentStates[slot.id] = deviceStates[slot.id]?.[cursorIdx] || 'OFF';
  });

  const curPaths = activePaths[cursorIdx] || {};

  // SVG Flow Animation Style
  const flowStyle = (active: boolean, color = '#22c55e') => ({
    stroke: active ? color : '#334155',
    strokeWidth: active ? 3.5 : 2,
    strokeDasharray: active ? '6, 6' : 'none',
    animation: active ? 'currentFlow 0.8s linear infinite' : 'none',
    filter: active ? `drop-shadow(0 0 4px ${color})` : 'none',
    transition: 'stroke 0.15s, stroke-width 0.15s',
  });

  const renderSwitch = (
    slotId: string,
    x: number,
    y: number,
    orientation: 'horizontal' | 'vertical' = 'horizontal',
    direction: 'forward' | 'reverse' = 'forward'
  ) => {
    return (
      <SwitchSymbol
        key={slotId}
        slotId={slotId}
        x={x}
        y={y}
        state={currentStates[slotId] || 'OFF'}
        device={devices[slotId]}
        orientation={orientation}
        direction={direction}
        selected={selectedSlot === slotId}
        onClick={() => onSelectDevice(slotId)}
      />
    );
  };

  return (
    <div className="relative w-full h-full bg-slate-950/80 rounded-lg border border-slate-800 flex flex-col items-center justify-center p-3 overflow-hidden select-none">
      <style>{`
        @keyframes currentFlow {
          from { stroke-dashoffset: 24; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>

      {/* Header bar */}
      <div className="absolute top-2 left-3 flex items-center gap-2 text-xs">
        <span className="font-semibold text-slate-300">{topology.name}</span>
        <span className="px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800 font-mono text-[10px]">
          {topology.family}
        </span>
      </div>

      <div className="absolute top-2 right-3 flex items-center gap-3 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500 animate-pulse" />
          <span className="text-slate-400">Active Conduction</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="text-slate-400">Freewheeling</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 italic text-[10px]">(Click device symbol to inspect)</span>
        </div>
      </div>

      {/* SVG Canvas */}
      <svg viewBox="0 0 800 360" className="w-full h-full max-h-[340px]">
        {/* ================= 1. AC-DC 1-PHASE FULL BRIDGE ================= */}
        {topology.id === 'acdc_1ph_full_bridge' && (
          <g transform="translate(40, 20)">
            {/* AC Source */}
            <circle cx="80" cy="160" r="26" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
            <path d="M 66 160 Q 73 148 80 160 T 94 160" fill="none" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="80" y="202" fill="#94a3b8" fontSize="12" textAnchor="middle">
              Vs (AC)
            </text>

            {/* AC Input Lines to Bridge */}
            <path d="M 80 134 L 80 100 L 220 100 L 220 160" fill="none" style={flowStyle(curPaths.path_pos, '#22c55e')} />
            <path d="M 80 186 L 80 220 L 340 220 L 340 160" fill="none" style={flowStyle(curPaths.path_neg, '#06b6d4')} />

            {/* Bridge Legs (Vertical Rails) */}
            <line x1="220" y1="50" x2="220" y2="270" stroke="#334155" strokeWidth="2" />
            <line x1="340" y1="50" x2="340" y2="270" stroke="#334155" strokeWidth="2" />

            {/* DC Bus Rails to Load */}
            <path d="M 220 50 L 520 50 L 520 120" fill="none" style={flowStyle(curPaths.path_pos || curPaths.path_neg, '#22c55e')} />
            <path d="M 520 200 L 520 270 L 220 270" fill="none" style={flowStyle(curPaths.path_pos || curPaths.path_neg, '#22c55e')} />

            {/* Load Box */}
            <rect x="495" y="120" width="50" height="80" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            <text x="520" y="148" fill="#e2e8f0" fontSize="11" fontWeight="bold" textAnchor="middle">LOAD</text>
            <text x="520" y="166" fill="#94a3b8" fontSize="10" textAnchor="middle">R + L</text>
            <text x="520" y="182" fill="#22c55e" fontSize="10" fontWeight="bold" textAnchor="middle">+ Vo -</text>

            {/* 4 Bridge Switches with True Symbols */}
            {renderSwitch('T1', 220, 95, 'vertical', 'reverse')}
            {renderSwitch('T4', 220, 225, 'vertical', 'reverse')}
            {renderSwitch('T3', 340, 95, 'vertical', 'reverse')}
            {renderSwitch('T2', 340, 225, 'vertical', 'reverse')}
          </g>
        )}

        {/* ================= 2. AC-DC 1-PHASE HALF WAVE ================= */}
        {topology.id === 'acdc_1ph_half_wave' && (
          <g transform="translate(60, 20)">
            {/* AC Source */}
            <circle cx="80" cy="160" r="26" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
            <path d="M 66 160 Q 73 148 80 160 T 94 160" fill="none" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="80" y="202" fill="#94a3b8" fontSize="12" textAnchor="middle">Vs (AC)</text>

            {/* Top Conductor */}
            <path d="M 80 134 L 80 80 L 240 80" fill="none" style={flowStyle(curPaths.path_pos, '#22c55e')} />
            <path d="M 280 80 L 480 80 L 480 120" fill="none" style={flowStyle(curPaths.path_pos, '#22c55e')} />

            {/* Bottom Return */}
            <path d="M 480 200 L 480 240 L 80 240 L 80 186" fill="none" style={flowStyle(curPaths.path_pos, '#22c55e')} />

            {/* Freewheel Diode Branch */}
            <line x1="360" y1="80" x2="360" y2="240" stroke="#334155" strokeWidth="2" />
            <path d="M 480 120 L 480 80 L 360 80 L 360 240 L 480 240 L 480 200" fill="none" style={flowStyle(curPaths.path_fwd, '#eab308')} />

            {/* Load */}
            <rect x="455" y="120" width="50" height="80" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            <text x="480" y="152" fill="#e2e8f0" fontSize="11" fontWeight="bold" textAnchor="middle">LOAD</text>
            <text x="480" y="170" fill="#94a3b8" fontSize="10" textAnchor="middle">R + L</text>

            {/* Switch Symbols */}
            {renderSwitch('T1', 260, 80, 'horizontal', 'forward')}
            {renderSwitch('DFWD', 360, 160, 'vertical', 'reverse')}
          </g>
        )}

        {/* ================= 3. AC-DC 1-PHASE SEMI-CONVERTER ================= */}
        {topology.id === 'acdc_1ph_semi' && (
          <g transform="translate(40, 20)">
            <circle cx="80" cy="160" r="26" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
            <path d="M 66 160 Q 73 148 80 160 T 94 160" fill="none" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="80" y="202" fill="#94a3b8" fontSize="12" textAnchor="middle">Vs (AC)</text>

            <path d="M 80 134 L 80 100 L 220 100 L 220 160" fill="none" style={flowStyle(curPaths.path_pos, '#22c55e')} />
            <path d="M 80 186 L 80 220 L 340 220 L 340 160" fill="none" style={flowStyle(curPaths.path_neg, '#06b6d4')} />

            <line x1="220" y1="50" x2="220" y2="270" stroke="#334155" strokeWidth="2" />
            <line x1="340" y1="50" x2="340" y2="270" stroke="#334155" strokeWidth="2" />

            <path d="M 220 50 L 520 50 L 520 120" fill="none" style={flowStyle(true, '#22c55e')} />
            <path d="M 520 200 L 520 270 L 220 270" fill="none" style={flowStyle(true, '#22c55e')} />

            <rect x="495" y="120" width="50" height="80" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            <text x="520" y="148" fill="#e2e8f0" fontSize="11" fontWeight="bold" textAnchor="middle">LOAD</text>
            <text x="520" y="166" fill="#94a3b8" fontSize="10" textAnchor="middle">R + L</text>
            <text x="520" y="182" fill="#22c55e" fontSize="10" fontWeight="bold" textAnchor="middle">+ Vo -</text>

            {/* Upper SCRs + Lower Diodes */}
            {renderSwitch('T1', 220, 95, 'vertical', 'reverse')}
            {renderSwitch('D2', 220, 225, 'vertical', 'reverse')}
            {renderSwitch('T2', 340, 95, 'vertical', 'reverse')}
            {renderSwitch('D1', 340, 225, 'vertical', 'reverse')}
          </g>
        )}

        {/* ================= 4. AC-DC 3-PHASE HALF WAVE ================= */}
        {topology.id === 'acdc_3ph_half_wave' && (
          <g transform="translate(30, 20)">
            <text x="50" y="70" fill="#ef4444" fontSize="11" fontWeight="bold">Va</text>
            <text x="50" y="160" fill="#eab308" fontSize="11" fontWeight="bold">Vb</text>
            <text x="50" y="250" fill="#3b82f6" fontSize="11" fontWeight="bold">Vc</text>
            <text x="50" y="290" fill="#94a3b8" fontSize="10">Neutral (N)</text>

            <path d="M 70 65 L 200 65 L 200 90" fill="none" stroke="#ef4444" strokeWidth="2" />
            <path d="M 70 155 L 300 155 L 300 120" fill="none" stroke="#eab308" strokeWidth="2" />
            <path d="M 70 245 L 400 245 L 400 150" fill="none" stroke="#3b82f6" strokeWidth="2" />

            {/* Common Cathode Rail */}
            <path d="M 200 50 L 520 50 L 520 120" fill="none" style={flowStyle(true, '#22c55e')} />
            {/* Neutral Return */}
            <path d="M 520 200 L 520 285 L 70 285" fill="none" stroke="#64748b" strokeWidth="2" />

            <rect x="495" y="120" width="50" height="80" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            <text x="520" y="152" fill="#e2e8f0" fontSize="11" fontWeight="bold" textAnchor="middle">LOAD</text>
            <text x="520" y="170" fill="#22c55e" fontSize="10" fontWeight="bold" textAnchor="middle">+ Vo -</text>

            {renderSwitch('T1', 200, 75, 'vertical', 'reverse')}
            {renderSwitch('T2', 300, 75, 'vertical', 'reverse')}
            {renderSwitch('T3', 400, 75, 'vertical', 'reverse')}
          </g>
        )}

        {/* ================= 5. AC-DC 3-PHASE FULL BRIDGE ================= */}
        {topology.id === 'acdc_3ph_full_bridge' && (
          <g transform="translate(20, 20)">
            {/* 3-Phase Sources */}
            <text x="40" y="100" fill="#ef4444" fontSize="11" fontWeight="bold">Phase A</text>
            <text x="40" y="160" fill="#eab308" fontSize="11" fontWeight="bold">Phase B</text>
            <text x="40" y="220" fill="#3b82f6" fontSize="11" fontWeight="bold">Phase C</text>

            {/* Connections to 3 legs */}
            <path d="M 90 95 L 180 95 L 180 160" fill="none" stroke="#ef4444" strokeWidth="2" />
            <path d="M 90 155 L 280 155" fill="none" stroke="#eab308" strokeWidth="2" />
            <path d="M 90 215 L 380 215 L 380 160" fill="none" stroke="#3b82f6" strokeWidth="2" />

            {/* Leg Lines */}
            <line x1="180" y1="50" x2="180" y2="270" stroke="#334155" strokeWidth="2" />
            <line x1="280" y1="50" x2="280" y2="270" stroke="#334155" strokeWidth="2" />
            <line x1="380" y1="50" x2="380" y2="270" stroke="#334155" strokeWidth="2" />

            {/* DC Bus Rails */}
            <path d="M 180 50 L 540 50 L 540 120" fill="none" style={flowStyle(true, '#22c55e')} />
            <path d="M 540 200 L 540 270 L 180 270" fill="none" style={flowStyle(true, '#22c55e')} />

            {/* Load */}
            <rect x="515" y="120" width="50" height="80" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            <text x="540" y="152" fill="#e2e8f0" fontSize="11" fontWeight="bold" textAnchor="middle">LOAD</text>
            <text x="540" y="170" fill="#22c55e" fontSize="10" fontWeight="bold" textAnchor="middle">+ Vo -</text>

            {/* 6 Bridge Switches */}
            {renderSwitch('T1', 180, 95, 'vertical', 'reverse')}
            {renderSwitch('T4', 180, 225, 'vertical', 'reverse')}
            {renderSwitch('T3', 280, 95, 'vertical', 'reverse')}
            {renderSwitch('T6', 280, 225, 'vertical', 'reverse')}
            {renderSwitch('T5', 380, 95, 'vertical', 'reverse')}
            {renderSwitch('T2', 380, 225, 'vertical', 'reverse')}
          </g>
        )}

        {/* ================= 6. DC-DC BUCK CONVERTER ================= */}
        {topology.id === 'dcdc_buck' && (
          <g transform="translate(60, 20)">
            <circle cx="80" cy="160" r="26" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="80" y="165" fill="#38bdf8" fontSize="13" fontWeight="bold" textAnchor="middle">DC</text>
            <text x="80" y="202" fill="#94a3b8" fontSize="12" textAnchor="middle">Vin</text>

            <path d="M 80 134 L 80 80 L 190 80" fill="none" style={flowStyle(curPaths.path_switch_on, '#22c55e')} />
            <path d="M 270 80 L 330 80" fill="none" style={flowStyle(curPaths.path_switch_on, '#22c55e')} />

            {/* Inductor L Coil */}
            <path d="M 330 80 Q 345 60 360 80 Q 375 60 390 80 Q 405 60 420 80 Q 435 60 450 80" fill="none" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="390" y="55" fill="#94a3b8" fontSize="11" textAnchor="middle">Inductor L</text>

            <path d="M 450 80 L 580 80 L 580 120" fill="none" style={flowStyle(curPaths.path_switch_on || curPaths.path_diode_on, '#22c55e')} />
            <path d="M 580 200 L 580 240 L 80 240 L 80 186" fill="none" style={flowStyle(curPaths.path_switch_on, '#22c55e')} />

            {/* Freewheeling Diode Branch */}
            <line x1="300" y1="80" x2="300" y2="240" stroke="#334155" strokeWidth="2" />
            <path d="M 300 240 L 300 80 L 450 80 L 580 80 L 580 240 L 300 240" fill="none" style={flowStyle(curPaths.path_diode_on, '#eab308')} />

            <rect x="555" y="120" width="50" height="80" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            <text x="580" y="152" fill="#e2e8f0" fontSize="11" fontWeight="bold" textAnchor="middle">LOAD</text>
            <text x="580" y="170" fill="#22c55e" fontSize="10" fontWeight="bold" textAnchor="middle">Vo (Buck)</text>

            {/* True Symbols */}
            {renderSwitch('S1', 230, 80, 'horizontal', 'forward')}
            {renderSwitch('D1', 300, 160, 'vertical', 'reverse')}
          </g>
        )}

        {/* ================= 7. DC-DC BOOST CONVERTER ================= */}
        {topology.id === 'dcdc_boost' && (
          <g transform="translate(60, 20)">
            <circle cx="80" cy="160" r="26" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="80" y="165" fill="#38bdf8" fontSize="13" fontWeight="bold" textAnchor="middle">DC</text>
            <text x="80" y="202" fill="#94a3b8" fontSize="12" textAnchor="middle">Vin</text>

            <path d="M 80 134 L 80 80 L 160 80" fill="none" style={flowStyle(true, '#22c55e')} />
            <path d="M 160 80 Q 175 60 190 80 Q 205 60 220 80 Q 235 60 250 80 Q 265 60 280 80" fill="none" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="220" y="55" fill="#94a3b8" fontSize="11" textAnchor="middle">Inductor L</text>

            <line x1="320" y1="80" x2="320" y2="240" stroke="#334155" strokeWidth="2" />
            <path d="M 80 80 L 280 80 L 320 80 L 320 240 L 80 240 L 80 186" fill="none" style={flowStyle(curPaths.path_switch_on, '#22c55e')} />

            <path d="M 320 80 L 400 80" fill="none" style={flowStyle(curPaths.path_diode_on, '#06b6d4')} />
            <path d="M 460 80 L 580 80 L 580 120" fill="none" style={flowStyle(curPaths.path_diode_on, '#06b6d4')} />
            <path d="M 580 200 L 580 240 L 80 240" fill="none" style={flowStyle(curPaths.path_diode_on, '#06b6d4')} />

            <rect x="555" y="120" width="50" height="80" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            <text x="580" y="152" fill="#e2e8f0" fontSize="11" fontWeight="bold" textAnchor="middle">LOAD</text>
            <text x="580" y="170" fill="#22c55e" fontSize="10" fontWeight="bold" textAnchor="middle">Vo (Boost)</text>

            {renderSwitch('S1', 320, 160, 'vertical', 'forward')}
            {renderSwitch('D1', 430, 80, 'horizontal', 'forward')}
          </g>
        )}

        {/* ================= 8. DC-DC BUCK-BOOST CONVERTER ================= */}
        {topology.id === 'dcdc_buck_boost' && (
          <g transform="translate(60, 20)">
            <circle cx="80" cy="160" r="26" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="80" y="165" fill="#38bdf8" fontSize="13" fontWeight="bold" textAnchor="middle">DC</text>
            <text x="80" y="202" fill="#94a3b8" fontSize="12" textAnchor="middle">Vin</text>

            <path d="M 80 134 L 80 80 L 200 80" fill="none" style={flowStyle(curPaths.path_switch_on, '#22c55e')} />
            <path d="M 260 80 L 330 80" fill="none" style={flowStyle(curPaths.path_switch_on, '#22c55e')} />

            {/* Inductor in shunt to ground */}
            <line x1="330" y1="80" x2="330" y2="120" stroke="#38bdf8" strokeWidth="2" />
            <path d="M 330 120 Q 315 135 330 150 Q 315 165 330 180 Q 315 195 330 210 L 330 240" fill="none" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="365" y="165" fill="#94a3b8" fontSize="11" textAnchor="middle">L</text>

            {/* Diode facing reversed (anode to output, cathode to inductor) */}
            <path d="M 330 80 L 410 80" fill="none" style={flowStyle(curPaths.path_diode_on, '#06b6d4')} />
            <path d="M 470 80 L 580 80 L 580 120" fill="none" style={flowStyle(curPaths.path_diode_on, '#06b6d4')} />
            <path d="M 580 200 L 580 240 L 80 240 L 80 186" fill="none" stroke="#334155" strokeWidth="2" />

            <rect x="555" y="120" width="50" height="80" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            <text x="580" y="152" fill="#e2e8f0" fontSize="11" fontWeight="bold" textAnchor="middle">LOAD</text>
            <text x="580" y="170" fill="#22c55e" fontSize="10" fontWeight="bold" textAnchor="middle">- Vo +</text>

            {renderSwitch('S1', 230, 80, 'horizontal', 'forward')}
            {renderSwitch('D1', 440, 80, 'horizontal', 'reverse')}
          </g>
        )}

        {/* ================= 9. DC-DC CUK CONVERTER ================= */}
        {topology.id === 'dcdc_cuk' && (
          <g transform="translate(40, 20)">
            <circle cx="60" cy="160" r="24" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="60" y="165" fill="#38bdf8" fontSize="12" fontWeight="bold" textAnchor="middle">Vin</text>

            {/* Input Inductor L1 */}
            <path d="M 60 136 L 60 80 L 140 80" fill="none" stroke="#38bdf8" strokeWidth="2" />
            <path d="M 140 80 Q 155 65 170 80 Q 185 65 200 80 Q 215 65 230 80" fill="none" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="185" y="60" fill="#94a3b8" fontSize="10" textAnchor="middle">L1</text>

            {/* Switch S1 to Ground */}
            <line x1="250" y1="80" x2="250" y2="240" stroke="#334155" strokeWidth="2" />

            {/* Energy Transfer Capacitor C1 */}
            <path d="M 250 80 L 330 80" fill="none" stroke="#38bdf8" strokeWidth="2" />
            <line x1="330" y1="70" x2="330" y2="90" stroke="#38bdf8" strokeWidth="2.5" />
            <line x1="338" y1="70" x2="338" y2="90" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="334" y="62" fill="#94a3b8" fontSize="10" textAnchor="middle">C1</text>
            <path d="M 338 80 L 420 80" fill="none" stroke="#38bdf8" strokeWidth="2" />

            {/* Diode D1 in shunt */}
            <line x1="420" y1="80" x2="420" y2="240" stroke="#334155" strokeWidth="2" />

            {/* Output Inductor L2 */}
            <path d="M 420 80 Q 435 65 450 80 Q 465 65 480 80 Q 495 65 510 80 L 580 80 L 580 120" fill="none" stroke="#38bdf8" strokeWidth="2" />
            <text x="465" y="60" fill="#94a3b8" fontSize="10" textAnchor="middle">L2</text>
            <path d="M 580 200 L 580 240 L 60 240 L 60 184" fill="none" stroke="#334155" strokeWidth="2" />

            <rect x="555" y="120" width="50" height="80" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            <text x="580" y="152" fill="#e2e8f0" fontSize="10" fontWeight="bold" textAnchor="middle">LOAD</text>
            <text x="580" y="170" fill="#22c55e" fontSize="9" fontWeight="bold" textAnchor="middle">- Vo +</text>

            {renderSwitch('S1', 250, 160, 'vertical', 'forward')}
            {renderSwitch('D1', 420, 160, 'vertical', 'reverse')}
          </g>
        )}

        {/* ================= 10. DC-DC SEPIC CONVERTER ================= */}
        {topology.id === 'dcdc_sepic' && (
          <g transform="translate(40, 20)">
            <circle cx="60" cy="160" r="24" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="60" y="165" fill="#38bdf8" fontSize="12" fontWeight="bold" textAnchor="middle">Vin</text>

            {/* Input Inductor L1 */}
            <path d="M 60 136 L 60 80 L 140 80" fill="none" stroke="#38bdf8" strokeWidth="2" />
            <path d="M 140 80 Q 155 65 170 80 Q 185 65 200 80 Q 215 65 230 80" fill="none" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="185" y="60" fill="#94a3b8" fontSize="10" textAnchor="middle">L1</text>

            {/* Switch S1 to Ground */}
            <line x1="250" y1="80" x2="250" y2="240" stroke="#334155" strokeWidth="2" />

            {/* Series Capacitor C1 */}
            <path d="M 250 80 L 330 80" fill="none" stroke="#38bdf8" strokeWidth="2" />
            <line x1="330" y1="70" x2="330" y2="90" stroke="#38bdf8" strokeWidth="2.5" />
            <line x1="338" y1="70" x2="338" y2="90" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="334" y="62" fill="#94a3b8" fontSize="10" textAnchor="middle">C1</text>
            <path d="M 338 80 L 420 80" fill="none" stroke="#38bdf8" strokeWidth="2" />

            {/* Inductor L2 in shunt to ground */}
            <path d="M 420 80 L 420 120 Q 405 135 420 150 Q 405 165 420 180 Q 405 195 420 210 L 420 240" fill="none" stroke="#38bdf8" strokeWidth="2" />
            <text x="440" y="165" fill="#94a3b8" fontSize="10">L2</text>

            {/* Series Diode D1 */}
            <path d="M 420 80 L 480 80" fill="none" stroke="#38bdf8" strokeWidth="2" />
            <path d="M 540 80 L 590 80 L 590 120" fill="none" stroke="#38bdf8" strokeWidth="2" />
            <path d="M 590 200 L 590 240 L 60 240 L 60 184" fill="none" stroke="#334155" strokeWidth="2" />

            <rect x="565" y="120" width="50" height="80" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            <text x="590" y="152" fill="#e2e8f0" fontSize="11" fontWeight="bold" textAnchor="middle">LOAD</text>
            <text x="590" y="170" fill="#22c55e" fontSize="9" fontWeight="bold" textAnchor="middle">+ Vo -</text>

            {renderSwitch('S1', 250, 160, 'vertical', 'forward')}
            {renderSwitch('D1', 510, 80, 'horizontal', 'forward')}
          </g>
        )}

        {/* ================= 11. DC-DC FLYBACK CONVERTER ================= */}
        {topology.id === 'dcdc_flyback' && (
          <g transform="translate(40, 20)">
            <circle cx="60" cy="160" r="24" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="60" y="165" fill="#38bdf8" fontSize="12" fontWeight="bold" textAnchor="middle">Vin</text>

            {/* Primary Loop to Transformer */}
            <path d="M 60 136 L 60 70 L 260 70" fill="none" style={flowStyle(curPaths.path_switch_on, '#22c55e')} />
            <path d="M 260 145 L 260 170" fill="none" stroke="#38bdf8" strokeWidth="2" />
            <path d="M 260 215 L 260 250 L 60 250 L 60 184" fill="none" style={flowStyle(curPaths.path_switch_on, '#22c55e')} />

            {/* Primary Inductor Winding */}
            <path d="M 260 70 Q 240 85 260 95 Q 240 105 260 115 Q 240 125 260 135 L 260 145" fill="none" stroke="#38bdf8" strokeWidth="2.5" />
            <circle cx="242" cy="74" r="3.5" fill="#eab308" />

            {/* Ferrite Core Isolation Barrier */}
            <line x1="280" y1="60" x2="280" y2="160" stroke="#64748b" strokeWidth="2" strokeDasharray="3 3" />
            <line x1="285" y1="60" x2="285" y2="160" stroke="#64748b" strokeWidth="2" strokeDasharray="3 3" />
            <text x="282" y="50" fill="#94a3b8" fontSize="10" fontWeight="bold" textAnchor="middle">CORE</text>

            {/* Secondary Inductor Winding (Opposing dot for flyback) */}
            <path d="M 305 70 Q 325 85 305 95 Q 325 105 305 115 Q 325 125 305 135 L 305 150" fill="none" stroke="#38bdf8" strokeWidth="2.5" />
            <circle cx="323" cy="145" r="3.5" fill="#eab308" />

            <path d="M 305 70 L 410 70" fill="none" style={flowStyle(curPaths.path_diode_on, '#eab308')} />
            <path d="M 470 70 L 600 70 L 600 110" fill="none" style={flowStyle(curPaths.path_diode_on, '#eab308')} />
            <path d="M 600 190 L 600 230 L 305 230 L 305 150" fill="none" style={flowStyle(curPaths.path_diode_on, '#eab308')} />

            <rect x="575" y="110" width="50" height="80" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            <text x="600" y="142" fill="#e2e8f0" fontSize="11" fontWeight="bold" textAnchor="middle">LOAD</text>
            <text x="600" y="160" fill="#22c55e" fontSize="10" fontWeight="bold" textAnchor="middle">+ Vo -</text>

            {renderSwitch('S1', 260, 190, 'vertical', 'forward')}
            {renderSwitch('D1', 440, 70, 'horizontal', 'forward')}
          </g>
        )}

        {/* ================= 12. DC-DC FORWARD CONVERTER ================= */}
        {topology.id === 'dcdc_forward' && (
          <g transform="translate(30, 15)">
            <circle cx="50" cy="150" r="22" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="50" y="154" fill="#38bdf8" fontSize="11" fontWeight="bold" textAnchor="middle">Vin</text>

            <path d="M 50 128 L 50 60 L 190 60 L 190 80" fill="none" style={flowStyle(curPaths.path_switch_on, '#22c55e')} />
            <path d="M 190 140 L 190 160" fill="none" stroke="#38bdf8" strokeWidth="2" />
            <path d="M 190 205 L 190 240 L 50 240 L 50 172" fill="none" style={flowStyle(curPaths.path_switch_on, '#22c55e')} />

            <line x1="215" y1="50" x2="215" y2="210" stroke="#64748b" strokeWidth="2" strokeDasharray="3 3" />
            <line x1="220" y1="50" x2="220" y2="210" stroke="#64748b" strokeWidth="2" strokeDasharray="3 3" />

            <path d="M 240 60 L 320 60" fill="none" style={flowStyle(curPaths.path_switch_on, '#22c55e')} />
            <path d="M 380 60 L 460 60" fill="none" style={flowStyle(curPaths.path_switch_on, '#22c55e')} />

            {/* Inductor L */}
            <path d="M 460 60 Q 475 42 490 60 Q 505 42 520 60 Q 535 42 550 60 L 630 60 L 630 100" fill="none" stroke="#38bdf8" strokeWidth="2.5" />
            <path d="M 630 180 L 630 220 L 240 220 L 240 140" fill="none" style={flowStyle(curPaths.path_switch_on || curPaths.path_diode_on, '#22c55e')} />

            {/* Freewheel Diode Branch D2 */}
            <line x1="430" y1="60" x2="430" y2="220" stroke="#334155" strokeWidth="2" />

            <rect x="605" y="100" width="50" height="80" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            <text x="630" y="132" fill="#e2e8f0" fontSize="11" fontWeight="bold" textAnchor="middle">LOAD</text>
            <text x="630" y="150" fill="#22c55e" fontSize="10" fontWeight="bold" textAnchor="middle">+ Vo -</text>

            {renderSwitch('S1', 190, 185, 'vertical', 'forward')}
            {renderSwitch('D1', 350, 60, 'horizontal', 'forward')}
            {renderSwitch('D2', 430, 140, 'vertical', 'reverse')}
          </g>
        )}

        {/* ================= 13. DC-DC PUSH-PULL ISOLATED ================= */}
        {topology.id === 'dcdc_push_pull_iso' && (
          <g transform="translate(40, 20)">
            <circle cx="50" cy="150" r="22" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="50" y="154" fill="#38bdf8" fontSize="11" fontWeight="bold" textAnchor="middle">Vin</text>

            <path d="M 50 128 L 50 60 L 160 60 L 160 150" fill="none" style={flowStyle(curPaths.path_s1 || curPaths.path_s2, '#22c55e')} />
            <text x="145" y="153" fill="#eab308" fontSize="9" fontWeight="bold">CT</text>

            <line x1="180" y1="90" x2="180" y2="210" stroke="#38bdf8" strokeWidth="3" />
            <circle cx="180" cy="150" r="3" fill="#eab308" />

            <path d="M 180 90 L 220 90 L 220 100" fill="none" style={flowStyle(curPaths.path_s1, '#22c55e')} />
            <path d="M 220 145 L 220 250 L 50 250 L 50 172" fill="none" style={flowStyle(curPaths.path_s1, '#22c55e')} />

            <path d="M 180 210 L 220 210 L 220 185" fill="none" style={flowStyle(curPaths.path_s2, '#ec4899')} />
            <path d="M 220 230 L 220 250" fill="none" style={flowStyle(curPaths.path_s2, '#ec4899')} />

            <line x1="260" y1="60" x2="260" y2="240" stroke="#64748b" strokeWidth="2" strokeDasharray="3 3" />
            <line x1="265" y1="60" x2="265" y2="240" stroke="#64748b" strokeWidth="2" strokeDasharray="3 3" />

            <line x1="290" y1="80" x2="290" y2="220" stroke="#38bdf8" strokeWidth="3" />
            <circle cx="290" cy="150" r="3" fill="#eab308" />

            <path d="M 290 80 L 350 80" fill="none" style={flowStyle(curPaths.path_d1, '#22c55e')} />
            <path d="M 410 80 L 480 80 L 480 120" fill="none" style={flowStyle(curPaths.path_d1, '#22c55e')} />

            <path d="M 290 220 L 350 220" fill="none" style={flowStyle(curPaths.path_d2, '#ec4899')} />
            <path d="M 410 220 L 480 220 L 480 120" fill="none" style={flowStyle(curPaths.path_d2, '#ec4899')} />

            <path d="M 290 150 L 610 150 L 610 200" fill="none" stroke="#334155" strokeWidth="2" />

            <rect x="605" y="110" width="50" height="70" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            <text x="630" y="140" fill="#e2e8f0" fontSize="10" fontWeight="bold" textAnchor="middle">LOAD</text>
            <text x="630" y="156" fill="#22c55e" fontSize="9" fontWeight="bold" textAnchor="middle">Vo</text>

            {renderSwitch('S1', 220, 120, 'vertical', 'forward')}
            {renderSwitch('S2', 220, 205, 'vertical', 'forward')}
            {renderSwitch('D1', 380, 80, 'horizontal', 'forward')}
            {renderSwitch('D2', 380, 220, 'horizontal', 'forward')}
          </g>
        )}

        {/* ================= 14. DC-DC FULL-BRIDGE ISOLATED ================= */}
        {topology.id === 'dcdc_full_bridge_iso' && (
          <g transform="translate(30, 20)">
            <circle cx="50" cy="150" r="22" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="50" y="154" fill="#38bdf8" fontSize="11" fontWeight="bold" textAnchor="middle">Vin</text>

            <path d="M 50 128 L 50 60 L 260 60" fill="none" stroke="#334155" strokeWidth="2" />
            <path d="M 50 172 L 50 240 L 260 240" fill="none" stroke="#334155" strokeWidth="2" />

            <line x1="150" y1="60" x2="150" y2="240" stroke="#334155" strokeWidth="2" />
            <line x1="250" y1="60" x2="250" y2="240" stroke="#334155" strokeWidth="2" />

            <path d="M 150 150 L 300 150" fill="none" style={flowStyle(curPaths.path_s1, '#22c55e')} />
            <path d="M 250 150 L 300 150" fill="none" style={flowStyle(curPaths.path_s2, '#ec4899')} />

            <line x1="300" y1="110" x2="300" y2="190" stroke="#38bdf8" strokeWidth="3" />
            <line x1="320" y1="80" x2="320" y2="220" stroke="#64748b" strokeWidth="2" strokeDasharray="3 3" />
            <line x1="325" y1="80" x2="325" y2="220" stroke="#64748b" strokeWidth="2" strokeDasharray="3 3" />
            <line x1="345" y1="100" x2="345" y2="200" stroke="#38bdf8" strokeWidth="3" />

            <path d="M 345 100 L 410 100" fill="none" style={flowStyle(curPaths.path_d1, '#22c55e')} />
            <path d="M 470 100 L 520 100 L 520 150" fill="none" style={flowStyle(curPaths.path_d1, '#22c55e')} />

            <path d="M 345 200 L 410 200" fill="none" style={flowStyle(curPaths.path_d2, '#ec4899')} />
            <path d="M 470 200 L 520 200 L 520 150" fill="none" style={flowStyle(curPaths.path_d2, '#ec4899')} />

            <rect x="640" y="115" width="50" height="70" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            <text x="665" y="145" fill="#e2e8f0" fontSize="10" fontWeight="bold" textAnchor="middle">LOAD</text>
            <text x="665" y="160" fill="#22c55e" fontSize="9" fontWeight="bold" textAnchor="middle">Vo</text>

            {/* 4 Primary Switches */}
            {renderSwitch('S1', 150, 95, 'vertical', 'forward')}
            {renderSwitch('S4', 150, 205, 'vertical', 'forward')}
            {renderSwitch('S3', 250, 95, 'vertical', 'forward')}
            {renderSwitch('S2', 250, 205, 'vertical', 'forward')}

            {/* 2 Secondary Diodes */}
            {renderSwitch('D1', 440, 100, 'horizontal', 'forward')}
            {renderSwitch('D2', 440, 200, 'horizontal', 'forward')}
          </g>
        )}

        {/* ================= 15. DC-AC FULL BRIDGE INVERTER ================= */}
        {topology.id === 'dcac_full_bridge' && (
          <g transform="translate(60, 20)">
            <circle cx="80" cy="160" r="26" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="80" y="165" fill="#38bdf8" fontSize="13" fontWeight="bold" textAnchor="middle">DC</text>
            <text x="80" y="202" fill="#94a3b8" fontSize="12" textAnchor="middle">Vdc</text>

            <path d="M 80 134 L 80 60 L 440 60" fill="none" stroke="#334155" strokeWidth="2" />
            <path d="M 80 186 L 80 260 L 440 260" fill="none" stroke="#334155" strokeWidth="2" />

            <line x1="220" y1="60" x2="220" y2="260" stroke="#334155" strokeWidth="2" />
            <line x1="360" y1="60" x2="360" y2="260" stroke="#334155" strokeWidth="2" />

            <path d="M 220 160 L 260 160" fill="none" stroke="#38bdf8" strokeWidth="2" />
            <path d="M 320 160 L 360 160" fill="none" stroke="#38bdf8" strokeWidth="2" />
            <rect x="260" y="135" width="60" height="50" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            <text x="290" y="165" fill="#22c55e" fontSize="11" fontWeight="bold" textAnchor="middle">AC LOAD</text>

            {renderSwitch('S1', 220, 105, 'vertical', 'forward')}
            {renderSwitch('S4', 220, 215, 'vertical', 'forward')}
            {renderSwitch('S3', 360, 105, 'vertical', 'forward')}
            {renderSwitch('S2', 360, 215, 'vertical', 'forward')}
          </g>
        )}

        {/* ================= 16. DC-AC 3-PHASE VSI ================= */}
        {topology.id === 'dcac_3ph_vsi' && (
          <g transform="translate(40, 20)">
            <circle cx="60" cy="160" r="26" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="60" y="165" fill="#38bdf8" fontSize="13" fontWeight="bold" textAnchor="middle">Vdc</text>

            {/* DC Rails */}
            <path d="M 60 134 L 60 50 L 480 50" fill="none" stroke="#334155" strokeWidth="2" />
            <path d="M 60 186 L 60 270 L 480 270" fill="none" stroke="#334155" strokeWidth="2" />

            {/* 3 Legs */}
            <line x1="180" y1="50" x2="180" y2="270" stroke="#334155" strokeWidth="2" />
            <line x1="300" y1="50" x2="300" y2="270" stroke="#334155" strokeWidth="2" />
            <line x1="420" y1="50" x2="420" y2="270" stroke="#334155" strokeWidth="2" />

            {/* Midpoint Phase lines out to Star Load */}
            <path d="M 180 160 L 560 120" fill="none" stroke="#ef4444" strokeWidth="2" />
            <path d="M 300 160 L 560 160" fill="none" stroke="#eab308" strokeWidth="2" />
            <path d="M 420 160 L 560 200" fill="none" stroke="#3b82f6" strokeWidth="2" />

            <rect x="560" y="105" width="85" height="110" rx="8" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            <text x="602" y="130" fill="#e2e8f0" fontSize="10" fontWeight="bold" textAnchor="middle">3-PHASE</text>
            <text x="602" y="148" fill="#e2e8f0" fontSize="10" fontWeight="bold" textAnchor="middle">STAR LOAD</text>
            <text x="602" y="170" fill="#22c55e" fontSize="10" fontWeight="bold" textAnchor="middle">A - B - C</text>

            {/* 6 Inverter Switches */}
            {renderSwitch('S1', 180, 100, 'vertical', 'forward')}
            {renderSwitch('S4', 180, 220, 'vertical', 'forward')}
            {renderSwitch('S3', 300, 100, 'vertical', 'forward')}
            {renderSwitch('S6', 300, 220, 'vertical', 'forward')}
            {renderSwitch('S5', 420, 100, 'vertical', 'forward')}
            {renderSwitch('S2', 420, 220, 'vertical', 'forward')}
          </g>
        )}

        {/* ================= 17. AC-AC CONTROLLER ================= */}
        {topology.id === 'acac_1ph_controller' && (
          <g transform="translate(60, 20)">
            <circle cx="80" cy="160" r="26" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
            <path d="M 66 160 Q 73 148 80 160 T 94 160" fill="none" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="80" y="202" fill="#94a3b8" fontSize="12" textAnchor="middle">Vs (AC)</text>

            <path d="M 80 134 L 80 80 L 220 80" fill="none" style={flowStyle(curPaths.path_pos, '#22c55e')} />
            <path d="M 80 80 L 220 80" fill="none" style={flowStyle(curPaths.path_neg, '#ec4899')} />

            {/* Antiparallel branches */}
            <line x1="220" y1="80" x2="240" y2="50" stroke="#334155" strokeWidth="2" />
            <line x1="220" y1="80" x2="240" y2="110" stroke="#334155" strokeWidth="2" />
            <line x1="340" y1="50" x2="360" y2="80" stroke="#334155" strokeWidth="2" />
            <line x1="340" y1="110" x2="360" y2="80" stroke="#334155" strokeWidth="2" />

            <path d="M 360 80 L 520 80 L 520 120" fill="none" style={flowStyle(true, '#22c55e')} />
            <path d="M 520 200 L 520 240 L 80 240 L 80 186" fill="none" style={flowStyle(true, '#22c55e')} />

            <rect x="495" y="120" width="50" height="80" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            <text x="520" y="152" fill="#e2e8f0" fontSize="11" fontWeight="bold" textAnchor="middle">LOAD</text>
            <text x="520" y="170" fill="#22c55e" fontSize="10" fontWeight="bold" textAnchor="middle">Vo (AC)</text>

            {renderSwitch('S1', 290, 50, 'horizontal', 'forward')}
            {renderSwitch('S2', 290, 110, 'horizontal', 'reverse')}
          </g>
        )}

        {/* ================= 18. AC-AC CYCLOCONVERTER ================= */}
        {topology.id === 'acac_1ph_cycloconverter' && (
          <g transform="translate(60, 20)">
            <circle cx="80" cy="160" r="26" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
            <path d="M 66 160 Q 73 148 80 160 T 94 160" fill="none" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="80" y="202" fill="#94a3b8" fontSize="12" textAnchor="middle">Vs (50Hz)</text>

            {/* Positive and Negative Converter Banks */}
            <path d="M 80 134 L 80 80 L 220 80" fill="none" stroke="#38bdf8" strokeWidth="2" />
            <path d="M 80 186 L 80 240 L 220 240" fill="none" stroke="#38bdf8" strokeWidth="2" />

            <path d="M 220 80 L 240 50" stroke="#334155" strokeWidth="2" />
            <path d="M 220 80 L 240 110" stroke="#334155" strokeWidth="2" />
            <path d="M 340 50 L 360 80" stroke="#334155" strokeWidth="2" />
            <path d="M 340 110 L 360 80" stroke="#334155" strokeWidth="2" />

            <path d="M 360 80 L 520 80 L 520 120" fill="none" style={flowStyle(true, '#22c55e')} />
            <path d="M 520 200 L 520 240 L 80 240" fill="none" stroke="#334155" strokeWidth="2" />

            <rect x="495" y="120" width="50" height="80" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            <text x="520" y="148" fill="#e2e8f0" fontSize="10" fontWeight="bold" textAnchor="middle">CYCLO</text>
            <text x="520" y="164" fill="#e2e8f0" fontSize="10" fontWeight="bold" textAnchor="middle">LOAD</text>
            <text x="520" y="180" fill="#22c55e" fontSize="9" fontWeight="bold" textAnchor="middle">fo = fs / m</text>

            {renderSwitch('P1', 290, 50, 'horizontal', 'forward')}
            {renderSwitch('N1', 290, 110, 'horizontal', 'reverse')}
          </g>
        )}
      </svg>
    </div>
  );
}
