import type { Params, SimResult } from '../api';
import { BG, Capacitor, Diode, Ground, Inductor, Label, ON, Resistor, Source, Switch, Thyristor, dot, wire } from './symbols';

interface Props { tid: string; result: SimResult | null; idx: number; p: Params }

/** Device kinds per topology: 'T' thyristor, 'D' diode. Ids follow the netlist (T1/D1 = A->P, 3 = B->P, 4 = 0->B, 2 = 0->A). */
const BRIDGE: Record<string, Record<string, 'T' | 'D'>> = {
  fullwave: { 1: 'D', 3: 'D', 4: 'D', 2: 'D' }, scr_bridge: { 1: 'T', 3: 'T', 4: 'T', 2: 'T' }, semi: { 1: 'T', 3: 'T', 4: 'D', 2: 'D' },
};
const TITLES: Record<string, string> = {
  halfwave: 'Single-phase half-wave rectifier', fullwave: 'Single-phase full-wave bridge rectifier',
  scr_bridge: 'Single-phase fully controlled bridge', semi: 'Single-phase semi-converter',
  buck: 'Buck converter', boost: 'Boost converter', buckboost: 'Buck-boost (inverting) converter',
  inv_half: 'Single-phase half-bridge inverter', inv_full: 'Single-phase full-bridge inverter',
};
const MODS: Record<string, string> = { square: 'square wave', bipolar: 'bipolar SPWM', unipolar: 'unipolar SPWM', spwm: 'SPWM' };

function LoadStage({ p, xp, on, fwdOn }: { p: Params; xp: number; on: boolean; fwdOn: boolean }) {
  const L = (p.l as number) > 0, E = (p.E as number) > 0, C = (p.c_uf as number) > 0, F = !!p.fwd;
  const xR = 580;
  const out: JSX.Element[] = [];
  out.push(wire([[xp, 110], [xR, 110], [xR, 125]], on));
  out.push(<Resistor key="R" x={xR} y={155} ang={90} label="R" lx={20} ly={4} />);   // 125..185
  let yEnd = 185;
  if (L) { out.push(wire([[xR, yEnd], [xR, yEnd + 5]]), <Inductor key="L" x={xR} y={yEnd + 35} ang={90} label="L" lx={20} ly={4} />); yEnd += 65; }
  if (E) { out.push(wire([[xR, yEnd], [xR, yEnd + 8]]), <g key="E"><circle cx={xR} cy={yEnd + 22} r={14} fill={BG} stroke="#94a3b8" strokeWidth={1.5} /><text x={xR} y={yEnd + 27} textAnchor="middle" fontSize={14} fill="#fbbf24">E</text></g>); yEnd += 36; }
  out.push(wire([[xR, yEnd], [xR, 330]]), <Ground key="g" x={xR} y={330} />);
  if (C) { out.push(wire([[500, 110], [500, 170]]), <Capacitor key="C" x={500} y={200} ang={90} label="C" lx={-18} ly={4} />, wire([[500, 230], [500, 330]]), <Ground key="gc" x={500} y={330} />, dot(500, 110)); }
  if (F) { out.push(wire([[650, 110], [xR, 110]]), wire([[650, 110], [650, 170]]), <Diode key="D5" x={650} y={200} ang={-90} label="D5" lx={22} ly={4} on={fwdOn} />, wire([[650, 230], [650, 330]]), <Ground key="gf" x={650} y={330} />, dot(xR, 110)); }
  return <g>{out.map((e, i) => <g key={i}>{e}</g>)}</g>;
}

function AcSchematic({ tid, result, idx, p }: Props) {
  const st = (id: string) => !!result && (result.signals[`state_${id}`]?.[idx] ?? 0) === 1;
  const bridge = tid !== 'halfwave';
  const kinds = BRIDGE[tid] ?? {};
  const id = (n: number) => `${kinds[n] ?? 'D'}${n}`;
  const A: [number, number] = [220, 210], B: [number, number] = [440, 210], Pn: [number, number] = [330, 110], N: [number, number] = [330, 310];
  const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const deg = (a: [number, number], b: [number, number]) => (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  const Dev = ({ n, a, b }: { n: number; a: [number, number]; b: [number, number] }) => {
    const on = st(id(n)); const m = mid(a, b); const C = kinds[n] === 'T' ? Thyristor : Diode;
    return <>{wire([a, b], on)}<C x={m[0]} y={m[1]} ang={deg(a, b)} label={id(n)} on={on} ly={-24} /></>;
  };
  const conducting = result ? result.devices.filter((d) => st(d)) : [];
  const gated = (p.alpha_deg as number) !== undefined && (tid === 'scr_bridge' || tid === 'semi');
  const loadOn = conducting.length > 0;
  return (
    <svg viewBox="0 0 700 400" className="flex-1 min-h-0 w-full" style={{ background: BG }}>
      <defs><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.8" fill="#1e293b" /></pattern></defs>
      <rect width="700" height="400" fill="url(#grid)" />
      <Source x={90} y={210} kind="ac" label="Vs" />
      {bridge ? (<>
        {wire([[90, 186], [90, 160], [220, 160], [220, 210]])}{wire([[90, 234], [90, 370], [440, 370], [440, 210]])}
        <Dev n={1} a={A} b={Pn} /><Dev n={3} a={B} b={Pn} /><Dev n={2} a={N} b={A} /><Dev n={4} a={N} b={B} />
        {[A, B, Pn, N].map((q, i) => <g key={i}>{dot(q[0], q[1])}</g>)}
        <Label x={206} y={204} t="A" anchor="end" /><Label x={454} y={204} t="B" anchor="start" /><Label x={330} y={98} t="P" />
        <Ground x={330} y={310} /><LoadStage p={p} xp={330} on={loadOn} fwdOn={st('D5')} />
      </>) : (<>
        {wire([[90, 186], [90, 110], [160, 110]])}{wire([[90, 234], [90, 330]])}<Ground x={90} y={330} />
        <Diode x={190} y={110} label="D1" on={st('D1')} />{wire([[220, 110], [330, 110]], st('D1'))}
        <Label x={330} y={98} t="P" /><LoadStage p={p} xp={330} on={st('D1')} fwdOn={st('D5')} />
      </>)}
      <text x={20} y={22} fontSize={13} fontWeight={700} fill="#e2e8f0">{TITLES[tid]}{gated ? `  (α = ${(p.alpha_deg as number).toFixed(0)}°)` : ''}</text>
      <text x={20} y={40} fontSize={12} fill={loadOn ? ON : '#94a3b8'}>{result ? (loadOn ? `Conducting: ${conducting.join(' + ')}` : 'No device conducting') : 'Run a simulation'}</text>
    </svg>
  );
}

function DcSchematic({ tid, result, idx, p }: Props) {
  const st = (id: string) => !!result && (result.signals[`state_${id}`]?.[idx] ?? 0) === 1;
  const S = st('S1'), D = st('D1');
  const out = (xOut: number) => (<>
    {wire([[xOut, 110], [xOut, 170]], false)}<Capacitor x={xOut} y={200} ang={90} label="C" lx={-18} ly={4} />{wire([[xOut, 230], [xOut, 300]])}
    {wire([[xOut, 110], [600, 110], [600, 170]])}<Resistor x={600} y={200} ang={90} label="R" lx={20} ly={4} />{wire([[600, 230], [600, 300]])}{dot(xOut, 110)}
  </>);
  return (
    <svg viewBox="0 0 700 400" className="flex-1 min-h-0 w-full" style={{ background: BG }}>
      <defs><pattern id="grid2" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.8" fill="#1e293b" /></pattern></defs>
      <rect width="700" height="400" fill="url(#grid2)" />
      <Source x={80} y={200} kind="dc" label="Vin" />
      {wire([[80, 176], [80, 110]])}{wire([[80, 224], [80, 300]])}{wire([[80, 300], [600, 300]])}<Ground x={340} y={300} />
      {tid === 'buck' && (<>
        {wire([[80, 110], [160, 110]])}<Switch x={190} y={110} label="S1" on={S} />{wire([[220, 110], [370, 110]], S)}
        {wire([[300, 110], [300, 170]], D)}<Diode x={300} y={200} ang={-90} label="D1" lx={24} ly={4} on={D} />{wire([[300, 230], [300, 300]], D)}{dot(300, 110)}
        <Inductor x={400} y={110} label="L" />{wire([[430, 110], [520, 110]])}{out(520)}
      </>)}
      {tid === 'boost' && (<>
        {wire([[80, 110], [140, 110]])}<Inductor x={170} y={110} label="L" />{wire([[200, 110], [370, 110]])}
        {wire([[300, 110], [300, 170]], S)}<Switch x={300} y={200} ang={90} label="S1" lx={-38} ly={4} on={S} />{wire([[300, 230], [300, 300]], S)}{dot(300, 110)}
        <Diode x={400} y={110} label="D1" on={D} />{wire([[430, 110], [520, 110]], D)}{out(520)}
      </>)}
      {tid === 'buckboost' && (<>
        {wire([[80, 110], [160, 110]])}<Switch x={190} y={110} label="S1" on={S} />{wire([[220, 110], [370, 110]], S)}
        {wire([[300, 110], [300, 170]])}<Inductor x={300} y={200} ang={90} label="L" lx={-18} ly={4} />{wire([[300, 230], [300, 300]])}{dot(300, 110)}
        <Diode x={400} y={110} ang={180} label="D1" on={D} />{wire([[430, 110], [520, 110]], D)}{out(520)}
        <Label x={548} y={100} t="Vo (−)" />
      </>)}
      <Label x={300} y={98} t="SW" />
      <text x={20} y={22} fontSize={13} fontWeight={700} fill="#e2e8f0">{TITLES[tid]}  (D = {(p.duty as number).toFixed(2)})</text>
      <text x={20} y={40} fontSize={12} fill={S || D ? ON : '#94a3b8'}>{result ? `Switch ${S ? 'ON' : 'OFF'} · Diode ${D ? 'ON' : 'OFF'}` : 'Run a simulation'}</text>
    </svg>
  );
}


function InvSchematic({ tid, result, idx, p }: Props) {
  const half = tid === 'inv_half';
  const st = (id: string) => !!result && (result.signals[`state_${id}`]?.[idx] ?? 0) === 1;
  const conducting = result ? result.devices.filter((d) => st(d)) : [];
  const anyOn = conducting.length > 0;
  const RIGHT = half ? 560 : 500;
  const L = (p.l as number) > 0;
  const leg = (x: number, dx: number, top: string, bot: string, dTop: string, dBot: string, sideA: boolean) => (<>
    {wire([[x, 70], [x, 105]], st(top))}<Switch x={x} y={135} ang={90} label={top} lx={sideA ? 24 : -38} ly={4} on={st(top)} />{wire([[x, 165], [x, 205]], st(top))}
    {wire([[x, 205], [x, 245]], st(bot))}<Switch x={x} y={275} ang={90} label={bot} lx={sideA ? 24 : -38} ly={4} on={st(bot)} />{wire([[x, 305], [x, 340]], st(bot))}
    {wire([[x, 205], [x + dx, 205]])}
    {wire([[x + dx, 70], [x + dx, 105]], st(dTop))}<Diode x={x + dx} y={135} ang={-90} label={dTop} lx={dx < 0 ? -22 : 22} ly={4} on={st(dTop)} />{wire([[x + dx, 165], [x + dx, 205]], st(dTop))}
    {wire([[x + dx, 205], [x + dx, 245]], st(dBot))}<Diode x={x + dx} y={275} ang={-90} label={dBot} lx={dx < 0 ? -22 : 22} ly={4} on={st(dBot)} />{wire([[x + dx, 305], [x + dx, 340]], st(dBot))}
    {dot(x, 205)}
  </>);
  const endX = half ? 560 : 440;
  return (
    <svg viewBox="0 0 700 400" className="flex-1 min-h-0 w-full" style={{ background: BG }}>
      <defs><pattern id="grid3" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.8" fill="#1e293b" /></pattern></defs>
      <rect width="700" height="400" fill="url(#grid3)" />
      {wire([[half ? 180 : 70, 70], [RIGHT, 70]])}{wire([[half ? 180 : 70, 340], [RIGHT, 340]])}<Ground x={half ? 380 : 270} y={340} />
      {!half && (<><Source x={70} y={205} kind="dc" label="Vdc" />{wire([[70, 70], [70, 181]])}{wire([[70, 229], [70, 340]])}</>)}
      {half && (<>
        <Source x={560} y={137} kind="dc" label="" />{wire([[560, 70], [560, 113]])}{wire([[560, 161], [560, 205]])}
        <Source x={560} y={273} kind="dc" label="" />{wire([[560, 205], [560, 249]])}{wire([[560, 297], [560, 340]])}
        <Label x={520} y={142} t="Vdc/2" anchor="end" /><Label x={520} y={278} t="Vdc/2" anchor="end" /><Label x={576} y={200} t="MID" anchor="start" />{dot(560, 205)}</>)}
      {leg(220, -40, 'S1', 'S2', 'D1', 'D2', true)}
      {!half && leg(440, 40, 'S3', 'S4', 'D3', 'D4', false)}
      {/* load between the leg mid-point(s) */}
      {wire([[220, 205], [half ? 270 : 260, 205]], anyOn)}<Resistor x={half ? 300 : 290} y={205} label="R" ly={-18} />
      {L ? (<>{wire([[half ? 330 : 320, 205], [half ? 370 : 340, 205]], anyOn)}<Inductor x={half ? 400 : 370} y={205} label="L" ly={-18} />{wire([[half ? 430 : 400, 205], [endX, 205]], anyOn)}</>)
        : wire([[half ? 330 : 320, 205], [endX, 205]], anyOn)}
      <Label x={206} y={198} t="A" anchor="end" />{!half && <Label x={454} y={198} t="B" anchor="start" />}
      <text x={20} y={22} fontSize={13} fontWeight={700} fill="#e2e8f0">{TITLES[tid]} · {MODS[p.mod as string] ?? p.mod}{p.mod !== 'square' ? `  (ma = ${(p.ma as number).toFixed(2)}, mf = ${p.mf})` : ''}</text>
      <text x={20} y={40} fontSize={12} fill={anyOn ? ON : '#94a3b8'}>{result ? (anyOn ? `Conducting: ${conducting.join(' + ')}` : 'No device conducting') : 'Run a simulation'}</text>
    </svg>
  );
}

export function Schematic(props: Props) {
  const { result, idx, tid } = props;
  const sig = (k: string) => result?.signals[k]?.[idx];
  const readout = result?.readout ?? (tid.startsWith('inv_') ? ['Vo', 'Io', 'Iin', 'REF'] : ['buck', 'boost', 'buckboost'].includes(tid) ? ['Vo', 'IL', 'Iin', 'Vsw'] : ['Vs', 'Vo', 'Is', 'Io']);
  const colors: Record<string, string> = Object.fromEntries((result?.channels ?? []).map((c) => [c.key, c.c]));
  const unit = (k: string) => (k.startsWith('V') || k === 'REF' || k === 'CAR' ? (k === 'REF' || k === 'CAR' ? '' : 'V') : 'A');
  return (
    <div className="h-full flex flex-col">
      {['buck', 'boost', 'buckboost'].includes(tid) ? <DcSchematic {...props} /> : tid.startsWith('inv_') ? <InvSchematic {...props} /> : <AcSchematic {...props} />}
      <div className="grid grid-cols-4 gap-2 px-3 py-2 text-xs font-mono border-t border-slate-800 bg-slate-900">
        {readout.map((k) => (<span key={k} style={{ color: colors[k] ?? '#cbd5e1' }}>{k} {sig(k) === undefined ? '—' : sig(k)!.toFixed(2)} {unit(k)}</span>))}
      </div>
    </div>
  );
}
