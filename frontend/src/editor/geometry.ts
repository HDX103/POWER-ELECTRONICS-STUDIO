import type { ComponentSpec, Point, Rotation, SchematicComponent } from './types';

export const GRID = 10;
export const snap = (v: number, g = GRID): number => (Math.round(v / g) * g) || 0;   // `|| 0` removes -0
export const snapPoint = (p: Point, g = GRID): Point => ({ x: snap(p.x, g), y: snap(p.y, g) });
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ------------------------------------------------------------------ viewport
export interface Viewport { x: number; y: number; zoom: number }     // screen = world * zoom + (x, y)
export const MIN_ZOOM = 0.1, MAX_ZOOM = 6;
export const screenToWorld = (vp: Viewport, p: Point): Point => ({ x: (p.x - vp.x) / vp.zoom, y: (p.y - vp.y) / vp.zoom });
export const worldToScreen = (vp: Viewport, p: Point): Point => ({ x: p.x * vp.zoom + vp.x, y: p.y * vp.zoom + vp.y });

/** Zoom keeping the world point under `anchor` (screen coordinates) fixed. */
export function zoomAt(vp: Viewport, factor: number, anchor: Point): Viewport {
  const zoom = clamp(vp.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  const k = zoom / vp.zoom;
  return { zoom, x: anchor.x - (anchor.x - vp.x) * k, y: anchor.y - (anchor.y - vp.y) * k };
}

export interface Rect { x0: number; y0: number; x1: number; y1: number }
export function fitViewport(b: Rect | null, size: { w: number; h: number }, pad = 60): Viewport {
  if (!b || size.w <= 0 || size.h <= 0) return { x: size.w / 2, y: size.h / 2, zoom: 1 };
  const w = Math.max(b.x1 - b.x0, 1), h = Math.max(b.y1 - b.y0, 1);
  const zoom = clamp(Math.min((size.w - 2 * pad) / w, (size.h - 2 * pad) / h), MIN_ZOOM, 2);
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  return { zoom, x: size.w / 2 - cx * zoom, y: size.h / 2 - cy * zoom };
}

// ------------------------------------------------------------------ component transforms
export function rotatePoint(p: Point, rot: Rotation): Point {      // clockwise, y axis pointing down (SVG)
  switch (rot) {
    case 90: return { x: -p.y || 0, y: p.x || 0 };                    // `|| 0` normalises -0
    case 180: return { x: -p.x || 0, y: -p.y || 0 };
    case 270: return { x: p.y || 0, y: -p.x || 0 };
    default: return { x: p.x || 0, y: p.y || 0 };
  }
}
export const nextRotation = (r: Rotation): Rotation => ((r + 90) % 360) as Rotation;

type Placed = Pick<SchematicComponent, 'position' | 'rotation' | 'mirror'>;
/** Same order as the SVG transform `translate(pos) rotate(rot) scale(mirror ? -1 : 1, 1)`. */
export function localToWorld(c: Placed, l: Point): Point {
  const r = rotatePoint({ x: c.mirror ? -l.x : l.x, y: l.y }, c.rotation);
  return { x: c.position.x + r.x, y: c.position.y + r.y };
}
export function worldToLocal(c: Placed, w: Point): Point {
  const r = rotatePoint({ x: w.x - c.position.x, y: w.y - c.position.y }, ((360 - c.rotation) % 360) as Rotation);
  return { x: (c.mirror ? -r.x : r.x) || 0, y: r.y || 0 };
}

// ------------------------------------------------------------------ symbol geometry, derived from library metadata
const FALLBACK: Pick<ComponentSpec, 'pins' | 'category'> = { pins: ['p', 'n'], category: 'passive' };

/** Pin positions in local coordinates. Two-pin parts sit at (±30, 0); utility parts have one pin at the origin;
 *  larger parts spread their pins over a left and a right side on a 20-unit pitch. All land on the 10-unit grid. */
export function pinOffsets(spec: Pick<ComponentSpec, 'pins' | 'category'> = FALLBACK): Record<string, Point> {
  const pins = spec.pins, out: Record<string, Point> = {};
  if (spec.category === 'utility') { pins.forEach((p) => (out[p] = { x: 0, y: 0 })); return out; }
  if (pins.length <= 2) { pins.forEach((p, i) => (out[p] = { x: i === 0 ? -30 : 30, y: 0 })); return out; }
  const nl = Math.ceil(pins.length / 2), nr = pins.length - nl;
  pins.forEach((p, i) => {
    const left = i < nl, k = left ? i : i - nl, n = left ? nl : nr;
    out[p] = { x: left ? -30 : 30, y: (k - (n - 1) / 2) * 20 };
  });
  return out;
}

export function localBounds(spec: Pick<ComponentSpec, 'pins' | 'category'> = FALLBACK): Rect {
  if (spec.category === 'utility') return { x0: -8, y0: -8, x1: 8, y1: 8 };
  if (spec.pins.length <= 2) return { x0: -30, y0: -16, x1: 30, y1: 16 };
  const rows = Math.ceil(spec.pins.length / 2);
  const hh = Math.max(16, rows * 10 + 6);
  return { x0: -30, y0: -hh, x1: 30, y1: hh };
}

export function pinWorld(c: SchematicComponent, spec: ComponentSpec | undefined, pin: string): Point | null {
  const o = pinOffsets(spec)[pin];
  return o ? localToWorld(c, o) : null;
}

export function worldBounds(c: SchematicComponent, spec?: ComponentSpec): Rect {
  const b = localBounds(spec);
  const pts = [{ x: b.x0, y: b.y0 }, { x: b.x1, y: b.y0 }, { x: b.x1, y: b.y1 }, { x: b.x0, y: b.y1 }].map((p) => localToWorld(c, p));
  return { x0: Math.min(...pts.map((p) => p.x)), y0: Math.min(...pts.map((p) => p.y)), x1: Math.max(...pts.map((p) => p.x)), y1: Math.max(...pts.map((p) => p.y)) };
}

export function hitComponent(c: SchematicComponent, spec: ComponentSpec | undefined, w: Point, pad = 4): boolean {
  const l = worldToLocal(c, w), b = localBounds(spec);
  return l.x >= b.x0 - pad && l.x <= b.x1 + pad && l.y >= b.y0 - pad && l.y <= b.y1 + pad;
}

export const rectsIntersect = (a: Rect, b: Rect) => a.x0 <= b.x1 && a.x1 >= b.x0 && a.y0 <= b.y1 && a.y1 >= b.y0;
export const normRect = (a: Point, b: Point): Rect => ({ x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) });
export function unionRect(rs: Rect[]): Rect | null {
  if (!rs.length) return null;
  return { x0: Math.min(...rs.map((r) => r.x0)), y0: Math.min(...rs.map((r) => r.y0)), x1: Math.max(...rs.map((r) => r.x1)), y1: Math.max(...rs.map((r) => r.y1)) };
}
