import { SwitchModel, SwitchState, TopologyDefinition } from '../types';

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

  const getDeviceBadge = (slotId: string, state: SwitchState, label: string) => {
    const isSelected = selectedSlot === slotId;
    let bg = 'bg-slate-700 text-slate-300 border-slate-600';
    if (state === 'ON') bg = 'bg-emerald-600/90 text-white border-emerald-400 shadow-emerald-500/30';
    if (state === 'TRIGGERED') bg = 'bg-cyan-600/90 text-white border-cyan-400 shadow-cyan-500/30';
    if (state === 'FREEWHEELING') bg = 'bg-amber-600/90 text-white border-amber-400 shadow-amber-500/30';

    return (
      <button
        onClick={() => onSelectDevice(slotId)}
        className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold border shadow transition-all flex items-center gap-1.5 ${bg} ${
          isSelected ? 'ring-2 ring-white scale-105' : 'hover:scale-102'
        }`}
        title={`Click to inspect ${devices[slotId]?.name || label}`}
      >
        <span>{slotId}</span>
        <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-black/30 font-bold">{state}</span>
      </button>
    );
  };

  // SVG Flow Animation Style
  const flowStyle = (active: boolean, color = '#22c55e') => ({
    stroke: active ? color : '#334155',
    strokeWidth: active ? 3.5 : 2,
    strokeDasharray: active ? '6, 6' : 'none',
    animation: active ? 'currentFlow 0.8s linear infinite' : 'none',
    filter: active ? `drop-shadow(0 0 4px ${color})` : 'none',
    transition: 'stroke 0.15s, stroke-width 0.15s',
  });

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
          <span className="text-slate-400">Active Flow</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="text-slate-400">Freewheeling</span>
        </div>
      </div>

      {/* SVG Canvas */}
      <svg viewBox="0 0 800 360" className="w-full h-full max-h-[340px]">
        {/* ================= AC-DC SINGLE PHASE FULL BRIDGE ================= */}
        {topology.id === 'acdc_1ph_full_bridge' && (
          <g transform="translate(40, 20)">
            {/* AC Source */}
            <circle cx="80" cy="160" r="26" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
            <path d="M 66 160 Q 73 148 80 160 T 94 160" fill="none" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="80" y="202" fill="#94a3b8" fontSize="12" textAnchor="middle" fontFamily="sans-serif">
              Vs (AC)
            </text>

            {/* AC Lines to Bridge */}
            <path d="M 80 134 L 80 100 L 220 100 L 220 160" fill="none" style={flowStyle(curPaths.path_pos, '#22c55e')} />
            <path d="M 80 186 L 80 220 L 340 220 L 340 160" fill="none" style={flowStyle(curPaths.path_neg, '#06b6d4')} />

            {/* Bridge Legs */}
            {/* Leg 1: T1 & T4 */}
            <line x1="220" y1="60" x2="220" y2="260" stroke="#334155" strokeWidth="2" />
            {/* Leg 2: T3 & T2 */}
            <line x1="340" y1="60" x2="340" y2="260" stroke="#334155" strokeWidth="2" />

            {/* Upper Rail to Load */}
            <path d="M 220 60 L 520 60 L 520 120" fill="none" style={flowStyle(curPaths.path_pos || curPaths.path_neg, '#22c55e')} />
            {/* Lower Rail from Load */}
            <path d="M 520 200 L 520 260 L 220 260" fill="none" style={flowStyle(curPaths.path_pos || curPaths.path_neg, '#22c55e')} />

            {/* Load Box (R - L) */}
            <rect x="495" y="120" width="50" height="80" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            <text x="520" y="148" fill="#e2e8f0" fontSize="11" fontWeight="bold" textAnchor="middle">
              LOAD
            </text>
            <text x="520" y="166" fill="#94a3b8" fontSize="10" textAnchor="middle">
              R + L
            </text>
            <text x="520" y="182" fill="#22c55e" fontSize="10" fontWeight="bold" textAnchor="middle">
              + Vo -
            </text>

            {/* Switch Badges */}
            <foreignObject x="180" y="70" width="80" height="35">
              {getDeviceBadge('T1', currentStates['T1'], 'T1')}
            </foreignObject>
            <foreignObject x="300" y="70" width="80" height="35">
              {getDeviceBadge('T3', currentStates['T3'], 'T3')}
            </foreignObject>
            <foreignObject x="180" y="195" width="80" height="35">
              {getDeviceBadge('T4', currentStates['T4'], 'T4')}
            </foreignObject>
            <foreignObject x="300" y="195" width="80" height="35">
              {getDeviceBadge('T2', currentStates['T2'], 'T2')}
            </foreignObject>
          </g>
        )}

        {/* ================= AC-DC SINGLE PHASE HALF WAVE ================= */}
        {topology.id === 'acdc_1ph_half_wave' && (
          <g transform="translate(60, 20)">
            {/* AC Source */}
            <circle cx="80" cy="160" r="26" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
            <path d="M 66 160 Q 73 148 80 160 T 94 160" fill="none" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="80" y="202" fill="#94a3b8" fontSize="12" textAnchor="middle">
              Vs (AC)
            </text>

            {/* Top Wire with T1 */}
            <path d="M 80 134 L 80 80 L 240 80" fill="none" style={flowStyle(curPaths.path_pos, '#22c55e')} />
            <path d="M 320 80 L 480 80 L 480 120" fill="none" style={flowStyle(curPaths.path_pos, '#22c55e')} />

            {/* Bottom Return Wire */}
            <path d="M 480 200 L 480 240 L 80 240 L 80 186" fill="none" style={flowStyle(curPaths.path_pos, '#22c55e')} />

            {/* Freewheeling Diode Branch */}
            <line x1="380" y1="80" x2="380" y2="240" stroke="#334155" strokeWidth="2" />
            <path d="M 480 120 L 480 80 L 380 80 L 380 240 L 480 240 L 480 200" fill="none" style={flowStyle(curPaths.path_fwd, '#eab308')} />

            {/* Load */}
            <rect x="455" y="120" width="50" height="80" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            <text x="480" y="152" fill="#e2e8f0" fontSize="11" fontWeight="bold" textAnchor="middle">
              LOAD
            </text>
            <text x="480" y="170" fill="#94a3b8" fontSize="10" textAnchor="middle">
              R + L
            </text>

            {/* Badges */}
            <foreignObject x="235" y="62" width="85" height="35">
              {getDeviceBadge('T1', currentStates['T1'], 'T1')}
            </foreignObject>
            <foreignObject x="340" y="145" width="85" height="35">
              {getDeviceBadge('DFWD', currentStates['DFWD'], 'DFWD')}
            </foreignObject>
          </g>
        )}

        {/* ================= DC-DC BUCK CONVERTER ================= */}
        {topology.id === 'dcdc_buck' && (
          <g transform="translate(60, 20)">
            {/* DC Voltage Source */}
            <circle cx="80" cy="160" r="26" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="80" y="165" fill="#38bdf8" fontSize="13" fontWeight="bold" textAnchor="middle">
              DC
            </text>
            <text x="80" y="202" fill="#94a3b8" fontSize="12" textAnchor="middle">
              Vin
            </text>

            {/* Input to Switch S1 */}
            <path d="M 80 134 L 80 80 L 200 80" fill="none" style={flowStyle(curPaths.path_switch_on, '#22c55e')} />

            {/* Switch S1 to Inductor */}
            <path d="M 280 80 L 340 80" fill="none" style={flowStyle(curPaths.path_switch_on, '#22c55e')} />

            {/* Inductor L Coil */}
            <path
              d="M 340 80 Q 355 60 370 80 Q 385 60 400 80 Q 415 60 430 80 Q 445 60 460 80"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.5"
            />
            <text x="400" y="55" fill="#94a3b8" fontSize="11" textAnchor="middle">
              Inductor L
            </text>

            {/* Output to Capacitor & Load */}
            <path d="M 460 80 L 580 80 L 580 120" fill="none" style={flowStyle(curPaths.path_switch_on || curPaths.path_diode_on, '#22c55e')} />
            <path d="M 580 200 L 580 240 L 80 240 L 80 186" fill="none" style={flowStyle(curPaths.path_switch_on, '#22c55e')} />

            {/* Freewheeling Diode Branch */}
            <line x1="300" y1="80" x2="300" y2="240" stroke="#334155" strokeWidth="2" />
            <path d="M 300 240 L 300 80 L 460 80 L 580 80 L 580 240 L 300 240" fill="none" style={flowStyle(curPaths.path_diode_on, '#eab308')} />

            {/* Load Resistor */}
            <rect x="555" y="120" width="50" height="80" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            <text x="580" y="152" fill="#e2e8f0" fontSize="11" fontWeight="bold" textAnchor="middle">
              LOAD
            </text>
            <text x="580" y="170" fill="#22c55e" fontSize="10" fontWeight="bold" textAnchor="middle">
              Vo (Buck)
            </text>

            {/* Badges */}
            <foreignObject x="195" y="62" width="85" height="35">
              {getDeviceBadge('S1', currentStates['S1'], 'S1')}
            </foreignObject>
            <foreignObject x="260" y="145" width="85" height="35">
              {getDeviceBadge('D1', currentStates['D1'], 'D1')}
            </foreignObject>
          </g>
        )}

        {/* ================= DC-DC BOOST CONVERTER ================= */}
        {topology.id === 'dcdc_boost' && (
          <g transform="translate(60, 20)">
            <circle cx="80" cy="160" r="26" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="80" y="165" fill="#38bdf8" fontSize="13" fontWeight="bold" textAnchor="middle">
              DC
            </text>
            <text x="80" y="202" fill="#94a3b8" fontSize="12" textAnchor="middle">
              Vin
            </text>

            {/* Inductor first in Boost */}
            <path d="M 80 134 L 80 80 L 160 80" fill="none" style={flowStyle(true, '#22c55e')} />
            <path
              d="M 160 80 Q 175 60 190 80 Q 205 60 220 80 Q 235 60 250 80 Q 265 60 280 80"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.5"
            />
            <text x="220" y="55" fill="#94a3b8" fontSize="11" textAnchor="middle">
              Inductor L
            </text>

            {/* Switch S1 to Ground */}
            <line x1="320" y1="80" x2="320" y2="240" stroke="#334155" strokeWidth="2" />
            <path d="M 80 80 L 280 80 L 320 80 L 320 240 L 80 240 L 80 186" fill="none" style={flowStyle(curPaths.path_switch_on, '#22c55e')} />

            {/* Diode D1 to Load */}
            <path d="M 320 80 L 420 80" fill="none" style={flowStyle(curPaths.path_diode_on, '#06b6d4')} />
            <path d="M 480 80 L 580 80 L 580 120" fill="none" style={flowStyle(curPaths.path_diode_on, '#06b6d4')} />
            <path d="M 580 200 L 580 240 L 80 240" fill="none" style={flowStyle(curPaths.path_diode_on, '#06b6d4')} />

            {/* Load */}
            <rect x="555" y="120" width="50" height="80" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            <text x="580" y="152" fill="#e2e8f0" fontSize="11" fontWeight="bold" textAnchor="middle">
              LOAD
            </text>
            <text x="580" y="170" fill="#22c55e" fontSize="10" fontWeight="bold" textAnchor="middle">
              Vo (Boost)
            </text>

            {/* Badges */}
            <foreignObject x="275" y="145" width="85" height="35">
              {getDeviceBadge('S1', currentStates['S1'], 'S1')}
            </foreignObject>
            <foreignObject x="415" y="62" width="85" height="35">
              {getDeviceBadge('D1', currentStates['D1'], 'D1')}
            </foreignObject>
          </g>
        )}

        {/* ================= DC-DC FLYBACK CONVERTER (ISOLATED) ================= */}
        {topology.id === 'dcdc_flyback' && (
          <g transform="translate(40, 20)">
            {/* Input DC Source */}
            <circle cx="60" cy="160" r="24" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="60" y="165" fill="#38bdf8" fontSize="12" fontWeight="bold" textAnchor="middle">
              DC
            </text>
            <text x="60" y="200" fill="#94a3b8" fontSize="11" textAnchor="middle">
              Vin
            </text>

            {/* Primary Loop to Transformer */}
            <path d="M 60 136 L 60 70 L 260 70" fill="none" style={flowStyle(curPaths.path_switch_on, '#22c55e')} />
            <path d="M 260 150 L 260 170" fill="none" stroke="#38bdf8" strokeWidth="2" />
            <path d="M 260 210 L 260 250 L 60 250 L 60 184" fill="none" style={flowStyle(curPaths.path_switch_on, '#22c55e')} />

            {/* Primary Inductor Winding */}
            <path
              d="M 260 70 Q 240 85 260 95 Q 240 105 260 115 Q 240 125 260 135 L 260 150"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.5"
            />
            {/* Dot convention on primary */}
            <circle cx="242" cy="74" r="3.5" fill="#eab308" />

            {/* Ferrite Core Isolation Barrier */}
            <line x1="280" y1="60" x2="280" y2="160" stroke="#64748b" strokeWidth="2" strokeDasharray="3 3" />
            <line x1="285" y1="60" x2="285" y2="160" stroke="#64748b" strokeWidth="2" strokeDasharray="3 3" />
            <text x="282" y="50" fill="#94a3b8" fontSize="10" fontWeight="bold" textAnchor="middle">
              CORE
            </text>

            {/* Secondary Inductor Winding (Opposing dot for flyback) */}
            <path
              d="M 305 70 Q 325 85 305 95 Q 325 105 305 115 Q 325 125 305 135 L 305 150"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.5"
            />
            {/* Secondary dot at bottom */}
            <circle cx="323" cy="145" r="3.5" fill="#eab308" />

            {/* Secondary Circuit */}
            <path d="M 305 70 L 410 70" fill="none" style={flowStyle(curPaths.path_diode_on, '#eab308')} />
            <path d="M 480 70 L 600 70 L 600 110" fill="none" style={flowStyle(curPaths.path_diode_on, '#eab308')} />
            <path d="M 600 190 L 600 230 L 305 230 L 305 150" fill="none" style={flowStyle(curPaths.path_diode_on, '#eab308')} />

            {/* Output Filter Capacitor */}
            <line x1="530" y1="70" x2="530" y2="135" stroke="#38bdf8" strokeWidth="2" />
            <line x1="515" y1="135" x2="545" y2="135" stroke="#38bdf8" strokeWidth="2.5" />
            <line x1="515" y1="145" x2="545" y2="145" stroke="#38bdf8" strokeWidth="2.5" />
            <line x1="530" y1="145" x2="530" y2="230" stroke="#38bdf8" strokeWidth="2" />
            <text x="500" y="144" fill="#94a3b8" fontSize="10" textAnchor="end">
              C_out
            </text>

            {/* Load */}
            <rect x="575" y="110" width="50" height="80" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            <text x="600" y="142" fill="#e2e8f0" fontSize="11" fontWeight="bold" textAnchor="middle">
              LOAD
            </text>
            <text x="600" y="160" fill="#22c55e" fontSize="10" fontWeight="bold" textAnchor="middle">
              Vo (Flyback)
            </text>

            {/* Badges */}
            <foreignObject x="215" y="165" width="90" height="35">
              {getDeviceBadge('S1', currentStates['S1'], 'S1 (Primary)')}
            </foreignObject>
            <foreignObject x="400" y="52" width="90" height="35">
              {getDeviceBadge('D1', currentStates['D1'], 'D1 (Secondary)')}
            </foreignObject>
          </g>
        )}

        {/* ================= DC-DC FORWARD CONVERTER (ISOLATED) ================= */}
        {topology.id === 'dcdc_forward' && (
          <g transform="translate(30, 15)">
            {/* Input DC Source */}
            <circle cx="50" cy="150" r="22" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="50" y="154" fill="#38bdf8" fontSize="11" fontWeight="bold" textAnchor="middle">
              DC
            </text>
            <text x="50" y="185" fill="#94a3b8" fontSize="10" textAnchor="middle">
              Vin
            </text>

            {/* Primary Winding */}
            <path d="M 50 128 L 50 60 L 190 60 L 190 80" fill="none" style={flowStyle(curPaths.path_switch_on, '#22c55e')} />
            <path d="M 190 140 L 190 160" fill="none" stroke="#38bdf8" strokeWidth="2" />
            <path d="M 190 200 L 190 240 L 50 240 L 50 172" fill="none" style={flowStyle(curPaths.path_switch_on, '#22c55e')} />

            {/* Transformer Core Barrier */}
            <line x1="215" y1="50" x2="215" y2="210" stroke="#64748b" strokeWidth="2" strokeDasharray="3 3" />
            <line x1="220" y1="50" x2="220" y2="210" stroke="#64748b" strokeWidth="2" strokeDasharray="3 3" />

            {/* Secondary Winding */}
            <path d="M 240 60 L 330 60" fill="none" style={flowStyle(curPaths.path_switch_on, '#22c55e')} />
            <path d="M 400 60 L 460 60" fill="none" style={flowStyle(curPaths.path_switch_on, '#22c55e')} />

            {/* Secondary Inductor L */}
            <path
              d="M 460 60 Q 475 42 490 60 Q 505 42 520 60 Q 535 42 550 60 L 630 60 L 630 100"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.5"
            />
            <path d="M 630 180 L 630 220 L 240 220 L 240 140" fill="none" style={flowStyle(curPaths.path_switch_on || curPaths.path_diode_on, '#22c55e')} />

            {/* Freewheel Diode Branch D2 */}
            <line x1="430" y1="60" x2="430" y2="220" stroke="#334155" strokeWidth="2" />
            <path d="M 430 220 L 430 60 L 550 60 L 630 60 L 630 220 L 430 220" fill="none" style={flowStyle(curPaths.path_diode_on, '#eab308')} />

            {/* Load */}
            <rect x="605" y="100" width="50" height="80" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            <text x="630" y="132" fill="#e2e8f0" fontSize="11" fontWeight="bold" textAnchor="middle">
              LOAD
            </text>
            <text x="630" y="150" fill="#22c55e" fontSize="10" fontWeight="bold" textAnchor="middle">
              Vo (Fwd)
            </text>

            {/* Badges */}
            <foreignObject x="145" y="155" width="90" height="35">
              {getDeviceBadge('S1', currentStates['S1'], 'S1 (Pri)')}
            </foreignObject>
            <foreignObject x="325" y="42" width="85" height="35">
              {getDeviceBadge('D1', currentStates['D1'], 'D1 (Fwd)')}
            </foreignObject>
            <foreignObject x="390" y="125" width="85" height="35">
              {getDeviceBadge('D2', currentStates['D2'], 'D2 (FWD)')}
            </foreignObject>
          </g>
        )}

        {/* ================= DC-AC FULL BRIDGE INVERTER ================= */}
        {topology.id === 'dcac_full_bridge' && (
          <g transform="translate(60, 20)">
            {/* DC Source */}
            <circle cx="80" cy="160" r="26" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="80" y="165" fill="#38bdf8" fontSize="13" fontWeight="bold" textAnchor="middle">
              DC
            </text>
            <text x="80" y="202" fill="#94a3b8" fontSize="12" textAnchor="middle">
              Vdc
            </text>

            <path d="M 80 134 L 80 60 L 440 60" fill="none" stroke="#334155" strokeWidth="2" />
            <path d="M 80 186 L 80 260 L 440 260" fill="none" stroke="#334155" strokeWidth="2" />

            {/* Bridge Legs */}
            <line x1="220" y1="60" x2="220" y2="260" stroke="#334155" strokeWidth="2" />
            <line x1="360" y1="60" x2="360" y2="260" stroke="#334155" strokeWidth="2" />

            {/* AC Load between bridge midpoints */}
            <path d="M 220 160 L 260 160" fill="none" stroke="#38bdf8" strokeWidth="2" />
            <path d="M 320 160 L 360 160" fill="none" stroke="#38bdf8" strokeWidth="2" />
            <rect x="260" y="135" width="60" height="50" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            <text x="290" y="165" fill="#22c55e" fontSize="11" fontWeight="bold" textAnchor="middle">
              AC LOAD
            </text>

            {/* Animated Conduction Paths */}
            {curPaths.path_pos && (
              <path d="M 80 60 L 220 60 L 220 160 L 360 160 L 360 260 L 80 260" fill="none" style={flowStyle(true, '#22c55e')} />
            )}
            {curPaths.path_neg && (
              <path d="M 80 60 L 360 60 L 360 160 L 220 160 L 220 260 L 80 260" fill="none" style={flowStyle(true, '#ec4899')} />
            )}

            {/* Switch Badges */}
            <foreignObject x="180" y="75" width="80" height="35">
              {getDeviceBadge('S1', currentStates['S1'], 'S1')}
            </foreignObject>
            <foreignObject x="320" y="75" width="80" height="35">
              {getDeviceBadge('S3', currentStates['S3'], 'S3')}
            </foreignObject>
            <foreignObject x="180" y="205" width="80" height="35">
              {getDeviceBadge('S4', currentStates['S4'], 'S4')}
            </foreignObject>
            <foreignObject x="320" y="205" width="80" height="35">
              {getDeviceBadge('S2', currentStates['S2'], 'S2')}
            </foreignObject>
          </g>
        )}

        {/* ================= AC-AC VOLTAGE CONTROLLER ================= */}
        {topology.id === 'acac_1ph_controller' && (
          <g transform="translate(60, 20)">
            <circle cx="80" cy="160" r="26" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
            <path d="M 66 160 Q 73 148 80 160 T 94 160" fill="none" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="80" y="202" fill="#94a3b8" fontSize="12" textAnchor="middle">
              Vs (AC)
            </text>

            {/* Line with Back-to-Back Switches */}
            <path d="M 80 134 L 80 80 L 220 80" fill="none" style={flowStyle(curPaths.path_pos, '#22c55e')} />
            <path d="M 80 80 L 220 80" fill="none" style={flowStyle(curPaths.path_neg, '#ec4899')} />

            {/* Upper Switch S1 / Lower Switch S2 in antiparallel */}
            <line x1="220" y1="80" x2="240" y2="50" stroke="#334155" strokeWidth="2" />
            <line x1="220" y1="80" x2="240" y2="110" stroke="#334155" strokeWidth="2" />
            <line x1="330" y1="50" x2="350" y2="80" stroke="#334155" strokeWidth="2" />
            <line x1="330" y1="110" x2="350" y2="80" stroke="#334155" strokeWidth="2" />

            {/* To Load */}
            <path d="M 350 80 L 520 80 L 520 120" fill="none" style={flowStyle(curPaths.path_pos, '#22c55e')} />
            <path d="M 350 80 L 520 80 L 520 120" fill="none" style={flowStyle(curPaths.path_neg, '#ec4899')} />
            <path d="M 520 200 L 520 240 L 80 240 L 80 186" fill="none" style={flowStyle(curPaths.path_pos || curPaths.path_neg, '#22c55e')} />

            {/* Load */}
            <rect x="495" y="120" width="50" height="80" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            <text x="520" y="152" fill="#e2e8f0" fontSize="11" fontWeight="bold" textAnchor="middle">
              LOAD
            </text>
            <text x="520" y="170" fill="#22c55e" fontSize="10" fontWeight="bold" textAnchor="middle">
              Vo (AC)
            </text>

            {/* Badges */}
            <foreignObject x="240" y="32" width="85" height="35">
              {getDeviceBadge('S1', currentStates['S1'], 'S1 (Fwd)')}
            </foreignObject>
            <foreignObject x="240" y="95" width="85" height="35">
              {getDeviceBadge('S2', currentStates['S2'], 'S2 (Rev)')}
            </foreignObject>
          </g>
        )}

        {/* ================= DC-DC PUSH-PULL ISOLATED CONVERTER ================= */}
        {topology.id === 'dcdc_push_pull_iso' && (
          <g transform="translate(40, 20)">
            {/* DC Input Source */}
            <circle cx="50" cy="150" r="22" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="50" y="154" fill="#38bdf8" fontSize="11" fontWeight="bold" textAnchor="middle">
              DC
            </text>
            <text x="50" y="185" fill="#94a3b8" fontSize="10" textAnchor="middle">
              Vin
            </text>

            {/* Vin feeds center tap of primary */}
            <path d="M 50 128 L 50 60 L 160 60 L 160 150" fill="none" style={flowStyle(curPaths.path_s1 || curPaths.path_s2, '#22c55e')} />
            <text x="145" y="153" fill="#eab308" fontSize="9" fontWeight="bold">CT</text>

            {/* Primary Center-Tapped Winding */}
            <line x1="180" y1="90" x2="180" y2="210" stroke="#38bdf8" strokeWidth="3" />
            <circle cx="180" cy="150" r="3" fill="#eab308" />

            {/* Switch S1 branch (top) */}
            <path d="M 180 90 L 220 90 L 220 110" fill="none" style={flowStyle(curPaths.path_s1, '#22c55e')} />
            <path d="M 220 145 L 220 250 L 50 250 L 50 172" fill="none" style={flowStyle(curPaths.path_s1, '#22c55e')} />

            {/* Switch S2 branch (bottom) */}
            <path d="M 180 210 L 220 210 L 220 190" fill="none" style={flowStyle(curPaths.path_s2, '#ec4899')} />
            <path d="M 220 225 L 220 250" fill="none" style={flowStyle(curPaths.path_s2, '#ec4899')} />

            {/* Magnetic Core Barrier */}
            <line x1="260" y1="60" x2="260" y2="240" stroke="#64748b" strokeWidth="2" strokeDasharray="3 3" />
            <line x1="265" y1="60" x2="265" y2="240" stroke="#64748b" strokeWidth="2" strokeDasharray="3 3" />

            {/* Secondary Center-Tapped Winding */}
            <line x1="290" y1="80" x2="290" y2="220" stroke="#38bdf8" strokeWidth="3" />
            <circle cx="290" cy="150" r="3" fill="#eab308" />

            {/* Secondary Diodes D1 & D2 */}
            <path d="M 290 80 L 350 80" fill="none" style={flowStyle(curPaths.path_d1, '#22c55e')} />
            <path d="M 430 80 L 480 80 L 480 120" fill="none" style={flowStyle(curPaths.path_d1, '#22c55e')} />

            <path d="M 290 220 L 350 220" fill="none" style={flowStyle(curPaths.path_d2, '#ec4899')} />
            <path d="M 430 220 L 480 220 L 480 120" fill="none" style={flowStyle(curPaths.path_d2, '#ec4899')} />

            {/* Secondary Center Tap to Ground/Return */}
            <path d="M 290 150 L 610 150 L 610 200" fill="none" stroke="#334155" strokeWidth="2" />

            {/* LC Output Filter & Load */}
            <path
              d="M 480 80 Q 495 65 510 80 Q 525 65 540 80 Q 555 65 570 80 L 630 80 L 630 110"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.5"
            />
            <rect x="605" y="110" width="50" height="70" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            <text x="630" y="140" fill="#e2e8f0" fontSize="10" fontWeight="bold" textAnchor="middle">
              LOAD
            </text>
            <text x="630" y="156" fill="#22c55e" fontSize="9" fontWeight="bold" textAnchor="middle">
              Vo (Push-Pull)
            </text>

            {/* Badges */}
            <foreignObject x="180" y="110" width="80" height="35">
              {getDeviceBadge('S1', currentStates['S1'], 'S1')}
            </foreignObject>
            <foreignObject x="180" y="190" width="80" height="35">
              {getDeviceBadge('S2', currentStates['S2'], 'S2')}
            </foreignObject>
            <foreignObject x="350" y="62" width="80" height="35">
              {getDeviceBadge('D1', currentStates['D1'], 'D1')}
            </foreignObject>
            <foreignObject x="350" y="202" width="80" height="35">
              {getDeviceBadge('D2', currentStates['D2'], 'D2')}
            </foreignObject>
          </g>
        )}

        {/* ================= DC-DC FULL-BRIDGE ISOLATED CONVERTER ================= */}
        {topology.id === 'dcdc_full_bridge_iso' && (
          <g transform="translate(30, 20)">
            {/* DC Input Source */}
            <circle cx="50" cy="150" r="22" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="50" y="154" fill="#38bdf8" fontSize="11" fontWeight="bold" textAnchor="middle">
              DC
            </text>
            <text x="50" y="185" fill="#94a3b8" fontSize="10" textAnchor="middle">
              Vin
            </text>

            {/* Primary Rails */}
            <path d="M 50 128 L 50 60 L 260 60" fill="none" stroke="#334155" strokeWidth="2" />
            <path d="M 50 172 L 50 240 L 260 240" fill="none" stroke="#334155" strokeWidth="2" />

            {/* Primary Bridge Legs */}
            <line x1="150" y1="60" x2="150" y2="240" stroke="#334155" strokeWidth="2" />
            <line x1="250" y1="60" x2="250" y2="240" stroke="#334155" strokeWidth="2" />

            {/* Bridge Midpoints to Primary Transformer Winding */}
            <path d="M 150 150 L 300 150" fill="none" style={flowStyle(curPaths.path_s1, '#22c55e')} />
            <path d="M 250 150 L 300 150" fill="none" style={flowStyle(curPaths.path_s2, '#ec4899')} />

            {/* Transformer Primary & Secondary */}
            <line x1="300" y1="110" x2="300" y2="190" stroke="#38bdf8" strokeWidth="3" />
            {/* Core Barrier */}
            <line x1="320" y1="80" x2="320" y2="220" stroke="#64748b" strokeWidth="2" strokeDasharray="3 3" />
            <line x1="325" y1="80" x2="325" y2="220" stroke="#64748b" strokeWidth="2" strokeDasharray="3 3" />
            {/* Secondary Winding */}
            <line x1="345" y1="100" x2="345" y2="200" stroke="#38bdf8" strokeWidth="3" />

            {/* Secondary Full-Wave Rectification with Center-Tap */}
            <path d="M 345 100 L 410 100" fill="none" style={flowStyle(curPaths.path_d1, '#22c55e')} />
            <path d="M 480 100 L 520 100 L 520 150" fill="none" style={flowStyle(curPaths.path_d1, '#22c55e')} />

            <path d="M 345 200 L 410 200" fill="none" style={flowStyle(curPaths.path_d2, '#ec4899')} />
            <path d="M 480 200 L 520 200 L 520 150" fill="none" style={flowStyle(curPaths.path_d2, '#ec4899')} />

            {/* LC Output Filter & Load */}
            <path
              d="M 520 150 Q 535 135 550 150 Q 565 135 580 150 L 640 150"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.5"
            />
            <rect x="640" y="115" width="50" height="70" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            <text x="665" y="145" fill="#e2e8f0" fontSize="10" fontWeight="bold" textAnchor="middle">
              LOAD
            </text>
            <text x="665" y="160" fill="#22c55e" fontSize="9" fontWeight="bold" textAnchor="middle">
              Vo (FB-Iso)
            </text>

            {/* Primary Switch Badges */}
            <foreignObject x="115" y="70" width="75" height="35">
              {getDeviceBadge('S1', currentStates['S1'], 'S1')}
            </foreignObject>
            <foreignObject x="115" y="175" width="75" height="35">
              {getDeviceBadge('S4', currentStates['S4'], 'S4')}
            </foreignObject>
            <foreignObject x="215" y="70" width="75" height="35">
              {getDeviceBadge('S3', currentStates['S3'], 'S3')}
            </foreignObject>
            <foreignObject x="215" y="175" width="75" height="35">
              {getDeviceBadge('S2', currentStates['S2'], 'S2')}
            </foreignObject>

            {/* Secondary Diode Badges */}
            <foreignObject x="410" y="82" width="75" height="35">
              {getDeviceBadge('D1', currentStates['D1'], 'D1')}
            </foreignObject>
            <foreignObject x="410" y="182" width="75" height="35">
              {getDeviceBadge('D2', currentStates['D2'], 'D2')}
            </foreignObject>
          </g>
        )}

        {/* Generic Fallback for Other Topologies */}
        {![
          'acdc_1ph_full_bridge',
          'acdc_1ph_half_wave',
          'dcdc_buck',
          'dcdc_boost',
          'dcdc_flyback',
          'dcdc_forward',
          'dcdc_push_pull_iso',
          'dcdc_full_bridge_iso',
          'dcac_full_bridge',
          'acac_1ph_controller',
        ].includes(topology.id) && (
          <g transform="translate(100, 30)">
            <rect x="40" y="40" width="520" height="220" rx="12" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" strokeDasharray="4 4" />
            <text x="300" y="80" fill="#38bdf8" fontSize="16" fontWeight="bold" textAnchor="middle">
              {topology.name} Schematic
            </text>
            <text x="300" y="110" fill="#94a3b8" fontSize="12" textAnchor="middle">
              Active Devices & State Monitors:
            </text>

            {topology.deviceSlots.map((slot, idx) => (
              <foreignObject key={slot.id} x={80 + (idx % 3) * 150} y={140 + Math.floor(idx / 3) * 50} width="120" height="40">
                {getDeviceBadge(slot.id, currentStates[slot.id], slot.label)}
              </foreignObject>
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}
