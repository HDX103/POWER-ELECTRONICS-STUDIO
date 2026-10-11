import { useState } from 'react';
import { Zap } from 'lucide-react';
import ClassicApp from './ClassicApp';
import { EditorApp } from './editor/EditorApp';
import { TopologyApp } from './simulator/TopologyApp';

type Mode = 'simulator' | 'editor' | 'classic';

/** Shell: the new free-form editor, plus the original topology simulator kept intact as "Classic". */
export default function App() {
  const [mode, setMode] = useState<Mode>('simulator');
  const tab = (m: Mode, label: string) => (
    <button onClick={() => setMode(m)} className={`px-3 py-1 text-xs rounded-t ${mode === m ? 'bg-slate-800 text-sky-300' : 'text-slate-400 hover:text-slate-200'}`}>{label}</button>);
  return (
    <div className="h-screen flex flex-col bg-slate-950">
      <div className="flex items-end gap-1 px-3 pt-1 bg-slate-950 border-b border-slate-800">
        <Zap size={16} className="text-sky-400 mb-1.5" /><span className="font-semibold text-slate-200 text-xs tracking-wide mb-1.5 mr-3">Power Electronics Studio</span>
        {tab('simulator', 'Simulator (New)')}{tab('editor', 'Schematic Editor')}{tab('classic', 'Classic Topologies')}
      </div>
      <div className="flex-1 min-h-0">
        {mode === 'simulator' && <TopologyApp />}
        {mode === 'editor' && <EditorApp />}
        {mode === 'classic' && <ClassicApp />}
      </div>
    </div>
  );
}
