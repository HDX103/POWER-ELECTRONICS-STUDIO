import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { Canvas, DND_TYPE } from '../Canvas';
import { EditorApp } from '../EditorApp';
import { Library } from '../LibraryPanel';
import { ParameterPanel } from '../ParameterPanel';
import { comp, ed, ids, setup } from './helpers';

beforeEach(setup);

/** jsdom has no DragEvent, so build the drop event by hand (coordinates + dataTransfer). */
const drop = (el: Element, type: string, x: number, y: number) =>
  fireEvent(el, Object.assign(new Event('drop', { bubbles: true, cancelable: true }),
    { clientX: x, clientY: y, dataTransfer: { getData: (t: string) => (t === DND_TYPE ? type : ''), types: [DND_TYPE] } }));
/** Direct store mutations outside an event handler must be wrapped so React flushes them. */
const act2 = (f: () => void) => act(() => { f(); });
const canvas = () => screen.getByTestId('canvas');
const key = (k: string, o: object = {}) => fireEvent.keyDown(screen.getByTestId('canvas-root'), { key: k, ...o });

describe('library', () => {
  it('lists every category and marks planned parts as disabled and non-draggable', () => {
    render(<Library />);
    for (const c of ['Passive Components', 'Sources', 'Semiconductor Devices', 'Magnetic Components', 'Control Components', 'Measurement', 'Utility']) expect(screen.getByText(c)).toBeInTheDocument();
    expect(screen.getByTestId('lib-resistor')).toHaveAttribute('draggable', 'true');
    expect(screen.getByTestId('lib-bjt')).toHaveAttribute('draggable', 'false');
    expect(screen.getByTestId('lib-bjt')).toHaveAttribute('aria-disabled', 'true');
  });
  it('search filters by label, alias and type, across categories', () => {
    render(<Library />);
    const box = screen.getByLabelText('Search components');
    fireEvent.change(box, { target: { value: 'mosfet' } });
    expect(screen.getByTestId('lib-mosfet')).toBeInTheDocument(); expect(screen.getByTestId('lib-sic_mosfet')).toBeInTheDocument(); expect(screen.queryByTestId('lib-resistor')).toBeNull();
    fireEvent.change(box, { target: { value: 'battery' } });                 // alias of the DC source
    expect(screen.getByTestId('lib-dc_voltage_source')).toBeInTheDocument(); expect(screen.queryByTestId('lib-mosfet')).toBeNull();
    fireEvent.change(box, { target: { value: 'zzzz' } }); expect(screen.getByText(/No component matches/)).toBeInTheDocument();
  });
  it('double-click places a part; double-click on a planned part does nothing', () => {
    render(<Library />);
    fireEvent.doubleClick(screen.getByTestId('lib-capacitor')); expect(ids()).toEqual(['C1']);
    fireEvent.doubleClick(screen.getByTestId('lib-bjt')); expect(ids()).toEqual(['C1']);
  });
  it('categories collapse', () => {
    render(<Library />);
    fireEvent.click(screen.getByText('Passive Components')); expect(screen.queryByTestId('lib-resistor')).toBeNull();
    fireEvent.click(screen.getByText('Passive Components')); expect(screen.getByTestId('lib-resistor')).toBeInTheDocument();
  });
});

describe('canvas placement and selection', () => {
  it('dropping a library part places it at the (snapped) drop position', () => {
    render(<Canvas />); drop(canvas(), 'inductor', 203, 98);
    expect(comp('L1').position).toEqual({ x: 200, y: 100 }); expect(screen.getByTestId('comp-L1')).toBeInTheDocument();
  });
  it('drop honours pan and zoom', () => {
    render(<Canvas />); act2(() => ed().setViewport({ x: 100, y: 50, zoom: 2 })); drop(canvas(), 'resistor', 300, 250);
    expect(comp('R1').position).toEqual({ x: 100, y: 100 });
  });
  it('ignores drops that are not library parts and planned parts', () => {
    render(<Canvas />); drop(canvas(), '', 10, 10); drop(canvas(), 'bjt', 10, 10); expect(ids()).toEqual([]);
  });
  it('click selects, shift-click toggles, click on empty space clears', () => {
    render(<Canvas />); drop(canvas(), 'resistor', 100, 100); drop(canvas(), 'capacitor', 300, 100); act2(() => ed().select([]));
    fireEvent.mouseDown(screen.getByTestId('comp-R1').firstChild as Element, { button: 0, clientX: 100, clientY: 100 }); fireEvent.mouseUp(window);
    expect(ed().selection).toEqual(['R1']);
    fireEvent.mouseDown(canvas(), { button: 0, shiftKey: true, clientX: 300, clientY: 100 }); fireEvent.mouseUp(window);
    expect(ed().selection.sort()).toEqual(['C1', 'R1']);
    fireEvent.mouseDown(canvas(), { button: 0, clientX: 600, clientY: 400 }); fireEvent.mouseUp(window, { clientX: 600, clientY: 400 });
    expect(ed().selection).toEqual([]);
  });
  it('drag-select with a rubber band', () => {
    render(<Canvas />); drop(canvas(), 'resistor', 100, 100); drop(canvas(), 'capacitor', 300, 100); drop(canvas(), 'inductor', 500, 300); act2(() => ed().select([]));
    fireEvent.mouseDown(canvas(), { button: 0, clientX: 40, clientY: 40 });
    fireEvent.mouseMove(window, { clientX: 340, clientY: 160 }); fireEvent.mouseUp(window, { clientX: 340, clientY: 160 });
    expect(ed().selection.sort()).toEqual(['C1', 'R1']);
  });
  it('dragging a part moves it on the grid with one undo step', () => {
    render(<Canvas />); drop(canvas(), 'resistor', 100, 100); const n = ed().past.length;
    fireEvent.mouseDown(screen.getByTestId('comp-R1').firstChild as Element, { button: 0, clientX: 100, clientY: 100 });
    for (const d of [5, 17, 33, 48]) fireEvent.mouseMove(window, { clientX: 100 + d, clientY: 100 + d / 2 });
    fireEvent.mouseUp(window);
    expect(comp('R1').position).toEqual({ x: 150, y: 120 }); expect(ed().past.length).toBe(n + 1);
    key('z', { ctrlKey: true }); expect(comp('R1').position).toEqual({ x: 100, y: 100 });
  });
  it('middle-button drag pans the view', () => {
    render(<Canvas />);
    fireEvent.mouseDown(canvas(), { button: 1, clientX: 100, clientY: 100 }); fireEvent.mouseMove(window, { clientX: 160, clientY: 130 }); fireEvent.mouseUp(window);
    expect(ed().viewport).toMatchObject({ x: 60, y: 30, zoom: 1 });
  });
  it('mouse wheel zooms around the cursor', () => {
    render(<Canvas />); const before = ed().viewport;
    fireEvent.wheel(canvas(), { deltaY: -200, clientX: 0, clientY: 0 });
    expect(ed().viewport.zoom).toBeGreaterThan(before.zoom);
  });
});

describe('canvas keyboard', () => {
  beforeEach(() => { render(<Canvas />); drop(canvas(), 'resistor', 100, 100); });
  it('R rotates, M mirrors, Delete removes, Ctrl+Z / Ctrl+Shift+Z undo and redo', () => {
    key('r'); expect(comp('R1').rotation).toBe(90);
    key('m'); expect(comp('R1').mirror).toBe(true);
    key('Delete'); expect(ids()).toEqual([]);
    key('z', { ctrlKey: true }); expect(ids()).toEqual(['R1']);
    key('z', { ctrlKey: true, shiftKey: true }); expect(ids()).toEqual([]);
    key('y', { ctrlKey: true }); expect(ids()).toEqual([]);
  });
  it('Ctrl+C / Ctrl+V / Ctrl+D / Ctrl+A / arrows / Escape', () => {
    key('c', { ctrlKey: true }); key('v', { ctrlKey: true }); expect(ids()).toEqual(['R1', 'R2']);
    key('d', { ctrlKey: true }); expect(ids()).toHaveLength(3);
    key('a', { ctrlKey: true }); expect(ed().selection).toHaveLength(3);
    key('ArrowRight'); expect(comp('R1').position.x).toBe(110);
    key('Escape'); expect(ed().selection).toEqual([]);
  });
  it('toolbar buttons mirror the shortcuts and disable when there is nothing to act on', () => {
    expect(screen.getByLabelText('Redo')).toBeDisabled(); fireEvent.click(screen.getByLabelText('Rotate')); expect(comp('R1').rotation).toBe(90);
    fireEvent.click(screen.getByLabelText('Undo')); expect(comp('R1').rotation).toBe(0);
    fireEvent.click(screen.getByLabelText('Redo')); expect(comp('R1').rotation).toBe(90);
    act2(() => ed().select([])); expect(screen.getByLabelText('Rotate')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Toggle snap')); expect(ed().snapToGrid).toBe(false);
  });
  it('double-click on a part selects it and asks the parameter panel to focus', () => {
    act2(() => ed().select([])); const t = ed().focusParamsToken;
    fireEvent.doubleClick(screen.getByTestId('comp-R1').firstChild as Element, { clientX: 100, clientY: 100 });
    expect(ed().selection).toEqual(['R1']); expect(ed().focusParamsToken).toBe(t + 1);
  });
});

describe('parameter panel', () => {
  const add = (t: string) => { ed().addComponent(t, { x: 0, y: 0 }); };
  it('is generated from metadata: capacitor shows its parameters, grouped, with SI formatting', () => {
    add('capacitor'); render(<ParameterPanel />);
    expect(screen.getByLabelText('Capacitance')).toHaveValue('100 µF'); expect(screen.getByLabelText('Initial voltage')).toHaveValue('0 V');
    expect(screen.getByText('initial')).toBeInTheDocument();
  });
  it('gated devices show Ron/Roff and a gate-signal field', () => {
    add('mosfet'); render(<ParameterPanel />);
    expect(screen.getByLabelText('On-resistance')).toHaveValue('10 mΩ'); expect(screen.getByLabelText('Off-resistance')).toHaveValue('10 MΩ');
    fireEvent.change(screen.getByLabelText('Gate signal'), { target: { value: 'G1' } }); expect(comp('M1').parameters.gate).toBe('G1');
  });
  it('commits engineering notation on Enter and on blur', () => {
    add('resistor'); render(<ParameterPanel />); const f = screen.getByLabelText('Resistance');
    fireEvent.change(f, { target: { value: '4.7k' } }); fireEvent.keyDown(f, { key: 'Enter' });
    expect(comp('R1').parameters.resistance).toBe(4700); expect(f).toHaveValue('4.7 kΩ');
    fireEvent.change(f, { target: { value: '220' } }); fireEvent.blur(f); expect(comp('R1').parameters.resistance).toBe(220);
  });
  it('shows an error for garbage or out-of-range input and leaves the model untouched; Escape reverts', () => {
    add('resistor'); render(<ParameterPanel />); const f = screen.getByLabelText('Resistance');
    fireEvent.change(f, { target: { value: 'abc' } }); fireEvent.keyDown(f, { key: 'Enter' });
    expect(screen.getByRole('alert')).toBeInTheDocument(); expect(comp('R1').parameters.resistance).toBe(10);
    fireEvent.change(f, { target: { value: '-5' } }); fireEvent.keyDown(f, { key: 'Enter' });
    expect(screen.getByRole('alert')).toHaveTextContent(/≥/); expect(comp('R1').parameters.resistance).toBe(10);
    fireEvent.keyDown(f, { key: 'Escape' }); expect(f).toHaveValue('10 Ω'); expect(screen.queryByRole('alert')).toBeNull();
  });
  it('a parameter edit is undoable and the panel follows the undo', () => {
    add('resistor'); render(<ParameterPanel />); const f = screen.getByLabelText('Resistance');
    fireEvent.change(f, { target: { value: '1k' } }); fireEvent.keyDown(f, { key: 'Enter' }); expect(f).toHaveValue('1 kΩ');
    fireEvent.click(screen.getByText('Rotate')); act2(() => { ed().undo(); ed().undo(); });
    expect(screen.getByLabelText('Resistance')).toHaveValue('10 Ω');
  });
  it('renames the reference, rejecting duplicates', () => {
    add('resistor'); add('resistor'); ed().select(['R2']); render(<ParameterPanel />); const f = screen.getByLabelText('Reference');
    fireEvent.change(f, { target: { value: 'R1' } }); fireEvent.keyDown(f, { key: 'Enter' });
    expect(screen.getByRole('alert')).toHaveTextContent(/already used/); expect(ids()).toEqual(['R1', 'R2']);
    fireEvent.change(screen.getByLabelText('Reference'), { target: { value: 'Rload' } }); fireEvent.keyDown(screen.getByLabelText('Reference'), { key: 'Enter' });
    expect(ids()).toEqual(['R1', 'Rload']); expect(screen.getByLabelText('Reference')).toHaveValue('Rload');
  });
  it('shows an empty state, and a count for multi-selection', () => {
    render(<ParameterPanel />); expect(screen.getByText(/Nothing selected/)).toBeInTheDocument();
    act2(() => { add('resistor'); add('capacitor'); ed().selectAll(); }); expect(screen.getByText('2 components selected')).toBeInTheDocument();
  });
  it('double-click focus request moves focus into the first parameter field', () => {
    add('inductor'); render(<ParameterPanel />); act2(() => ed().requestParamFocus());
    expect(within(screen.getByTestId('param-panel')).getByLabelText('Inductance')).toHaveFocus();
  });
});

describe('editor shell', () => {
  it('renders library, canvas and parameter panel and a File/Edit/View menu', () => {
    render(<EditorApp />);
    expect(screen.getByTestId('library-list')).toBeInTheDocument(); expect(screen.getByTestId('canvas')).toBeInTheDocument();
    for (const m of ['File', 'Edit', 'View']) expect(screen.getByRole('menuitem', { name: m })).toBeInTheDocument();
  });
  it('Edit menu drives the same actions and disables unavailable ones', () => {
    render(<EditorApp />); drop(canvas(), 'resistor', 100, 100);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(screen.getByRole('menuitem', { name: /^Paste/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('menuitem', { name: /^Rotate/ })); expect(comp('R1').rotation).toBe(90);
  });
});
