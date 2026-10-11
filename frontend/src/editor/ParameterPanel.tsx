import { useEffect, useRef, useState } from 'react';
import { FlipHorizontal, RotateCw } from 'lucide-react';
import { specOf, useLibrary } from './library';
import { useEditor } from './store';
import { formatSI, parseSI } from './units';
import type { LibParam, SchematicComponent } from './types';

const inputCls = (bad: boolean) => `w-full bg-slate-800 border rounded px-2 py-1 outline-none focus:border-sky-500 ${bad ? 'border-red-500' : 'border-slate-700'}`;

function Field({ label, children, error, hint }: { label: string; children: React.ReactNode; error?: string; hint?: string }) {
  return (
    <label className="block mb-2">
      <span className="block text-[11px] text-slate-400 mb-0.5">{label}{hint && <span className="text-slate-600"> · {hint}</span>}</span>
      {children}
      {error && <span role="alert" className="block text-[11px] text-red-400 mt-0.5">{error}</span>}
    </label>
  );
}

/** Text field that edits in engineering notation and commits on Enter/blur. */
function NumberField({ comp, p }: { comp: SchematicComponent; p: LibParam }) {
  const setParam = useEditor((s) => s.setParam);
  const value = Number(comp.parameters[p.key] ?? p.default);
  const shown = formatSI(value, p.unit);
  const [text, setText] = useState(shown);
  const [err, setErr] = useState('');
  useEffect(() => { setText(shown); setErr(''); }, [shown, comp.id]);

  const commit = () => {
    if (text === shown) { setErr(''); return; }
    const v = parseSI(text, p.unit);
    if (Number.isNaN(v)) { setErr(`Enter a number, e.g. 4.7k${p.unit ? ' or 4.7k' + p.unit : ''}.`); return; }
    const r = setParam(comp.id, p.key, v);
    setErr(r.ok ? '' : r.error);
  };
  return (
    <Field label={p.label} hint={p.unit || undefined} error={err}>
      <input aria-label={p.label} data-param={p.key} className={inputCls(!!err)} value={text}
        onChange={(e) => setText(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setText(shown); setErr(''); } }} />
    </Field>
  );
}

export function ParameterPanel() {
  const selection = useEditor((s) => s.selection);
  const components = useEditor((s) => s.components);
  const { renameComponent, setParam, rotateSelected, mirrorSelected } = useEditor.getState();
  const token = useEditor((s) => s.focusParamsToken);
  useLibrary((s) => s.specs);
  const root = useRef<HTMLDivElement>(null);
  const [nameErr, setNameErr] = useState('');
  const comp = selection.length === 1 ? components.find((c) => c.id === selection[0]) : undefined;
  const [idText, setIdText] = useState(comp?.id ?? '');
  useEffect(() => { setIdText(comp?.id ?? ''); setNameErr(''); }, [comp?.id]);
  useEffect(() => { if (token) root.current?.querySelector<HTMLInputElement>('input[data-param]')?.focus(); }, [token]);

  if (!selection.length) {
    return <div className="p-3 text-xs text-slate-500">Nothing selected.<br />Drag a part from the library onto the canvas, then click it to edit its parameters.<div className="mt-3 text-slate-600">{components.length} part(s) in the schematic.</div></div>;
  }
  if (!comp) {
    return (
      <div className="p-3 text-xs text-slate-300">
        <div className="font-semibold mb-2">{selection.length} components selected</div>
        <div className="flex gap-2">
          <button className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700" onClick={rotateSelected}><RotateCw size={13} />Rotate</button>
          <button className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700" onClick={mirrorSelected}><FlipHorizontal size={13} />Mirror</button>
        </div>
      </div>
    );
  }

  const spec = specOf(comp.type);
  const groups: Record<string, LibParam[]> = {};
  (spec?.params ?? []).forEach((p) => (groups[p.group] ??= []).push(p));
  const commitName = () => { const r = renameComponent(comp.id, idText.trim()); setNameErr(r.ok ? '' : r.error); if (!r.ok) setIdText(comp.id); };

  return (
    <div ref={root} className="p-3 text-xs" data-testid="param-panel">
      <div className="font-semibold text-slate-200 text-sm">{spec?.label ?? comp.type}</div>
      <div className="text-slate-500 mb-3">{spec?.description}</div>
      <Field label="Reference" error={nameErr}>
        <input aria-label="Reference" className={inputCls(!!nameErr)} value={idText} onChange={(e) => setIdText(e.target.value)} onBlur={commitName}
          onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { setIdText(comp.id); setNameErr(''); } }} />
      </Field>
      {Object.entries(groups).map(([g, ps]) => (
        <div key={g}>
          {g !== 'main' && <div className="uppercase tracking-wider text-[10px] text-slate-500 mt-3 mb-1">{g}</div>}
          {ps.map((p) => p.kind === 'number'
            ? <NumberField key={`${comp.id}.${p.key}`} comp={comp} p={p} />
            : p.kind === 'select'
              ? <Field key={p.key} label={p.label}><select aria-label={p.label} className={inputCls(false)} value={String(comp.parameters[p.key])} onChange={(e) => setParam(comp.id, p.key, e.target.value)}>{p.options?.map((o) => <option key={o}>{o}</option>)}</select></Field>
              : <Field key={p.key} label={p.label}><input aria-label={p.label} className={inputCls(false)} value={String(comp.parameters[p.key] ?? '')} onChange={(e) => setParam(comp.id, p.key, e.target.value)} /></Field>)}
        </div>
      ))}
      {spec?.signals.map((s) => (
        <Field key={s.key} label={s.label} hint="control signal name">
          <input aria-label={s.label} className={inputCls(false)} value={String(comp.parameters[s.key] ?? '')} placeholder="e.g. G1"
            onChange={(e) => setParam(comp.id, s.key, e.target.value)} />
        </Field>
      ))}
      <div className="flex gap-2 mt-3">
        <button className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700" onClick={rotateSelected}><RotateCw size={13} />Rotate</button>
        <button className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700" onClick={mirrorSelected}><FlipHorizontal size={13} />Mirror</button>
      </div>
      <div className="mt-3 text-[10px] text-slate-600 font-mono">({comp.position.x}, {comp.position.y}) · {comp.rotation}°{comp.mirror ? ' · mirrored' : ''}</div>
    </div>
  );
}
