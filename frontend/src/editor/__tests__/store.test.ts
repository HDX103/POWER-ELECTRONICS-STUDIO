import { beforeEach, describe, expect, it } from 'vitest';
import { pinWorld } from '../geometry';
import { useLibrary } from '../library';
import { parseProject, serializeProject } from '../project';
import { nextId, useEditor } from '../store';
import { comp, ed, ids, setup } from './helpers';

beforeEach(setup);

describe('placement', () => {
  it('places a part with metadata defaults, a fresh designator and selects it', () => {
    const id = ed().addComponent('resistor', { x: 103, y: 48 })!;
    expect(id).toBe('R1');
    expect(comp('R1')).toMatchObject({ type: 'resistor', position: { x: 100, y: 50 }, rotation: 0, mirror: false, parameters: { resistance: 10 } });
    expect(ed().selection).toEqual(['R1']);
  });
  it('uses the prefix of each type and the smallest free number', () => {
    ed().addComponent('mosfet', { x: 0, y: 0 }); ed().addComponent('mosfet', { x: 0, y: 0 }); ed().addComponent('dc_voltage_source', { x: 0, y: 0 });
    expect(ids()).toEqual(['M1', 'M2', 'V1']);
    ed().select(['M1']); ed().deleteSelected();
    expect(ed().addComponent('mosfet', { x: 0, y: 0 })).toBe('M1');
  });
  it('gated devices start with an unassigned control signal', () => {
    ed().addComponent('mosfet', { x: 0, y: 0 });
    expect(comp('M1').parameters.gate).toBe('');
  });
  it('refuses planned and unknown parts', () => {
    expect(ed().addComponent('bjt', { x: 0, y: 0 })).toBeNull();
    expect(ed().addComponent('warp_core', { x: 0, y: 0 })).toBeNull();
    expect(ed().components).toHaveLength(0); expect(ed().past).toHaveLength(0);
  });
  it('snap can be disabled', () => {
    ed().toggleSnap(); ed().addComponent('resistor', { x: 103, y: 48 });
    expect(comp('R1').position).toEqual({ x: 103, y: 48 });
  });
  it('nextId helper', () => expect(nextId('R', new Set(['R1', 'R2', 'R4']))).toBe('R3'));
});

describe('selection', () => {
  beforeEach(() => { ed().addComponent('resistor', { x: 0, y: 0 }); ed().addComponent('capacitor', { x: 200, y: 0 }); ed().addComponent('inductor', { x: 400, y: 0 }); ed().select([]); });
  it('toggle, select all, clear', () => {
    ed().toggleSelect('R1'); ed().toggleSelect('C1'); expect(ed().selection.sort()).toEqual(['C1', 'R1']);
    ed().toggleSelect('R1'); expect(ed().selection).toEqual(['C1']);
    ed().selectAll(); expect(ed().selection).toHaveLength(3);
  });
  it('rubber-band selects intersecting parts; additive keeps the old selection', () => {
    ed().selectInRect({ x0: -50, y0: -50, x1: 230, y1: 50 }, false);
    expect(ed().selection.sort()).toEqual(['C1', 'R1']);
    ed().selectInRect({ x0: 380, y0: -10, x1: 420, y1: 10 }, true);
    expect(ed().selection).toHaveLength(3);
    ed().selectInRect({ x0: 1000, y0: 1000, x1: 1100, y1: 1100 }, false); expect(ed().selection).toEqual([]);
  });
});

describe('move / rotate / mirror', () => {
  beforeEach(() => { ed().addComponent('resistor', { x: 0, y: 0 }); ed().addComponent('capacitor', { x: 100, y: 0 }); ed().select(['R1', 'C1']); });
  it('a whole drag is ONE undo step and snaps to the grid', () => {
    const start = ed().beginDrag(), before = ed().past.length;
    for (const d of [3, 8, 14, 27]) ed().dragMove(start, d, d / 2);
    expect(comp('R1').position).toEqual({ x: 30, y: 10 }); expect(comp('C1').position).toEqual({ x: 130, y: 10 });
    expect(ed().past.length).toBe(before + 1);
    ed().undo(); expect(comp('R1').position).toEqual({ x: 0, y: 0 }); expect(comp('C1').position).toEqual({ x: 100, y: 0 });
  });
  it('a click without movement leaves no history entry', () => {
    const start = ed().beginDrag(), n = ed().past.length;
    ed().dragMove(start, 0, 0); ed().dragMove(start, 2, -3);
    expect(ed().past.length).toBe(n);
  });
  it('rotating one part rotates it in place, four times returns to start', () => {
    ed().select(['R1']); for (let i = 0; i < 3; i++) ed().rotateSelected();
    expect(comp('R1')).toMatchObject({ rotation: 270, position: { x: 0, y: 0 } });
    ed().rotateSelected(); expect(comp('R1').rotation).toBe(0);
  });
  it('rotating a group is rigid: pins stay connected relative to each other', () => {
    const sp = useLibrary.getState().specs;
    const gap = () => { const a = pinWorld(comp('R1'), sp.resistor, 'n')!, b = pinWorld(comp('C1'), sp.capacitor, 'p')!; return { dx: b.x - a.x, dy: b.y - a.y }; };
    expect(gap()).toEqual({ dx: 40, dy: 0 });                 // R.n (30,0) -> C.p (70,0)
    ed().rotateSelected();
    expect(gap()).toEqual({ dx: 0, dy: 40 });                 // the whole assembly turned 90° clockwise
    expect(ed().components.every((c) => c.position.x % 10 === 0 && c.position.y % 10 === 0)).toBe(true);
  });
  it('mirroring a group flips positions about its centre and toggles each part', () => {
    ed().mirrorSelected();
    expect(comp('R1')).toMatchObject({ mirror: true, position: { x: 100, y: 0 } }); expect(comp('C1')).toMatchObject({ mirror: true, position: { x: 0, y: 0 } });
    ed().mirrorSelected(); expect(comp('R1')).toMatchObject({ mirror: false, position: { x: 0, y: 0 } });
  });
  it('arrow nudges and is undoable', () => {
    ed().nudgeSelected(10, -20); expect(comp('C1').position).toEqual({ x: 110, y: -20 }); ed().undo(); expect(comp('C1').position).toEqual({ x: 100, y: 0 });
  });
});

describe('delete / duplicate / clipboard', () => {
  beforeEach(() => { ed().addComponent('resistor', { x: 0, y: 0 }); ed().addComponent('capacitor', { x: 100, y: 0 }); });
  it('delete removes parts and any wires attached to them', () => {
    useEditorWires([{ id: 'W1', from: { componentId: 'R1', pin: 'n' }, to: { componentId: 'C1', pin: 'p' }, points: [] }, { id: 'W2', from: null, to: null, points: [] }]);
    ed().select(['R1']); ed().deleteSelected();
    expect(ids()).toEqual(['C1']); expect(ed().wires.map((w) => w.id)).toEqual(['W2']); expect(ed().selection).toEqual([]);
  });
  it('duplicate offsets the copies, gives new ids, keeps parameters, selects the copies', () => {
    ed().setParam('R1', 'resistance', 4700); ed().select(['R1']); ed().duplicateSelected();
    expect(ids()).toEqual(['R1', 'C1', 'R2']); expect(comp('R2').position).toEqual({ x: 20, y: 20 }); expect(comp('R2').parameters.resistance).toBe(4700);
    expect(ed().selection).toEqual(['R2']);
    ed().setParam('R2', 'resistance', 1); expect(comp('R1').parameters.resistance).toBe(4700);     // deep copy, not shared
  });
  it('copy / paste twice cascades the offset; cut removes the originals', () => {
    ed().select(['R1', 'C1']); ed().copySelected(); ed().paste(); ed().paste();
    expect(ids()).toEqual(['R1', 'C1', 'R2', 'C2', 'R3', 'C3']);
    expect(comp('R2').position).toEqual({ x: 20, y: 20 }); expect(comp('R3').position).toEqual({ x: 40, y: 40 });
    ed().select(['R1']); ed().cutSelected(); expect(ids()).not.toContain('R1'); ed().paste(); expect(ids()).toContain('R1');
  });
  it('paste with an empty clipboard is a no-op', () => { const n = ed().past.length; ed().paste(); expect(ed().past.length).toBe(n); });
});

describe('parameters and naming', () => {
  beforeEach(() => { ed().addComponent('resistor', { x: 0, y: 0 }); ed().addComponent('capacitor', { x: 100, y: 0 }); ed().addComponent('mosfet', { x: 200, y: 0 }); });
  it('accepts valid values and rejects out-of-range, non-numeric and unknown keys without changing state', () => {
    expect(ed().setParam('R1', 'resistance', 2200)).toEqual({ ok: true }); expect(comp('R1').parameters.resistance).toBe(2200);
    for (const bad of [-5, 0, NaN, Infinity, '12' as any]) {
      const n = ed().past.length, r = ed().setParam('R1', 'resistance', bad);
      expect(r.ok).toBe(false); expect(comp('R1').parameters.resistance).toBe(2200); expect(ed().past.length).toBe(n);
    }
    expect(ed().setParam('R1', 'gain', 1).ok).toBe(false); expect(ed().setParam('R9', 'resistance', 1).ok).toBe(false);
  });
  it('setting the same value adds no history', () => { const n = ed().past.length; ed().setParam('R1', 'resistance', 10); expect(ed().past.length).toBe(n); });
  it('control-signal fields are editable strings', () => { expect(ed().setParam('M1', 'gate', 'G1').ok).toBe(true); expect(comp('M1').parameters.gate).toBe('G1'); });
  it('rename validates format and uniqueness, and follows wires and selection', () => {
    useEditorWires([{ id: 'W1', from: { componentId: 'R1', pin: 'n' }, to: null, points: [] }]); ed().select(['R1']);
    expect(ed().renameComponent('R1', 'C1').ok).toBe(false); expect(ed().renameComponent('R1', '1R').ok).toBe(false); expect(ed().renameComponent('R1', '').ok).toBe(false);
    expect(ed().renameComponent('R1', 'Rload')).toEqual({ ok: true });
    expect(ids()[0]).toBe('Rload'); expect(ed().wires[0].from!.componentId).toBe('Rload'); expect(ed().selection).toEqual(['Rload']);
    ed().undo(); expect(ids()[0]).toBe('R1'); expect(ed().wires[0].from!.componentId).toBe('R1');
  });
});

describe('undo / redo', () => {
  it('walks back and forth through several edits', () => {
    ed().addComponent('resistor', { x: 0, y: 0 }); ed().addComponent('capacitor', { x: 100, y: 0 }); ed().setParam('R1', 'resistance', 5); ed().select(['C1']); ed().deleteSelected();
    expect(ids()).toEqual(['R1']);
    ed().undo(); expect(ids()).toEqual(['R1', 'C1']);
    ed().undo(); expect(comp('R1').parameters.resistance).toBe(10);
    ed().undo(); ed().undo(); expect(ids()).toEqual([]); ed().undo(); expect(ids()).toEqual([]);   // extra undo is harmless
    ed().redo(); ed().redo(); expect(ids()).toEqual(['R1', 'C1']); expect(comp('R1').parameters.resistance).toBe(10);
    ed().redo(); expect(comp('R1').parameters.resistance).toBe(5); ed().redo(); expect(ids()).toEqual(['R1']); ed().redo(); expect(ids()).toEqual(['R1']);
  });
  it('a new edit after undo discards the redo branch', () => {
    ed().addComponent('resistor', { x: 0, y: 0 }); ed().undo(); expect(ed().future).toHaveLength(1);
    ed().addComponent('capacitor', { x: 0, y: 0 }); expect(ed().future).toHaveLength(0); ed().redo(); expect(ids()).toEqual(['C1']);
  });
  it('drops selected ids that no longer exist after undo', () => {
    ed().addComponent('resistor', { x: 0, y: 0 }); expect(ed().selection).toEqual(['R1']); ed().undo(); expect(ed().selection).toEqual([]);
  });
  it('history is capped', () => {
    ed().addComponent('resistor', { x: 0, y: 0 }); for (let i = 0; i < 260; i++) ed().nudgeSelected(10, 0);
    expect(ed().past.length).toBe(200);
  });
});

describe('save / load', () => {
  it('round-trips a schematic exactly', () => {
    ed().addComponent('dc_voltage_source', { x: 0, y: 0 }); ed().addComponent('mosfet', { x: 100, y: 0 }); ed().setParam('M1', 'gate', 'G1');
    ed().select(['M1']); ed().rotateSelected(); ed().mirrorSelected(); ed().setParam('V1', 'voltage', 48);
    const text = serializeProject(ed().toSchematic()), saved = ed().toSchematic();
    setup(); ed().loadSchematic(parseProject(text));
    expect(ed().toSchematic()).toEqual(saved); expect(ed().past).toHaveLength(0);
  });
  it('loading resets history and selection; new project clears the document but keeps view settings', () => {
    ed().addComponent('resistor', { x: 0, y: 0 }); ed().toggleSnap();
    ed().newProject(); expect(ed().components).toHaveLength(0); expect(ed().past).toHaveLength(0); expect(ed().selection).toEqual([]); expect(ed().snapToGrid).toBe(false);
  });
  it.each([
    ['not json', 'not valid JSON'], [JSON.stringify({ format: 'other' }), 'Not a Power Electronics'],
    [JSON.stringify({ format: 'power-electronics-studio-project', version: 99, schematic: { components: [] } }), 'Unsupported project version'],
    [JSON.stringify({ format: 'power-electronics-studio-project', version: 1, schematic: {} }), 'no'],
    [JSON.stringify({ format: 'power-electronics-studio-project', version: 1, schematic: { components: [{ id: 'R1', type: 'resistor', position: { x: 0, y: 0 }, rotation: 45, parameters: {} }] } }), 'rotation'],
    [JSON.stringify({ format: 'power-electronics-studio-project', version: 1, schematic: { components: [{ id: 'R1', type: 'resistor', position: { x: 0, y: 0 }, rotation: 0 }, { id: 'R1', type: 'resistor', position: { x: 0, y: 0 }, rotation: 0 }] } }), 'Duplicate'],
    [JSON.stringify({ format: 'power-electronics-studio-project', version: 1, schematic: { components: [{ id: 'R1', type: 'resistor', position: { x: 'a', y: 0 }, rotation: 0 }] } }), 'position'],
  ])('rejects a bad file (%#)', (text, msg) => expect(() => parseProject(text)).toThrow(msg));
});

describe('view', () => {
  it('fit centres the circuit in the canvas', () => {
    ed().setCanvasSize(1000, 600); ed().addComponent('resistor', { x: 500, y: 300 }); ed().addComponent('resistor', { x: 900, y: 300 }); ed().fitView();
    const v = ed().viewport, cx = 700 * v.zoom + v.x, cy = 300 * v.zoom + v.y;
    expect(cx).toBeCloseTo(500); expect(cy).toBeCloseTo(300);
  });
});

function useEditorWires(wires: import('../types').Wire[]) {
  // wires have no UI until Batch 3; tests inject them to verify the store keeps them consistent
  useEditor.setState({ wires });
}
