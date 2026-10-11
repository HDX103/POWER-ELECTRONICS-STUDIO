import { useState } from 'react';
import { Zap } from 'lucide-react';
import ClassicApp from './ClassicApp';
import { EditorApp } from './editor/EditorApp';
import { TopologyApp } from './simulator/TopologyApp';

type Mode = 'simulator' | 'editor' | 'classic';

/** Shell: the new free-form editor, plus the original topology simulator kept intact as "Classic". */
export default function App() {
  const [mode, setMode] = useState<Mode>('simulator');

  const navItems: Array<{ id: Mode; label: string; badge?: string }> = [
    { id: 'simulator', label: 'Simulator (Full Studio)', badge: '100% Client-Side' },
    { id: 'editor', label: 'Schematic Editor', badge: 'Free-form' },
    { id: 'classic', label: 'Classic Topologies', badge: 'Legacy' },
  ];

  return (
    <div className="h-screen flex flex-col bg-slate-950 font-sans">
      {/* Top Navigation Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 shadow-md select-none z-50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <Zap size={18} />
            </div>
            <div>
              <h1 className="font-bold text-slate-100 text-sm tracking-tight leading-tight">
                Power Electronics Studio
              </h1>
              <span className="text-[10px] text-slate-400">Interactive Simulation & Circuit Design</span>
            </div>
          </div>
        </div>

        {/* Prominent Tab Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
          {navItems.map((item) => {
            const active = mode === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setMode(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  active
                    ? 'bg-sky-600 text-white shadow-sm shadow-sky-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-mono uppercase ${
                      active
                        ? 'bg-sky-950 text-sky-200 border border-sky-400/40'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {mode === 'simulator' && <TopologyApp />}
        {mode === 'editor' && <EditorApp />}
        {mode === 'classic' && <ClassicApp />}
      </div>
    </div>
  );
}
