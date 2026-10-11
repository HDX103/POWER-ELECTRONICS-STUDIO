import { beforeEach, describe, expect, it } from 'vitest';
import { fitViewport, hitComponent, localToWorld, pinOffsets, pinWorld, rotatePoint, screenToWorld, snap, worldBounds, worldToLocal, worldToScreen, zoomAt } from '../geometry';
import { useLibrary } from '../library';
import type { SchematicComponent } from '../types';
import { setup } from './helpers';

const mk = (o: Partial<SchematicComponent> = {}): SchematicComponent =>
  ({ id: 'R1', type: 'resistor', position: { x: 100, y: 50 }, rotation: 0, mirror: false, parameters: {}, ...o });
const spec = (t: string) => useLibrary.getState().specs[t];
beforeEach(setup);

describe('snap', () => {
  it('rounds to the grid and never returns -0', () => {
    expect(snap(14)).toBe(10); expect(snap(15)).toBe(20); expect(snap(-4)).toBe(0); expect(Object.is(snap(-4), 0)).toBe(true);
  });
});

describe('transforms', () => {
  it('rotates clockwise in a y-down frame', () => {
    expect(rotatePoint({ x: 30, y: 0 }, 90)).toEqual({ x: 0, y: 30 });
    expect(rotatePoint({ x: 30, y: 0 }, 180)).toEqual({ x: -30, y: 0 });
    expect(rotatePoint({ x: 30, y: 0 }, 270)).toEqual({ x: 0, y: -30 });
  });
  it('places the pins of a resistor at ±30 and rotates them with the part', () => {
    const r = spec('resistor');
    expect(pinWorld(mk(), r, 'p')).toEqual({ x: 70, y: 50 });
    expect(pinWorld(mk(), r, 'n')).toEqual({ x: 130, y: 50 });
    expect(pinWorld(mk({ rotation: 90 }), r, 'n')).toEqual({ x: 100, y: 80 });
    expect(pinWorld(mk({ mirror: true }), r, 'p')).toEqual({ x: 130, y: 50 });
  });
  it('mirror is applied before rotation (matches the SVG transform order)', () => {
    expect(localToWorld(mk({ mirror: true, rotation: 90 }), { x: 30, y: 0 })).toEqual({ x: 100, y: 20 });
  });
  it.each([0, 90, 180, 270] as const)('worldToLocal inverts localToWorld (rot %s, both mirrors)', (rot) => {
    for (const mirror of [false, true]) {
      const c = mk({ rotation: rot, mirror }), l = { x: 17, y: -9 };
      expect(worldToLocal(c, localToWorld(c, l))).toEqual(l);
    }
  });
  it('all pins of every placeable part land on the 10-unit grid in every orientation', () => {
    for (const s of Object.values(useLibrary.getState().specs)) {
      if (s.status === 'planned') continue;
      for (const rotation of [0, 90, 180, 270] as const) for (const mirror of [false, true])
        for (const n of s.pins) {
          const p = pinWorld(mk({ type: s.type, rotation, mirror }), s, n)!;
          expect(p.x % 10).toBe(0); expect(p.y % 10).toBe(0);
        }
    }
  });
  it('utility parts have a single pin at the centre; 4-pin parts split left/right', () => {
    expect(pinOffsets(spec('ground'))).toEqual({ g: { x: 0, y: 0 } });
    const t = pinOffsets(spec('transformer'));
    expect(t.p1.x).toBe(-30); expect(t.p2.x).toBe(-30); expect(t.s1.x).toBe(30); expect(t.s2.x).toBe(30);
    expect(t.p1.y).toBeLessThan(t.p2.y);
  });
});

describe('hit testing and bounds', () => {
  it('hits inside the rotated body and misses outside', () => {
    const c = mk({ rotation: 90 });
    expect(hitComponent(c, spec('resistor'), { x: 100, y: 75 })).toBe(true);     // along the vertical axis
    expect(hitComponent(c, spec('resistor'), { x: 125, y: 50 })).toBe(false);    // where an unrotated part would be
  });
  it('bounds follow rotation', () => {
    const b = worldBounds(mk({ rotation: 90 }), spec('resistor'));
    expect(b.x1 - b.x0).toBe(32); expect(b.y1 - b.y0).toBe(60);
  });
});

describe('viewport', () => {
  it('screen/world are inverse', () => {
    const vp = { x: 40, y: -15, zoom: 2.5 }, p = { x: 123, y: 77 };
    expect(screenToWorld(vp, worldToScreen(vp, p))).toEqual(p);
  });
  it('zoomAt keeps the anchor point stationary and clamps', () => {
    const vp = { x: 10, y: 20, zoom: 1 }, a = { x: 300, y: 200 };
    const w0 = screenToWorld(vp, a), v2 = zoomAt(vp, 2, a), w1 = screenToWorld(v2, a);
    expect(w1.x).toBeCloseTo(w0.x); expect(w1.y).toBeCloseTo(w0.y); expect(v2.zoom).toBe(2);
    expect(zoomAt(vp, 1e6, a).zoom).toBe(6); expect(zoomAt(vp, 1e-9, a).zoom).toBe(0.1);
  });
  it('fitViewport centres the bounds inside the canvas', () => {
    const v = fitViewport({ x0: 0, y0: 0, x1: 400, y1: 200 }, { w: 1000, h: 600 });
    expect(worldToScreen(v, { x: 200, y: 100 })).toEqual({ x: 500, y: 300 });
    const tl = worldToScreen(v, { x: 0, y: 0 }), br = worldToScreen(v, { x: 400, y: 200 });
    expect(tl.x).toBeGreaterThanOrEqual(0); expect(br.x).toBeLessThanOrEqual(1000);
  });
  it('fitViewport on an empty schematic is a harmless default', () => {
    expect(fitViewport(null, { w: 800, h: 600 }).zoom).toBe(1);
  });
});
