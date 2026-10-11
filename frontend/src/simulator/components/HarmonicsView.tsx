import { useState } from 'react';
import { FFTResults } from '../types';

interface Props {
  fft: FFTResults;
  thdV: number;
  thdI: number;
}

export function HarmonicsView({ fft, thdV, thdI }: Props) {
  const [mode, setMode] = useState<'voltage' | 'current'>('voltage');

  const orders = fft.orders || [];
  const vals = mode === 'voltage' ? fft.voltages : fft.currents;
  const pcts = mode === 'voltage' ? fft.voltagesPct : fft.currentsPct;
  const thd = mode === 'voltage' ? thdV : thdI;
  const unit = mode === 'voltage' ? 'V' : 'A';
  const color = mode === 'voltage' ? '#22c55e' : '#06b6d4';

  const maxVal = Math.max(1, ...vals);
  const chartHeight = 180;
  const chartWidth = 720;
  const barWidth = Math.max(12, Math.floor(chartWidth / (orders.length * 1.5)));

  return (
    <div className="w-full flex flex-col gap-4 bg-slate-900 border border-slate-800 rounded-lg p-4 text-xs">
      {/* Header and selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-bold text-sky-400">Fourier Harmonic Spectrum (FFT)</h3>
          <p className="text-[11px] text-slate-400">
            Harmonic decomposition up to 25th order & total harmonic distortion analysis
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Voltage vs Current toggle */}
          <div className="flex bg-slate-950 p-0.5 rounded border border-slate-800">
            <button
              onClick={() => setMode('voltage')}
              className={`px-3 py-1 rounded text-xs font-semibold ${
                mode === 'voltage' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Voltage Harmonics
            </button>
            <button
              onClick={() => setMode('current')}
              className={`px-3 py-1 rounded text-xs font-semibold ${
                mode === 'current' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Current Harmonics
            </button>
          </div>

          {/* THD Badge */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1 rounded border border-slate-800">
            <span className="text-slate-400 font-medium">THD:</span>
            <span className="text-sm font-mono font-bold text-orange-400">{thd} %</span>
          </div>
        </div>
      </div>

      {/* SVG Bar Chart */}
      <div className="relative bg-slate-950 border border-slate-800 rounded-lg p-3">
        <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
          {/* Zero baseline */}
          <line x1="20" y1={chartHeight - 25} x2={chartWidth - 10} y2={chartHeight - 25} stroke="#334155" strokeWidth="1" />

          {/* Harmonic Bars */}
          {orders.map((n, idx) => {
            const v = vals[idx] || 0;
            const barH = (v / maxVal) * (chartHeight - 45);
            const x = 30 + idx * ((chartWidth - 50) / orders.length);
            const y = chartHeight - 25 - barH;

            return (
              <g key={n} className="transition-all hover:opacity-80">
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barH}
                  fill={n === 1 ? '#38bdf8' : color}
                  rx="2"
                  opacity={n === 1 ? 1 : 0.85}
                />
                {/* Harmonic order label */}
                <text x={x + barWidth / 2} y={chartHeight - 8} fill="#94a3b8" fontSize="10" textAnchor="middle" fontFamily="monospace">
                  {n}
                </text>
                {/* Value tooltip on bar top */}
                {barH > 14 && (
                  <text x={x + barWidth / 2} y={y - 4} fill="#e2e8f0" fontSize="9" textAnchor="middle" fontFamily="monospace">
                    {pcts[idx]}%
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Numerical Data Table */}
      <div className="max-h-48 overflow-y-auto border border-slate-800 rounded">
        <table className="w-full text-left border-collapse text-[11px]">
          <thead className="bg-slate-950 text-slate-400 font-semibold sticky top-0 border-b border-slate-800">
            <tr>
              <th className="p-2">Harmonic Order (n)</th>
              <th className="p-2">Frequency (Hz)</th>
              <th className="p-2">RMS Amplitude ({unit})</th>
              <th className="p-2">% of Fundamental</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {orders.map((n, idx) => (
              <tr key={n} className={n === 1 ? 'bg-sky-950/30 text-sky-300 font-bold' : 'hover:bg-slate-800/40'}>
                <td className="p-2">n = {n} {n === 1 ? '(Fundamental)' : ''}</td>
                <td className="p-2">{fft.frequencies[idx]} Hz</td>
                <td className="p-2">{vals[idx]} {unit}</td>
                <td className="p-2">{pcts[idx]} %</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
