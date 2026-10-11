/** Strongly typed schematic model. Nothing here knows about any topology: a circuit is just
 *  components + wires. Electrical connectivity (pin -> net) is *derived* by the NetlistCompiler
 *  (Batch 3) and is never stored on the component, so it can never drift out of sync with the wires. */

export interface Point { x: number; y: number }
export type Rotation = 0 | 90 | 180 | 270;
export type ParamValue = number | string | boolean;

export interface SchematicComponent {
  id: string;                      // reference designator, unique ("R1", "M2")
  type: string;                    // key into the component library
  position: Point;                 // centre of the symbol, world units
  rotation: Rotation;              // clockwise degrees
  mirror: boolean;                 // horizontal flip, applied before rotation
  parameters: Record<string, ParamValue>;
}

export interface PinRef { componentId: string; pin: string }
export interface Wire {
  id: string;
  from: PinRef | null;             // null = free end (junction / dangling)
  to: PinRef | null;
  points: Point[];                 // intermediate vertices
  netId?: string;                  // filled in by net extraction
}

export interface Schematic { components: SchematicComponent[]; wires: Wire[] }

// ------------------------------------------------------------------ component library (mirrors GET /api/components)
export interface LibParam {
  key: string; label: string; kind: 'number' | 'string' | 'select'; unit: string;
  default: number | string | boolean; min?: number | null; max?: number | null;
  group: string; log?: boolean; doc?: string; options?: string[];
}
export interface LibSignal { key: string; label: string; doc?: string }
export type ComponentStatus = 'implemented' | 'planned' | 'schematic';
export interface ComponentSpec {
  type: string; label: string; category: string; pins: string[]; params: LibParam[]; signals: LibSignal[];
  prefix: string; symbol: string; solver: string | null; status: ComponentStatus; description: string; aliases: string[];
}
export interface LibraryPayload { version: number; categories: { id: string; label: string }[]; components: ComponentSpec[] }
