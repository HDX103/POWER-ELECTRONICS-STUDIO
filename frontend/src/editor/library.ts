import { create } from 'zustand';
import { getComponents } from '../api';
import type { ComponentSpec, LibraryPayload } from './types';

interface LibraryState {
  specs: Record<string, ComponentSpec>;
  order: string[];
  categories: { id: string; label: string }[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string;
  setLibrary: (p: LibraryPayload) => void;
  load: () => Promise<void>;
}

export const useLibrary = create<LibraryState>((set, get) => ({
  specs: {}, order: [], categories: [], status: 'idle', error: '',
  setLibrary: (p) => set({
    specs: Object.fromEntries(p.components.map((c) => [c.type, c])),
    order: p.components.map((c) => c.type), categories: p.categories, status: 'ready', error: '',
  }),
  load: async () => {
    if (get().status === 'loading') return;
    set({ status: 'loading', error: '' });
    try {
      get().setLibrary(await getComponents());
    } catch (e: any) {
      // Fallback: load bundled library JSON
      try {
        const lib = await import('./library.json');
        // lib default export contains LibraryPayload
        get().setLibrary(lib.default as any);
      } catch (fallbackErr) {
        set({ status: 'error', error: String(e?.message ?? e) + ' | fallback failed: ' + String(fallbackErr) });
      }
    }
  },
}));

export const specOf = (type: string): ComponentSpec | undefined => useLibrary.getState().specs[type];

/** All whitespace-separated tokens must appear in label / type / aliases / description. */
export function searchSpecs(specs: ComponentSpec[], query: string): ComponentSpec[] {
  const toks = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!toks.length) return specs;
  return specs.filter((s) => {
    const hay = [s.label, s.type.replace(/_/g, ' '), s.description, ...s.aliases].join(' ').toLowerCase();
    return toks.every((t) => hay.includes(t));
  });
}
