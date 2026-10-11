import { useEffect, useRef, useState } from 'react';
import { Copy, FlipHorizontal, Grid3x3, Magnet, Maximize, Redo2, RotateCw, Trash2, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import { GRID, hitComponent, normRect, pinOffsets, screenToWorld, zoomAt } from './geometry';
import type { Rect } from './geometry';
import { formatSI } from './units';
import { specOf, useLibrary } from './library';
import { useEditor } from './store';
import { SymbolBody } from './symbols';
import type { Point, SchematicComponent } from './types';

export const DND_TYPE = 'application/x-pes-component';

/** Text shown under/next to a symbol: the main value, or the driving signal for gated devices. */
export function valueText(c: SchematicComponent): string {
  const spec = specOf(c.type);
  if (!spec) return '';
  if (spec.signals.length) return String(c.parameters[spec.signals[0].key] || '(no gate)');
  const p = spec.params[0];
  if (!p) return c.type === 'net_label' ? String(c.parameters.name ?? '') : '';
  return p.kind === 'number' ? formatSI(Number(c.parameters[p.key]), p.unit) : String(c.parameters[p.key] ?? '');
}

function ComponentView({ c, selected }: { c: SchematicComponent; selected: boolean }) {
  const spec = specOf(c.type);
  const pins = pinOffsets(spec);
  const vertical = c.rotation === 90 || c.rotation === 270;
  const utility = spec?.category === 'utility' && c.type !== 'net_label';
  const lx = vertical ? c.position.x + 24 : c.position.x, ly = vertical ? c.position.y - 2 : c.position.y - 22;
  const anchor = vertical ? 'start' : 'middle';
  return (
    <g data-comp={c.id} data-testid={`comp-${c.id}`} style={{ cursor: 'move' }}>
      <g transform={`translate(${c.position.x},${c.position.y}) rotate(${c.rotation}) scale(${c.mirror ? -1 : 1},1)`}
        fill="none" stroke={selected ? '#38bdf8' : '#cbd5e1'} strokeWidth={selected ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round"
        color={selected ? '#38bdf8' : '#cbd5e1'}>
        <SymbolBody spec={spec} />
        {Object.entries(pins).map(([n, p]) => <rect key={n} x={p.x - 2.5} y={p.y - 2.5} width={5} height={5} fill="#0b1220" stroke="#64748b" strokeWidth={1} />)}
      </g>
      {!utility && <>
        <text x={lx} y={ly} textAnchor={anchor} fontSize={12} fontWeight={700} fill={selected ? '#7dd3fc' : '#e2e8f0'} pointerEvents="none">{c.id}</text>
        <text x={lx} y={ly + (vertical ? 14 : 44)} textAnchor={anchor} fontSize={11} fill="#94a3b8" pointerEvents="none">{valueText(c)}</text>
      </>}
    </g>
  );
}

type Drag =
  | { kind: 'move'; start: Record<string, Point>; origin: Point }
  | { kind: 'box'; a: Point; additive: boolean }
  | { kind: 'pan'; origin: Point; vp: { x: number; y: number } };

export function Canvas() {
  const st = useEditor();
  const specs = useLibrary((s) => s.specs);
  const ref = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const space = useRef(false);
  const [box, setBox] = useState<Rect | null>(null);
  const [cursor, setCursor] = useState<Point>({ x: 0, y: 0 });
  const vp = st.viewport;

  const rect = () => ref.current?.getBoundingClientRect() ?? ({ left: 0, top: 0 } as DOMRect);
  const toScreen = (e: { clientX: number; clientY: number }): Point => { const r = rect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const toWorld = (e: { clientX: number; clientY: number }) => screenToWorld(useEditor.getState().viewport, toScreen(e));

  // keep the store informed about the canvas size (needed by "fit")
  useEffect(() => {
    const el = ref.current; if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => { const r = el.getBoundingClientRect(); if (r.width && r.height) useEditor.getState().setCanvasSize(r.width, r.height); });
    ro.observe(el); return () => ro.disconnect();
  }, []);

  // wheel zoom needs a non-passive listener to prevent page scroll
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = useEditor.getState(), r = el.getBoundingClientRect();
      s.setViewport(zoomAt(s.viewport, Math.pow(1.0015, -e.deltaY), { x: e.clientX - r.left, y: e.clientY - r.top }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const topHit = (w: Point): SchematicComponent | undefined => {
    const comps = useEditor.getState().components;
    for (let i = comps.length - 1; i >= 0; i--) if (hitComponent(comps[i], specs[comps[i].type], w)) return comps[i];
    return undefined;
  };

  const onMouseDown = (e: React.MouseEvent) => {
    (ref.current?.parentElement as HTMLElement | null)?.focus();
    const s = useEditor.getState(), sp = toScreen(e), w = toWorld(e);
    if (e.button === 1 || e.button === 2 || space.current) {
      drag.current = { kind: 'pan', origin: sp, vp: { x: s.viewport.x, y: s.viewport.y } }; e.preventDefault(); return;
    }
    if (e.button !== 0) return;
    const hit = topHit(w);
    if (hit) {
      if (e.shiftKey) { s.toggleSelect(hit.id); return; }
      if (!s.selection.includes(hit.id)) s.select([hit.id]);
      drag.current = { kind: 'move', start: useEditor.getState().beginDrag(), origin: sp };
    } else {
      if (!e.shiftKey) s.select([]);
      drag.current = { kind: 'box', a: w, additive: e.shiftKey };
    }
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = drag.current, s = useEditor.getState();
      if (!ref.current) return;
      const sp = toScreen(e);
      setCursor(screenToWorld(s.viewport, sp));
      if (!d) return;
      if (d.kind === 'pan') s.setViewport({ ...s.viewport, x: d.vp.x + sp.x - d.origin.x, y: d.vp.y + sp.y - d.origin.y });
      else if (d.kind === 'move') s.dragMove(d.start, (sp.x - d.origin.x) / s.viewport.zoom, (sp.y - d.origin.y) / s.viewport.zoom);
      else setBox(normRect(d.a, screenToWorld(s.viewport, sp)));
    };
    const onUp = (e: MouseEvent) => {
      const d = drag.current; drag.current = null;
      if (d?.kind === 'box') { useEditor.getState().selectInRect(normRect(d.a, toWorld(e)), d.additive); setBox(null); }
    };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  });

  const onDoubleClick = (e: React.MouseEvent) => {
    const hit = topHit(toWorld(e));
    if (hit) { useEditor.getState().select([hit.id]); useEditor.getState().requestParamFocus(); }
  };

  const onDrop = (e: React.DragEvent) => {
    const type = e.dataTransfer.getData(DND_TYPE);
    if (!type) return;
    e.preventDefault();
    useEditor.getState().addComponent(type, toWorld(e));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const s = useEditor.getState(), k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    const handled = () => e.preventDefault();
    if (e.key === ' ') { space.current = true; handled(); return; }
    if (mod && k === 'z') { handled(); e.shiftKey ? s.redo() : s.undo(); }
    else if (mod && k === 'y') { handled(); s.redo(); }
    else if (mod && k === 'a') { handled(); s.selectAll(); }
    else if (mod && k === 'c') { handled(); s.copySelected(); }
    else if (mod && k === 'x') { handled(); s.cutSelected(); }
    else if (mod && k === 'v') { handled(); s.paste(); }
    else if (mod && k === 'd') { handled(); s.duplicateSelected(); }
    else if (!mod && k === 'r') { handled(); s.rotateSelected(); }
    else if (!mod && k === 'm') { handled(); s.mirrorSelected(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { handled(); s.deleteSelected(); }
    else if (e.key === 'Escape') s.select([]);
    else if (e.key === 'Home') { handled(); s.fitView(); }
    else if (e.key.startsWith('Arrow')) {
      handled();
      const step = e.shiftKey ? GRID * 5 : GRID;
      s.nudgeSelected(e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0, e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0);
    }
  };

  const tb = 'p-1.5 rounded hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent';
  const none = !st.selection.length;
  const sel = new Set(st.selection);
  const size = 4000;   // grid extent (world units) painted around the origin; the pattern itself is infinite-looking at this size

  return (
    <div tabIndex={0} onKeyDown={onKeyDown} onKeyUp={(e) => { if (e.key === ' ') space.current = false; }}
      className="relative w-full h-full outline-none bg-[#0b1220]" data-testid="canvas-root">
      <svg ref={ref} data-testid="canvas" className="w-full h-full block select-none"
        onMouseDown={onMouseDown} onDoubleClick={onDoubleClick} onContextMenu={(e) => e.preventDefault()}
        onDragOver={(e) => { if (e.dataTransfer.types.includes(DND_TYPE)) e.preventDefault(); }} onDrop={onDrop}>
        <defs>
          <pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse"><circle cx={0} cy={0} r={0.6} fill="#334155" /></pattern>
          <pattern id="grid-major" width={GRID * 10} height={GRID * 10} patternUnits="userSpaceOnUse"><circle cx={0} cy={0} r={1.2} fill="#475569" /></pattern>
        </defs>
        <g transform={`translate(${vp.x},${vp.y}) scale(${vp.zoom})`}>
          {st.showGrid && <><rect x={-size} y={-size} width={2 * size} height={2 * size} fill="url(#grid)" pointerEvents="none" />
            <rect x={-size} y={-size} width={2 * size} height={2 * size} fill="url(#grid-major)" pointerEvents="none" /></>}
          {st.components.map((c) => <ComponentView key={c.id} c={c} selected={sel.has(c.id)} />)}
          {box && <rect x={box.x0} y={box.y0} width={box.x1 - box.x0} height={box.y1 - box.y0} fill="rgba(56,189,248,.12)" stroke="#38bdf8" strokeDasharray="4 3" strokeWidth={1 / vp.zoom} pointerEvents="none" />}
        </g>
      </svg>

      <div className="absolute top-2 left-2 flex items-center gap-0.5 bg-slate-900/90 border border-slate-700 rounded px-1 py-0.5 text-slate-300">
        <button className={tb} title="Undo (Ctrl+Z)" aria-label="Undo" disabled={!st.past.length} onClick={st.undo}><Undo2 size={15} /></button>
        <button className={tb} title="Redo (Ctrl+Shift+Z)" aria-label="Redo" disabled={!st.future.length} onClick={st.redo}><Redo2 size={15} /></button>
        <span className="w-px h-4 bg-slate-700 mx-1" />
        <button className={tb} title="Rotate (R)" aria-label="Rotate" disabled={none} onClick={st.rotateSelected}><RotateCw size={15} /></button>
        <button className={tb} title="Mirror (M)" aria-label="Mirror" disabled={none} onClick={st.mirrorSelected}><FlipHorizontal size={15} /></button>
        <button className={tb} title="Duplicate (Ctrl+D)" aria-label="Duplicate" disabled={none} onClick={st.duplicateSelected}><Copy size={15} /></button>
        <button className={tb} title="Delete (Del)" aria-label="Delete" disabled={none} onClick={st.deleteSelected}><Trash2 size={15} /></button>
        <span className="w-px h-4 bg-slate-700 mx-1" />
        <button className={tb} title="Zoom in" aria-label="Zoom in" onClick={() => st.zoomBy(1.25)}><ZoomIn size={15} /></button>
        <button className={tb} title="Zoom out" aria-label="Zoom out" onClick={() => st.zoomBy(0.8)}><ZoomOut size={15} /></button>
        <button className={tb} title="Fit to screen (Home)" aria-label="Fit" onClick={st.fitView}><Maximize size={15} /></button>
        <span className="w-px h-4 bg-slate-700 mx-1" />
        <button className={`${tb} ${st.showGrid ? 'text-sky-400' : ''}`} title="Show grid" aria-label="Toggle grid" onClick={st.toggleGrid}><Grid3x3 size={15} /></button>
        <button className={`${tb} ${st.snapToGrid ? 'text-sky-400' : ''}`} title="Snap to grid" aria-label="Toggle snap" onClick={st.toggleSnap}><Magnet size={15} /></button>
      </div>
      <div className="absolute bottom-1 left-2 text-[10px] text-slate-500 font-mono pointer-events-none" data-testid="status">
        x {Math.round(cursor.x)}  y {Math.round(cursor.y)} · zoom {Math.round(vp.zoom * 100)}% · {st.components.length} parts · {st.selection.length} selected
      </div>
    </div>
  );
}
