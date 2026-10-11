import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { DND_TYPE } from './Canvas';
import { searchSpecs, useLibrary } from './library';
import { useEditor } from './store';
import { SymbolIcon } from './symbols';
import type { ComponentSpec } from './types';

export function Library() {
  const { specs, order, categories, status, error, load } = useLibrary();
  const [q, setQ] = useState('');
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  useEffect(() => { if (status === 'idle') load(); }, [status, load]);

  const hits = useMemo(() => searchSpecs(order.map((t) => specs[t]), q), [specs, order, q]);
  const searching = q.trim().length > 0;

  const place = (s: ComponentSpec) => {          // double-click: drop at the centre of the current view
    const { viewport: v, canvasSize: c } = useEditor.getState();
    useEditor.getState().addComponent(s.type, { x: (c.w / 2 - v.x) / v.zoom, y: (c.h / 2 - v.y) / v.zoom });
  };

  return (
    <div className="h-full flex flex-col text-xs">
      <div className="p-2 border-b border-slate-800">
        <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded px-2 py-1">
          <Search size={13} className="text-slate-500" />
          <input aria-label="Search components" placeholder="Search components…" value={q} onChange={(e) => setQ(e.target.value)}
            className="bg-transparent outline-none flex-1 min-w-0 placeholder:text-slate-500" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto" data-testid="library-list">
        {status === 'loading' && <div className="p-3 text-slate-500">Loading component library…</div>}
        {status === 'error' && <div className="p-3 text-red-400">Cannot load library: {error}<button className="block mt-2 underline" onClick={load}>Retry</button></div>}
        {status === 'ready' && !hits.length && <div className="p-3 text-slate-500">No component matches “{q}”.</div>}
        {categories.map((cat) => {
          const items = hits.filter((s) => s.category === cat.id);
          if (!items.length) return null;
          const open = searching || !closed[cat.id];
          return (
            <section key={cat.id}>
              <button className="w-full flex items-center gap-1 px-2 py-1 bg-slate-900 text-slate-400 uppercase tracking-wider text-[10px] hover:text-slate-200"
                onClick={() => setClosed({ ...closed, [cat.id]: open })}>
                {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}{cat.label}<span className="ml-auto text-slate-600">{items.length}</span>
              </button>
              {open && items.map((s) => {
                const planned = s.status === 'planned';
                return (
                  <div key={s.type} data-testid={`lib-${s.type}`} draggable={!planned} aria-disabled={planned}
                    title={planned ? `${s.label} — planned, no simulation model yet` : `${s.description}\nDrag onto the canvas, or double-click to place.`}
                    onDragStart={(e) => { e.dataTransfer.setData(DND_TYPE, s.type); e.dataTransfer.effectAllowed = 'copy'; }}
                    onDoubleClick={() => !planned && place(s)}
                    className={`flex items-center gap-2 px-3 py-1 border-b border-slate-800/60 ${planned ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 hover:bg-slate-800 cursor-grab'}`}>
                    <span className="w-9 shrink-0"><SymbolIcon spec={s} /></span>
                    <span className="truncate">{s.label}</span>
                    {planned && <span className="ml-auto text-[9px] uppercase text-slate-600">planned</span>}
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}
