import type { ParamValue, Rotation, Schematic, SchematicComponent, Wire } from './types';

export const PROJECT_FORMAT = 'power-electronics-studio-project';
export const PROJECT_VERSION = 1;

export interface ProjectFile { format: typeof PROJECT_FORMAT; version: number; schematic: Schematic }

export function serializeProject(s: Schematic): string {
  const f: ProjectFile = { format: PROJECT_FORMAT, version: PROJECT_VERSION, schematic: { components: s.components, wires: s.wires } };
  return JSON.stringify(f, null, 2);
}

const ROT = new Set([0, 90, 180, 270]);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Strict parser: throws Error with a human-readable message on any structural problem. */
export function parseProject(text: string): Schematic {
  let j: any;
  try { j = JSON.parse(text); } catch { throw new Error('File is not valid JSON.'); }
  if (!j || j.format !== PROJECT_FORMAT) throw new Error('Not a Power Electronics Studio project file.');
  if (!isNum(j.version) || j.version > PROJECT_VERSION) throw new Error(`Unsupported project version ${j.version}.`);
  const sch = j.schematic;
  if (!sch || !Array.isArray(sch.components)) throw new Error("Project has no 'schematic.components' list.");
  const ids = new Set<string>();
  const components: SchematicComponent[] = sch.components.map((c: any, i: number) => {
    if (!c || typeof c.id !== 'string' || !c.id || typeof c.type !== 'string') throw new Error(`Component #${i + 1}: missing id or type.`);
    if (ids.has(c.id)) throw new Error(`Duplicate component id '${c.id}'.`);
    ids.add(c.id);
    if (!c.position || !isNum(c.position.x) || !isNum(c.position.y)) throw new Error(`${c.id}: invalid position.`);
    if (!ROT.has(c.rotation)) throw new Error(`${c.id}: rotation must be 0, 90, 180 or 270.`);
    const parameters: Record<string, ParamValue> = {};
    for (const [k, v] of Object.entries(c.parameters ?? {})) {
      if (typeof v !== 'number' && typeof v !== 'string' && typeof v !== 'boolean') throw new Error(`${c.id}: parameter '${k}' has an invalid value.`);
      parameters[k] = v;
    }
    return { id: c.id, type: c.type, position: { x: c.position.x, y: c.position.y }, rotation: c.rotation as Rotation, mirror: !!c.mirror, parameters };
  });
  const wires: Wire[] = Array.isArray(sch.wires) ? sch.wires : [];
  return { components, wires };
}
