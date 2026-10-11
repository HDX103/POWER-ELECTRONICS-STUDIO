import fixture from './library.fixture.json';
import { useLibrary } from '../library';
import { resetEditor, useEditor } from '../store';
import type { LibraryPayload } from '../types';

/** Library fixture = a dump of the real backend metadata (a backend test keeps it in sync). */
export function setup() {
  useLibrary.getState().setLibrary(fixture as unknown as LibraryPayload);
  resetEditor();
}
export const ed = () => useEditor.getState();
export const ids = () => ed().components.map((c) => c.id);
export const comp = (id: string) => ed().components.find((c) => c.id === id)!;
