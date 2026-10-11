import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, StepForward, RotateCcw } from 'lucide-react';
import { SimulationResult } from '../types';

interface Props {
  result: SimulationResult;
  cursorIdx: number;
  setCursorIdx: (idx: number) => void;
  isPlaying: boolean;
  setIsPlaying: (p: boolean) => void;
  speed: number;
  setSpeed: (s: number) => void;
}

export function Oscilloscope({
  result,
  cursorIdx,
  setCursorIdx,
  isPlaying,
  setIsPlaying,
  speed,
  setSpeed,
}: Props) {
  const [showVs, setShowVs] = useState(true);
  const [showVo, setShowVo] = useState(true);
  const [showIo, setShowIo] = useState(true);
  const [showIL, setShowIL] = useState(true);
  const [showGate, setShowGate] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const { time, signals, timeUnit } = result;
  const N = time.length;

  // Animation RAF loop
  const lastTimeRef = useRef<number>(performance.now());
  const rafRef = useRef<number>(0);

  const tick = useCallback(
    (now: number) => {
      if (!isPlaying) return;
      const deltaMs = now - lastTimeRef.current;
      lastTimeRef.current = now;

      // advance cursor based on speed: 1x means cycle through N points in ~3 seconds
      const stepDelta = (deltaMs / 3000) * N * speed;
      setCursorIdx((Math.round(cursorIdx + stepDelta)) % N);
      rafRef.current = requestAnimationFrame(tick);
    },
    [isPlaying, speed, N, cursorIdx, setCursorIdx]
  );

  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, tick]);

  if (N === 0) return null;

  // Find voltage and current extrema
  let maxV = 10;
  let minV = -10;
  let maxI = 1;
  let minI = 0;

  for (let i = 0; i < N; i++) {
    const vo = signals.vo[i] || 0;
    const vs = signals.vs?.[i] ?? signals.vin?.[i] ?? 0;
    const io = signals.io[i] || 0;
    const il = signals.iL?.[i] || 0;

    if (vo > maxV) maxV = vo;
    if (vo < minV) minV = vo;
    if (vs > maxV) maxV = vs;
    if (vs < minV) minV = vs;

    if (io > maxI) maxI = io;
    if (io < minI) minI = io;
    if (il > maxI) maxI = il;
    if (il < minI) minI = il;
  }

  const padV = Math.max(15, (maxV - minV) * 0.15);
  const vTop = maxV + padV;
  const vBottom = minV - padV;
  const vRange = vTop - vBottom || 1;

  const padI = Math.max(0.2, (maxI - minI) * 0.15);
  const iTop = maxI + padI;
  const iBottom = Math.min(0, minI - padI);
  const iRange = iTop - iBottom || 1;

  const width = 850;
  const heightV = 160;
  const heightI = 130;
  const heightG = 50;

  const mapX = (idx: number) => (idx / (N - 1)) * width;
  const mapY_V = (val: number) => heightV - ((val - vBottom) / vRange) * heightV;
  const mapY_I = (val: number) => heightI - ((val - iBottom) / iRange) * heightI;

  const makePath = (data: number[], mapFn: (v: number) => number) => {
    return data.map((val, i) => `${i === 0 ? 'M' : 'L'} ${mapX(i).toFixed(1)} ${mapFn(val).toFixed(1)}`).join(' ');
  };

  const currentIdx = hoverIdx !== null ? hoverIdx : cursorIdx;
  const curT = time[currentIdx] || 0;
  const curVo = signals.vo[currentIdx] || 0;
  const curVs = signals.vs?.[currentIdx] ?? signals.vin?.[currentIdx] ?? 0;
  const curIo = signals.io[currentIdx] || 0;
  const curIL = signals.iL?.[currentIdx] || 0;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const idx = Math.min(N - 1, Math.max(0, Math.round(relX * (N - 1))));
    setHoverIdx(idx);
  };

  const handleMouseLeave = () => {
    setHoverIdx(null);
  };

  const handleClick = () => {
    if (hoverIdx !== null) {
      setCursorIdx(hoverIdx);
    }
  };

  return (
    <div className="w-full flex flex-col gap-2 bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs">
      {/* Controls toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-2">
        {/* Playback buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded font-semibold transition ${
              isPlaying ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            <span>{isPlaying ? 'Pause' : 'Animate'}</span>
          </button>

          <button
            onClick={() => {
              setIsPlaying(false);
              setCursorIdx((cursorIdx + Math.round(N / 40)) % N);
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            title="Step Forward"
          >
            <StepForward size={14} />
            <span>Step</span>
          </button>

          <button
            onClick={() => {
              setIsPlaying(false);
              setCursorIdx(0);
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            title="Reset to 0"
          >
            <RotateCcw size={13} />
          </button>

          {/* Speed selector */}
          <div className="flex items-center gap-1 ml-2 text-slate-400">
            <span>Speed:</span>
            {[0.25, 0.5, 1, 2].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-1.5 py-0.5 rounded text-[11px] font-mono ${
                  speed === s ? 'bg-sky-600 text-white font-bold' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Channel toggles */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer text-yellow-400 select-none">
            <input type="checkbox" checked={showVs} onChange={(e) => setShowVs(e.target.checked)} className="rounded" />
            <span className="font-semibold">Vs / Vin</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-emerald-400 select-none">
            <input type="checkbox" checked={showVo} onChange={(e) => setShowVo(e.target.checked)} className="rounded" />
            <span className="font-semibold">Vo (Output)</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-cyan-400 select-none">
            <input type="checkbox" checked={showIo} onChange={(e) => setShowIo(e.target.checked)} className="rounded" />
            <span className="font-semibold">Io (Current)</span>
          </label>
          {signals.iL && (
            <label className="flex items-center gap-1.5 cursor-pointer text-sky-400 select-none">
              <input type="checkbox" checked={showIL} onChange={(e) => setShowIL(e.target.checked)} className="rounded" />
              <span>iL (Inductor)</span>
            </label>
          )}
          {signals.gate1 && (
            <label className="flex items-center gap-1.5 cursor-pointer text-pink-400 select-none">
              <input type="checkbox" checked={showGate} onChange={(e) => setShowGate(e.target.checked)} className="rounded" />
              <span>Gates</span>
            </label>
          )}
        </div>

        {/* Live numerical readout */}
        <div className="flex items-center gap-3 font-mono text-[11px] bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
          <span className="text-slate-400">
            t = <b className="text-white">{curT.toFixed(2)}</b> {timeUnit}
          </span>
          <span className="text-yellow-400">
            Vs = <b>{curVs.toFixed(1)}</b> V
          </span>
          <span className="text-emerald-400">
            Vo = <b>{curVo.toFixed(1)}</b> V
          </span>
          <span className="text-cyan-400">
            Io = <b>{curIo.toFixed(2)}</b> A
          </span>
          {signals.iL && (
            <span className="text-sky-400">
              iL = <b>{curIL.toFixed(2)}</b> A
            </span>
          )}
        </div>
      </div>

      {/* Main Waveforms Canvas / SVG Area */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className="relative flex flex-col gap-2 cursor-crosshair select-none"
      >
        {/* Voltage Scope */}
        <div className="relative bg-slate-950 border border-slate-800 rounded p-1" style={{ height: heightV }}>
          <div className="absolute top-1 left-2 text-[10px] text-slate-500 font-mono">
            VOLTAGE [{vBottom.toFixed(0)} V to {vTop.toFixed(0)} V]
          </div>
          <svg width="100%" height="100%" viewBox={`0 0 ${width} ${heightV}`} preserveAspectRatio="none">
            {/* Grid lines */}
            <line x1="0" y1={mapY_V(0)} x2={width} y2={mapY_V(0)} stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="0" y1={heightV / 2} x2={width} y2={heightV / 2} stroke="#1e293b" strokeWidth="1" />

            {/* Vs (Source) */}
            {showVs && signals.vs && (
              <path d={makePath(signals.vs, mapY_V)} fill="none" stroke="#eab308" strokeWidth="1.6" opacity="0.65" />
            )}
            {showVs && signals.vin && (
              <path d={makePath(signals.vin, mapY_V)} fill="none" stroke="#eab308" strokeWidth="1.6" opacity="0.65" />
            )}

            {/* Vo (Output) */}
            {showVo && <path d={makePath(signals.vo, mapY_V)} fill="none" stroke="#22c55e" strokeWidth="2.2" />}

            {/* Cursor line */}
            <line
              x1={mapX(currentIdx)}
              y1="0"
              x2={mapX(currentIdx)}
              y2={heightV}
              stroke="#f8fafc"
              strokeWidth="1.5"
              strokeDasharray="2 2"
            />
          </svg>
        </div>

        {/* Current Scope */}
        <div className="relative bg-slate-950 border border-slate-800 rounded p-1" style={{ height: heightI }}>
          <div className="absolute top-1 left-2 text-[10px] text-slate-500 font-mono">
            CURRENT [{iBottom.toFixed(2)} A to {iTop.toFixed(2)} A]
          </div>
          <svg width="100%" height="100%" viewBox={`0 0 ${width} ${heightI}`} preserveAspectRatio="none">
            <line x1="0" y1={mapY_I(0)} x2={width} y2={mapY_I(0)} stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />

            {/* Io */}
            {showIo && <path d={makePath(signals.io, mapY_I)} fill="none" stroke="#06b6d4" strokeWidth="2" />}

            {/* iL */}
            {showIL && signals.iL && (
              <path d={makePath(signals.iL, mapY_I)} fill="none" stroke="#38bdf8" strokeWidth="1.8" strokeDasharray="4 2" />
            )}

            {/* Cursor line */}
            <line
              x1={mapX(currentIdx)}
              y1="0"
              x2={mapX(currentIdx)}
              y2={heightI}
              stroke="#f8fafc"
              strokeWidth="1.5"
              strokeDasharray="2 2"
            />
          </svg>
        </div>

        {/* Gate Pulses / Carrier Scope */}
        {showGate && (signals.gate1 || signals.carrier) && (
          <div className="relative bg-slate-950 border border-slate-800 rounded p-1" style={{ height: heightG }}>
            <div className="absolute top-1 left-2 text-[10px] text-slate-500 font-mono">GATE / CARRIER</div>
            <svg width="100%" height="100%" viewBox={`0 0 ${width} ${heightG}`} preserveAspectRatio="none">
              {signals.gate1 && (
                <path
                  d={makePath(signals.gate1, (v) => (v > 0.5 ? 8 : heightG - 8))}
                  fill="none"
                  stroke="#ec4899"
                  strokeWidth="1.8"
                />
              )}
              {signals.carrier && (
                <path
                  d={makePath(signals.carrier, (v) => heightG / 2 - (v * heightG) / 2.5)}
                  fill="none"
                  stroke="#a855f7"
                  strokeWidth="1.2"
                  opacity="0.6"
                />
              )}
              <line
                x1={mapX(currentIdx)}
                y1="0"
                x2={mapX(currentIdx)}
                y2={heightG}
                stroke="#f8fafc"
                strokeWidth="1.5"
                strokeDasharray="2 2"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Scrubber slider bar */}
      <div className="flex items-center gap-2 pt-1">
        <span className="text-[11px] text-slate-500 font-mono">0</span>
        <input
          type="range"
          min={0}
          max={N - 1}
          value={cursorIdx}
          onChange={(e) => {
            setIsPlaying(false);
            setCursorIdx(Number(e.target.value));
          }}
          className="flex-1 accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
        />
        <span className="text-[11px] text-slate-500 font-mono">
          {time[N - 1]?.toFixed(1)} {timeUnit}
        </span>
      </div>
    </div>
  );
}
