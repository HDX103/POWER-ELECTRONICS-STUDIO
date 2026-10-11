import { useState, useMemo } from 'react';
import { runSimulation } from '../engine/solvers';
import { ControlParams, LoadParams, SourceParams, SwitchModel, TopologyDefinition } from '../types';

interface Props {
  topology: TopologyDefinition;
  source: SourceParams;
  load: LoadParams;
  control: ControlParams;
  devices: Record<string, SwitchModel>;
}

export function SweepView({ topology, source, load, control, devices }: Props) {
  const isAcDc = topology.family === 'AC-DC';
  const isDcDc = topology.family === 'DC-DC';
  const isDcAc = topology.family === 'DC-AC';

  const defaultKey = isAcDc ? 'alpha' : isDcDc ? 'duty' : isDcAc ? 'ma' : 'R';
  const [sweepKey, setSweepKey] = useState<string>(defaultKey);

  const sweepPoints = useMemo(() => {
    const points: Array<{ x: number; vdc: number; vrms: number; eff: number; thd: number }> = [];
    const count = 18;

    let start = 0;
    let end = 180;
    if (sweepKey === 'duty' || sweepKey === 'ma') {
      start = 0.1;
      end = 0.9;
    } else if (sweepKey === 'R') {
      start = 2;
      end = 50;
    }

    for (let i = 0; i <= count; i++) {
      const val = start + (i / count) * (end - start);
      const modControl = { ...control };
      const modLoad = { ...load };

      if (sweepKey === 'alpha') modControl.alpha = val;
      else if (sweepKey === 'duty') modControl.duty = val;
      else if (sweepKey === 'ma') modControl.ma = val;
      else if (sweepKey === 'R') modLoad.R = val;

      const res = runSimulation(topology.id, source, modLoad, modControl, devices);
      points.push({
        x: Number(val.toFixed(2)),
        vdc: res.metrics.vdc,
        vrms: res.metrics.vrms,
        eff: res.metrics.eff,
        thd: res.metrics.thd_v,
      });
    }

    return points;
  }, [sweepKey, topology.id, source, load, control, devices]);

  const maxV = Math.max(1, ...sweepPoints.map((p) => Math.max(p.vdc, p.vrms)));
  const minV = Math.min(0, ...sweepPoints.map((p) => Math.min(p.vdc, p.vrms)));
  const vRange = maxV - minV || 1;

  const chartW = 750;
  const chartH = 200;

  const mapX = (idx: number) => 40 + (idx / (sweepPoints.length - 1)) * (chartW - 60);
  const mapY = (val: number) => chartH - 30 - ((val - minV) / vRange) * (chartH - 50);

  const pathVdc = sweepPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${mapX(i)} ${mapY(p.vdc)}`).join(' ');
  const pathVrms = sweepPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${mapX(i)} ${mapY(p.vrms)}`).join(' ');

  return (
    <div className="w-full flex flex-col gap-4 bg-slate-900 border border-slate-800 rounded-lg p-4 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-bold text-sky-400">Parameter Sweep Analysis</h3>
          <p className="text-[11px] text-slate-400">
            Characteristic transfer curves over varying operating points
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">Sweep Variable:</span>
          <select
            value={sweepKey}
            onChange={(e) => setSweepKey(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-200 font-medium"
          >
            {isAcDc && <option value="alpha">Firing Angle α (0° - 180°)</option>}
            {isDcDc && <option value="duty">Duty Cycle D (0.1 - 0.9)</option>}
            {isDcAc && <option value="ma">Modulation Index ma (0.1 - 0.9)</option>}
            <option value="R">Load Resistance R (2Ω - 50Ω)</option>
          </select>
        </div>
      </div>

      {/* SVG Plot */}
      <div className="bg-slate-950 p-3 rounded border border-slate-800">
        <div className="flex justify-between text-[11px] text-slate-400 mb-2">
          <span className="font-semibold text-slate-300">Voltage Transfer Characteristic</span>
          <div className="flex gap-4">
            <span className="text-emerald-400 font-semibold">— Vdc (Average)</span>
            <span className="text-sky-400 font-semibold">— Vrms (RMS)</span>
          </div>
        </div>

        <svg width="100%" height={chartH} viewBox={`0 0 ${chartW} ${chartH}`} preserveAspectRatio="none">
          {/* Baseline */}
          <line x1="40" y1={mapY(0)} x2={chartW - 20} y2={mapY(0)} stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />

          {/* Paths */}
          <path d={pathVdc} fill="none" stroke="#22c55e" strokeWidth="2.5" />
          <path d={pathVrms} fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="4 2" />

          {/* Dots */}
          {sweepPoints.map((p, idx) => (
            <circle key={idx} cx={mapX(idx)} cy={mapY(p.vdc)} r="3" fill="#22c55e" />
          ))}

          {/* Labels */}
          {sweepPoints.map((p, idx) => (
            idx % 3 === 0 && (
              <text key={idx} x={mapX(idx)} y={chartH - 8} fill="#94a3b8" fontSize="10" textAnchor="middle" fontFamily="monospace">
                {p.x}
              </text>
            )
          ))}
        </svg>
      </div>

      {/* Sweep Table */}
      <div className="max-h-44 overflow-y-auto border border-slate-800 rounded">
        <table className="w-full text-left border-collapse text-[11px]">
          <thead className="bg-slate-950 text-slate-400 font-semibold sticky top-0 border-b border-slate-800">
            <tr>
              <th className="p-2">{sweepKey}</th>
              <th className="p-2">Vdc (V)</th>
              <th className="p-2">Vrms (V)</th>
              <th className="p-2">Efficiency (%)</th>
              <th className="p-2">THD (V) (%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {sweepPoints.map((p, idx) => (
              <tr key={idx} className="hover:bg-slate-800/40">
                <td className="p-2 font-bold text-sky-300">{p.x}</td>
                <td className="p-2 text-emerald-400">{p.vdc}</td>
                <td className="p-2 text-sky-400">{p.vrms}</td>
                <td className="p-2">{p.eff} %</td>
                <td className="p-2 text-orange-400">{p.thd} %</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
