import { create } from 'zustand';
import { GRID, fitViewport, nextRotation, rectsIntersect, snap, snapPoint, unionRect, worldBounds, zoomAt } from './geometry';
import type { Rect, Viewport } from './geometry';
import { specOf } from './library';
import type { ComponentSpec, ParamValue, Point, Schematic, SchematicComponent, Wire } from './types';

const HISTORY_LIMIT = 200;
const ID_RE = /^[A-Za-z][A-Za-z0-9_]*$/;
interface Snap { components: SchematicComponent[]; wires: Wire[] }
export type EditResult = { ok: true } | { ok: false; error: string };

/** Smallest unused "<prefix><n>". */
export function nextId(prefix: string, used: Set<string>): string {
  let n = 1;
  while (used.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

export function defaultParameters(spec: ComponentSpec): Record<string, ParamValue> {
  const p: Record<string, ParamValue> = {};
  for (const q of spec.params) p[q.key] = q.default;
  for (const s of spec.signals) p[s.key] = '';       // unassigned control signal
  return p;
}

interface EditorState extends Schematic {
  selection: string[];
  viewport: Viewport;
  canvasSize: { w: number; h: number };
  snapToGrid: boolean;
  showGrid: boolean;
  clipboard: SchematicComponent[] | null;
  pasteCount: number;
  past: Snap[];
  future: Snap[];
  focusParamsToken: number;

  addComponent: (type: string, at: Point) => string | null;
  select: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  selectInRect: (r: Rect, additive: boolean) => void;
  beginDrag: () => Record<string, Point>;
  dragMove: (start: Record<string, Point>, dx: number, dy: number) => void;
  nudgeSelected: (dx: number, dy: number) => void;
  rotateSelected: () => void;
  mirrorSelected: () => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  copySelected: () => void;
  cutSelected: () => void;
  paste: () => void;
  setParam: (id: string, key: string, value: ParamValue) => EditResult;
  renameComponent: (id: string, newId: string) => EditResult;
  undo: () => void;
  redo: () => void;
  setCanvasSize: (w: number, h: number) => void;
  setViewport: (v: Viewport) => void;
  zoomBy: (factor: number, anchor?: Point) => void;
  fitView: () => void;
  toggleSnap: () => void;
  toggleGrid: () => void;
  requestParamFocus: () => void;
  newProject: () => void;
  loadSchematic: (s: Schematic) => void;
  toSchematic: () => Schematic;
}

const initial = () => ({
  components: [] as SchematicComponent[], wires: [] as Wire[], selection: [] as string[],
  viewport: { x: 0, y: 0, zoom: 1 }, canvasSize: { w: 800, h: 600 }, snapToGrid: true, showGrid: true,
  clipboard: null as SchematicComponent[] | null, pasteCount: 0, past: [] as Snap[], future: [] as Snap[], focusParamsToken: 0,
});

let dragStarted = false;     // has the current drag already pushed its single history entry?

export const useEditor = create<EditorState>((set, get) => {
  /** Push the current document onto the undo stack (call BEFORE mutating). */
  const checkpoint = () => {
    const { components, wires, past } = get();
    set({ past: [...past, { components, wires }].slice(-HISTORY_LIMIT), future: [] });
  };
  const sel = () => new Set(get().selection);
  const maybeSnap = (p: Point) => (get().snapToGrid ? snapPoint(p) : p);
  const groupPivot = (comps: SchematicComponent[]): Point => {
    const r = unionRect(comps.map((c) => worldBounds(c, specOf(c.type))))!;
    return snapPoint({ x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 });
  };
  const mapSelected = (fn: (c: SchematicComponent) => SchematicComponent) => {
    const s = sel();
    set({ components: get().components.map((c) => (s.has(c.id) ? fn(c) : c)) });
  };
  const cloneAt = (src: SchematicComponent[], dx: number, dy: number): SchematicComponent[] => {
    const used = new Set(get().components.map((c) => c.id));
    return src.map((c) => {
      const prefix = specOf(c.type)?.prefix ?? c.id.replace(/\d+$/, '') ?? 'X';
      const id = nextId(prefix, used); used.add(id);
      return { ...c, id, position: { x: c.position.x + dx, y: c.position.y + dy }, parameters: { ...c.parameters } };
    });
  };

  return {
    ...initial(),

    addComponent: (type, at) => {
      const spec = specOf(type);
      if (!spec || spec.status === 'planned') return null;
      const id = nextId(spec.prefix, new Set(get().components.map((c) => c.id)));
      checkpoint();
      const comp: SchematicComponent = { id, type, position: maybeSnap(at), rotation: 0, mirror: false, parameters: defaultParameters(spec) };
      set({ components: [...get().components, comp], selection: [id] });
      return id;
    },

    select: (ids) => set({ selection: ids }),
    toggleSelect: (id) => { const s = sel(); s.has(id) ? s.delete(id) : s.add(id); set({ selection: [...s] }); },
    selectAll: () => set({ selection: get().components.map((c) => c.id) }),
    selectInRect: (r, additive) => {
      const hit = get().components.filter((c) => rectsIntersect(worldBounds(c, specOf(c.type)), r)).map((c) => c.id);
      set({ selection: additive ? [...new Set([...get().selection, ...hit])] : hit });
    },

    beginDrag: () => {
      dragStarted = false;
      const s = sel();
      return Object.fromEntries(get().components.filter((c) => s.has(c.id)).map((c) => [c.id, c.position]));
    },
    dragMove: (start, dx, dy) => {
      const ddx = get().snapToGrid ? snap(dx) : dx, ddy = get().snapToGrid ? snap(dy) : dy;
      if (!dragStarted) { if (!ddx && !ddy) return; checkpoint(); dragStarted = true; }
      set({ components: get().components.map((c) => (start[c.id] ? { ...c, position: { x: start[c.id].x + ddx, y: start[c.id].y + ddy } } : c)) });
    },
    nudgeSelected: (dx, dy) => {
      if (!get().selection.length) return;
      checkpoint();
      mapSelected((c) => ({ ...c, position: { x: c.position.x + dx, y: c.position.y + dy } }));
    },

    rotateSelected: () => {
      const s = sel(); const chosen = get().components.filter((c) => s.has(c.id));
      if (!chosen.length) return;
      checkpoint();
      if (chosen.length === 1) { mapSelected((c) => ({ ...c, rotation: nextRotation(c.rotation) })); return; }
      const pv = groupPivot(chosen);          // rotate the whole selection rigidly 90° clockwise about its centre
      mapSelected((c) => ({ ...c, rotation: nextRotation(c.rotation),
        position: { x: pv.x - (c.position.y - pv.y), y: pv.y + (c.position.x - pv.x) } }));
    },
    mirrorSelected: () => {
      const s = sel(); const chosen = get().components.filter((c) => s.has(c.id));
      if (!chosen.length) return;
      checkpoint();
      if (chosen.length === 1) { mapSelected((c) => ({ ...c, mirror: !c.mirror })); return; }
      const pv = groupPivot(chosen);
      mapSelected((c) => ({ ...c, mirror: !c.mirror, position: { x: 2 * pv.x - c.position.x, y: c.position.y } }));
    },

    deleteSelected: () => {
      const s = sel(); if (!s.size) return;
      checkpoint();
      set({
        components: get().components.filter((c) => !s.has(c.id)),
        wires: get().wires.filter((w) => !(w.from && s.has(w.from.componentId)) && !(w.to && s.has(w.to.componentId))),
        selection: [],
      });
    },
    duplicateSelected: () => {
      const s = sel(); const src = get().components.filter((c) => s.has(c.id));
      if (!src.length) return;
      checkpoint();
      const copies = cloneAt(src, 2 * GRID, 2 * GRID);
      set({ components: [...get().components, ...copies], selection: copies.map((c) => c.id) });
    },
    copySelected: () => {
      const s = sel(); const src = get().components.filter((c) => s.has(c.id));
      if (src.length) set({ clipboard: src.map((c) => ({ ...c, parameters: { ...c.parameters } })), pasteCount: 0 });
    },
    cutSelected: () => { get().copySelected(); get().deleteSelected(); },
    paste: () => {
      const clip = get().clipboard; if (!clip?.length) return;
      checkpoint();
      const n = get().pasteCount + 1;
      const copies = cloneAt(clip, 2 * GRID * n, 2 * GRID * n);
      set({ components: [...get().components, ...copies], selection: copies.map((c) => c.id), pasteCount: n });
    },

    setParam: (id, key, value) => {
      const c = get().components.find((x) => x.id === id);
      if (!c) return { ok: false, error: `No component '${id}'.` };
      const spec = specOf(c.type);
      const ps = spec?.params.find((p) => p.key === key);
      const isSignal = spec?.signals.some((s) => s.key === key);
      if (!ps && !isSignal) return { ok: false, error: `${c.type} has no parameter '${key}'.` };
      if (ps?.kind === 'number') {
        if (typeof value !== 'number' || !Number.isFinite(value)) return { ok: false, error: `${ps.label} must be a number.` };
        if (ps.min != null && value < ps.min) return { ok: false, error: `${ps.label} must be ≥ ${ps.min}.` };
        if (ps.max != null && value > ps.max) return { ok: false, error: `${ps.label} must be ≤ ${ps.max}.` };
      }
      if (ps?.kind === 'select' && !ps.options?.includes(String(value))) return { ok: false, error: `${ps.label}: invalid choice.` };
      if (c.parameters[key] === value) return { ok: true };
      checkpoint();
      set({ components: get().components.map((x) => (x.id === id ? { ...x, parameters: { ...x.parameters, [key]: value } } : x)) });
      return { ok: true };
    },
    renameComponent: (id, newId) => {
      if (newId === id) return { ok: true };
      if (!ID_RE.test(newId)) return { ok: false, error: 'Use letters, digits and _ and start with a letter.' };
      if (get().components.some((c) => c.id === newId)) return { ok: false, error: `'${newId}' is already used.` };
      checkpoint();
      const re = (r: Wire['from']) => (r && r.componentId === id ? { ...r, componentId: newId } : r);
      set({
        components: get().components.map((c) => (c.id === id ? { ...c, id: newId } : c)),
        wires: get().wires.map((w) => ({ ...w, from: re(w.from), to: re(w.to) })),
        selection: get().selection.map((s) => (s === id ? newId : s)),
      });
      return { ok: true };
    },

    undo: () => {
      const { past, future, components, wires } = get();
      if (!past.length) return;
      const prev = past[past.length - 1];
      const ids = new Set(prev.components.map((c) => c.id));
      set({ components: prev.components, wires: prev.wires, past: past.slice(0, -1), future: [...future, { components, wires }],
        selection: get().selection.filter((s) => ids.has(s)) });
    },
    redo: () => {
      const { past, future, components, wires } = get();
      if (!future.length) return;
      const next = future[future.length - 1];
      const ids = new Set(next.components.map((c) => c.id));
      set({ components: next.components, wires: next.wires, future: future.slice(0, -1), past: [...past, { components, wires }],
        selection: get().selection.filter((s) => ids.has(s)) });
    },

    setCanvasSize: (w, h) => set({ canvasSize: { w, h } }),
    setViewport: (viewport) => set({ viewport }),
    zoomBy: (factor, anchor) => {
      const { w, h } = get().canvasSize;
      set({ viewport: zoomAt(get().viewport, factor, anchor ?? { x: w / 2, y: h / 2 }) });
    },
    fitView: () => {
      const b = unionRect(get().components.map((c) => worldBounds(c, specOf(c.type))));
      set({ viewport: fitViewport(b, get().canvasSize) });
    },
    toggleSnap: () => set({ snapToGrid: !get().snapToGrid }),
    toggleGrid: () => set({ showGrid: !get().showGrid }),
    requestParamFocus: () => set({ focusParamsToken: get().focusParamsToken + 1 }),

    newProject: () => set({ ...initial(), canvasSize: get().canvasSize, snapToGrid: get().snapToGrid, showGrid: get().showGrid }),
    loadSchematic: (s) => { get().newProject(); set({ components: s.components, wires: s.wires }); get().fitView(); },
    toSchematic: () => ({ components: get().components, wires: get().wires }),
  };
});

export const resetEditor = () => { dragStarted = false; useEditor.setState({ ...initial() }); };
