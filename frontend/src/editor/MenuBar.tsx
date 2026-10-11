import { useEffect, useRef, useState } from 'react';

export interface MenuItem { label: string; shortcut?: string; onClick?: () => void; disabled?: boolean; checked?: boolean; divider?: boolean }
export interface Menu { label: string; items: MenuItem[] }

export function MenuBar({ menus }: { menus: Menu[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open === null) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    window.addEventListener('mousedown', away); window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('mousedown', away); window.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div ref={root} className="flex text-xs bg-slate-900 border-b border-slate-800" role="menubar">
      {menus.map((m, i) => (
        <div key={m.label} className="relative">
          <button role="menuitem" aria-haspopup="true" aria-expanded={open === i}
            className={`px-3 py-1.5 ${open === i ? 'bg-slate-700 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
            onClick={() => setOpen(open === i ? null : i)} onMouseEnter={() => open !== null && setOpen(i)}>{m.label}</button>
          {open === i && (
            <div role="menu" className="absolute left-0 top-full z-50 min-w-[220px] bg-slate-900 border border-slate-700 rounded-b shadow-xl py-1">
              {m.items.map((it, k) => it.divider
                ? <div key={k} className="my-1 border-t border-slate-800" />
                : (<button key={k} role="menuitem" disabled={it.disabled}
                    className="w-full flex items-center px-3 py-1 text-left text-slate-200 hover:bg-sky-700 disabled:text-slate-600 disabled:hover:bg-transparent"
                    onClick={() => { setOpen(null); it.onClick?.(); }}>
                    <span className="w-4">{it.checked ? '✓' : ''}</span><span>{it.label}</span><span className="ml-auto pl-6 text-slate-500">{it.shortcut}</span>
                  </button>))}
            </div>)}
        </div>))}
    </div>
  );
}
