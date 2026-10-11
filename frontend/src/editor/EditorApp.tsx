import { useRef, useState } from 'react';
import { Canvas } from './Canvas';
import { Library } from './LibraryPanel';
import { MenuBar } from './MenuBar';
import type { Menu } from './MenuBar';
import { ParameterPanel } from './ParameterPanel';
import { parseProject, serializeProject } from './project';
import { useEditor } from './store';

export function download(name: string, text: string, mime = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

export function EditorApp() {
  const st = useEditor();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');

  const newProject = () => { if (!st.components.length || window.confirm('Discard the current schematic?')) st.newProject(); };
  const open = async (f?: File) => {
    if (!f) return;
    try { st.loadSchematic(parseProject(await f.text())); setMsg(''); }
    catch (e: any) { setMsg(`Cannot open ${f.name}: ${e.message}`); }
  };
  const save = () => download('circuit.pes.json', serializeProject(st.toSchematic()));

  const none = !st.selection.length;
  const menus: Menu[] = [
    { label: 'File', items: [
      { label: 'New', onClick: newProject },
      { label: 'Open…', onClick: () => fileRef.current?.click() },
      { label: 'Save', shortcut: '', onClick: save, disabled: !st.components.length },
    ] },
    { label: 'Edit', items: [
      { label: 'Undo', shortcut: 'Ctrl+Z', onClick: st.undo, disabled: !st.past.length },
      { label: 'Redo', shortcut: 'Ctrl+Shift+Z', onClick: st.redo, disabled: !st.future.length },
      { label: '', divider: true },
      { label: 'Cut', shortcut: 'Ctrl+X', onClick: st.cutSelected, disabled: none },
      { label: 'Copy', shortcut: 'Ctrl+C', onClick: st.copySelected, disabled: none },
      { label: 'Paste', shortcut: 'Ctrl+V', onClick: st.paste, disabled: !st.clipboard },
      { label: 'Duplicate', shortcut: 'Ctrl+D', onClick: st.duplicateSelected, disabled: none },
      { label: 'Delete', shortcut: 'Del', onClick: st.deleteSelected, disabled: none },
      { label: '', divider: true },
      { label: 'Rotate', shortcut: 'R', onClick: st.rotateSelected, disabled: none },
      { label: 'Mirror', shortcut: 'M', onClick: st.mirrorSelected, disabled: none },
      { label: 'Select all', shortcut: 'Ctrl+A', onClick: st.selectAll },
    ] },
    { label: 'View', items: [
      { label: 'Zoom in', onClick: () => st.zoomBy(1.25) },
      { label: 'Zoom out', onClick: () => st.zoomBy(0.8) },
      { label: 'Fit to screen', shortcut: 'Home', onClick: st.fitView },
      { label: '', divider: true },
      { label: 'Show grid', checked: st.showGrid, onClick: st.toggleGrid },
      { label: 'Snap to grid', checked: st.snapToGrid, onClick: st.toggleSnap },
    ] },
  ];

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-200 text-sm overflow-hidden">
      <MenuBar menus={menus} />
      {msg && <div className="px-3 py-1 bg-red-950 text-red-300 text-xs border-b border-red-900">{msg}</div>}
      <div className="flex-1 min-h-0 grid grid-cols-[240px_minmax(0,1fr)_260px]">
        <aside className="border-r border-slate-800 bg-slate-900 min-h-0"><Library /></aside>
        <main className="min-h-0 min-w-0"><Canvas /></main>
        <aside className="border-l border-slate-800 bg-slate-900 min-h-0 overflow-y-auto"><ParameterPanel /></aside>
      </div>
      <input ref={fileRef} type="file" accept=".json" hidden onChange={(e) => { open(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
}
