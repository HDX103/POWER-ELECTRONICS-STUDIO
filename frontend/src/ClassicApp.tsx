import { useCallback, useEffect, useRef, useState } from 'react';
import { Zap, Play, Pause, Square, StepForward, Download, Upload } from 'lucide-react';
import { getTopologies, simulate, type Params, type SimResult, type TopologySpec } from './api';
import { ControlPanel } from './components/ControlPanel';
import { Schematic } from './components/Schematic';
import { WaveformViewer } from './components/WaveformViewer';
import { MetricsPanel } from './components/MetricsPanel';
import { FFTPanel } from './components/FFTPanel';
import { SweepPanel } from './components/SweepPanel';
import { TheoryPanel } from './components/TheoryPanel';
import { ConductionTimeline } from './components/ConductionTimeline';

type Tab = 'scope' | 'fft' | 'sweep' | 'theory';
const SPEEDS = [0.1, 0.2, 0.5, 1, 2, 5];
const GROUPS: [string, string[]][] = [['AC → DC', ['halfwave', 'fullwave', 'scr_bridge', 'semi']], ['DC → DC', ['buck', 'boost', 'buckboost']], ['DC → AC', ['inv_half', 'inv_full']]];

function download(name: string, text: string, mime = 'text/plain') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

export default function ClassicApp() {
  const [specs, setSpecs] = useState<TopologySpec[]>([]);
  const [cfg, setCfg] = useState<{ tid: string; p: Params } | null>(null);   // topology + params change together
  const [auto, setAuto] = useState(true);
  const [res, setRes] = useState<SimResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<Tab>('scope');
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [logLines, setLogLines] = useState<string[]>(['Connecting to simulation backend…']);
  const abort = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getTopologies().then((s) => { setSpecs(s); const t = s.find((x) => x.id === 'scr_bridge') ?? s[0]; setCfg({ tid: t.id, p: { ...t.defaults } }); })
      .catch((e) => setErr(`Cannot reach simulation backend (${e.message}). Start it with: uvicorn main:app --reload (port 8000).`));
  }, []);

  const spec = specs.find((s) => s.id === cfg?.tid);
  const pickTopology = (tid: string) => { const t = specs.find((s) => s.id === tid)!; setPlaying(false); setRes(null); setCursor(0); setCfg({ tid, p: { ...t.defaults } }); setLogLines([`Loaded ${t.name}.`]); };

  const run = useCallback(async (c: { tid: string; p: Params }) => {
    abort.current?.abort();
    const ac = new AbortController(); abort.current = ac;
    setBusy(true); setErr('');
    try {
      const r = await simulate(c.tid, c.p, ac.signal);
      if (!r.success) { setErr(r.error ?? 'Simulation failed'); setLogLines(['error: ' + (r.error ?? 'failed'), ...(r.log ?? [])]); return; }
      setRes(r); setLogLines([...r.log]); setCursor(0);
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      setErr(`Cannot reach simulation backend (${e.message}).`);
    } finally { if (abort.current === ac) setBusy(false); }
  }, []);

  useEffect(() => { if (!auto || !cfg) return; const h = setTimeout(() => run(cfg), 450); return () => clearTimeout(h); }, [cfg, auto, run]);

  const scale = res ? (res.time_unit === 'ms' ? 1e3 : 1e6) : 1;
  const span = res ? res.time[res.time.length - 1] : 0;
  useEffect(() => {          // animation: 1x = one base period (mains or switching cycle) per 4 s
    if (!playing || !res) return;
    let last = performance.now(), raf = 0;
    const tick = (now: number) => { const dt = now - last; last = now; setCursor((c) => (c + (dt / 4000) * (res.period * scale) * speed) % span); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, res, scale, span]);

  const idx = res && span > 0 ? Math.min(res.time.length - 1, Math.max(0, Math.round((cursor / span) * (res.time.length - 1)))) : 0;
  const cursorDeg = res ? ((cursor / (res.period * scale)) % 1) * 360 : 0;
  const step = () => { if (res) { setPlaying(false); setCursor((c) => (c + (res.period * scale) / 72) % span); } };

  const saveJSON = () => cfg && download(`${cfg.tid}.json`, JSON.stringify({ format: 'power-electronics-studio/2', topology: cfg.tid, params: cfg.p, netlist: res?.netlist ?? null }, null, 2), 'application/json');
  const saveCSV = () => {
    if (!res) return;
    const keys = Object.keys(res.signals);
    download('simulation.csv', [`t_${res.time_unit}`, ...keys].join(',') + '\n' + res.time.map((t, i) => [t, ...keys.map((k) => res.signals[k][i])].join(',')).join('\n'), 'text/csv');
  };
  const openJSON = async (f?: File) => {
    if (!f) return;
    try {
      const j = JSON.parse(await f.text()); const t = specs.find((s) => s.id === (j.topology ?? 'scr_bridge'));
      if (!t) throw new Error('unknown topology'); setRes(null); setCfg({ tid: t.id, p: { ...t.defaults, ...j.params } });
    } catch { setErr('Invalid circuit file'); }
  };

  const btn = 'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-40';
  const issues = res?.issues ?? [];
  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-200 text-sm overflow-hidden">
      <header className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border-b border-slate-800">
        <Zap size={18} className="text-sky-400" /><span className="font-semibold tracking-wide mr-2">Power Electronics Studio</span>
        <select value={cfg?.tid ?? ''} onChange={(e) => pickTopology(e.target.value)} disabled={!specs.length} className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs mr-2">
          {GROUPS.map(([g, ids]) => (<optgroup key={g} label={g}>{ids.map((id) => { const s = specs.find((x) => x.id === id); return s ? <option key={id} value={id}>{s.name}</option> : null; })}</optgroup>))}
        </select>
        <button className={btn + ' !bg-emerald-700 hover:!bg-emerald-600'} onClick={() => cfg && run(cfg)} disabled={busy || !cfg}><Play size={14} />{busy ? 'Solving…' : 'Run'}</button>
        <button className={btn} onClick={() => setPlaying((v) => !v)} disabled={!res}>{playing ? <Pause size={14} /> : <Play size={14} />}{playing ? 'Pause' : 'Animate'}</button>
        <button className={btn} onClick={step} disabled={!res}><StepForward size={14} />Step</button>
        <button className={btn} onClick={() => { setPlaying(false); setCursor(0); }} disabled={!res}><Square size={14} />Stop</button>
        <select value={speed} onChange={(e) => setSpeed(+e.target.value)} className="bg-slate-800 border border-slate-700 rounded px-1 py-1 text-xs">{SPEEDS.map((s) => <option key={s} value={s}>{s}x</option>)}</select>
        <div className="ml-auto flex gap-2">
          <button className={btn} onClick={() => fileRef.current?.click()} disabled={!specs.length}><Upload size={14} />Open</button>
          <button className={btn} onClick={saveJSON} disabled={!cfg}><Download size={14} />Save JSON</button>
          <button className={btn} onClick={saveCSV} disabled={!res}><Download size={14} />CSV</button>
          <input ref={fileRef} type="file" accept=".json" hidden onChange={(e) => openJSON(e.target.files?.[0])} />
        </div>
      </header>
      {err && <div className="px-3 py-1.5 bg-red-950 text-red-300 text-xs border-b border-red-900">{err}</div>}
      {cfg && spec && (
        <div className="flex-1 min-h-0 grid grid-cols-[250px_minmax(380px,1fr)_minmax(0,1.5fr)] grid-rows-[minmax(0,1fr)_200px]">
          <aside className="border-r border-slate-800 bg-slate-900 row-span-2 min-h-0"><ControlPanel key={cfg.tid} spec={spec} p={cfg.p} set={(p) => setCfg({ tid: cfg.tid, p })} auto={auto} setAuto={setAuto} /></aside>
          <section className="border-r border-b border-slate-800 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0"><Schematic tid={cfg.tid} result={res && res.topology === cfg.tid ? res : null} idx={idx} p={cfg.p} /></div>
            <div className="px-3 py-1 border-t border-slate-800 bg-slate-900"><div className="text-[10px] uppercase tracking-wider text-slate-500">Conduction sequence (one {res?.kind === 'dc' ? 'switching' : res?.kind === 'inv' ? 'output' : 'line'} cycle) · cursor {cursorDeg.toFixed(0)}°</div><ConductionTimeline r={res} cursorDeg={cursorDeg} /></div>
          </section>
          <section className="border-b border-slate-800 min-h-0 flex flex-col">
            <nav className="flex border-b border-slate-800 bg-slate-900 text-xs">
              {(['scope', 'fft', 'sweep', 'theory'] as Tab[]).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 ${tab === t ? 'text-sky-300 border-b-2 border-sky-400' : 'text-slate-400 hover:text-slate-200'}`}>{t === 'scope' ? 'Oscilloscope' : t === 'fft' ? 'FFT / THD' : t === 'sweep' ? 'Parameter sweep' : 'Theory'}</button>))}
            </nav>
            <div className="flex-1 min-h-0">
              {tab === 'scope' && <WaveformViewer key={cfg.tid} data={res} cursor={cursor} setCursor={(t) => !playing && setCursor(t)} />}
              {tab === 'fft' && <FFTPanel r={res} />}
              {tab === 'sweep' && <SweepPanel spec={spec} p={cfg.p} />}
              {tab === 'theory' && <TheoryPanel tid={cfg.tid} r={res} />}
            </div>
          </section>
          <section className="border-r border-slate-800 min-h-0 bg-slate-900/50"><MetricsPanel r={res} /></section>
          <section className="min-h-0 bg-black/40 font-mono text-[11px] p-2 overflow-y-auto">
            <div className="text-slate-500 mb-1">Simulation console</div>
            {logLines.map((l, i) => <div key={i} className={l.startsWith('error') ? 'text-red-400' : l.startsWith('warning') ? 'text-amber-400' : 'text-slate-300'}>{'> ' + l}</div>)}
            {issues.filter((i) => !logLines.some((l) => l.endsWith(i.message))).map((i, k) => <div key={k} className="text-amber-400">{'> ' + i.level + ': ' + i.message}</div>)}
          </section>
        </div>)}
      {!cfg && !err && <div className="flex-1 flex items-center justify-center text-slate-500">Connecting to simulation backend…</div>}
    </div>
  );
}
