export const API = (import.meta.env.VITE_API_URL as string) ?? '';


export interface ParamSpec {
  key: string; label: string; unit: string; default: number | string; min: number; max: number; step: number;
  type?: 'select'; options?: { value: string; label: string }[];
}
export interface SweepSpec { key: string; label: string; start: number; stop: number; points: number; y?: string; ylabel?: string }
export interface TopologySpec {
  id: string; name: string; kind: 'ac' | 'dc' | 'inv'; defaults: Params;
  flags: { key: string; label: string }[]; sweep: SweepSpec | null; params: ParamSpec[]; gated: boolean;
}
export type Params = Record<string, number | boolean | string>;

export interface Harmonics {
  order: number[]; peak: number[]; rms: number[]; phase_deg: number[];
  percent_of_fundamental: number[] | null; dc: number; fundamental_peak: number; thd_percent: number | null;
}
export interface Issue { level: 'error' | 'warning'; code: string; message: string }
export interface Channel { key: string; label: string; g: number; c: string; step?: boolean }
export interface SimResult {
  success: boolean; error?: string; issues: Issue[]; log: string[]; netlist: any;
  topology: string; name: string; kind: 'ac' | 'dc' | 'inv';
  time: number[]; time_unit: string; signals: Record<string, number[]>; channels: Channel[]; group_titles: string[]; readout: string[];
  period: number; samples_per_cycle: number;
  measurements: Record<string, number | null>; theory: Record<string, any>;
  table: { label: string; unit: string; sim: number | null; theory: number | null }[];
  other: { label: string; value: number | null; unit: string; dec: number }[];
  fft: Record<string, Harmonics>; conduction_deg: Record<string, [number, number][]>; devices: string[];
  sim: { dt: number; t_stop: number; cycles: number; steps: number };
}
export interface SweepPoint { x: number; y_sim: number | null; y_theory: number | null; Vo_avg_sim: number | null; Vo_avg_theory: number | null; Io_avg_sim: number | null }

async function req<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const r = await fetch(`${API}${path}`, body === undefined ? { signal } : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  if (!r.ok) {
    const ct = r.headers.get('content-type') ?? '';
    if (ct.includes('text/html')) {
      throw new Error('Simulation backend not reachable. Deploy FastAPI server separately or set VITE_API_URL.');
    }
    throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
  }
  return r.json();

}

export const getTopologies = () => req<TopologySpec[]>('/api/topologies');
export const simulate = (tid: string, p: Params, signal?: AbortSignal) => req<SimResult>(`/api/simulate/${tid}`, p, signal);
export const sweep = (tid: string, p: Params) =>
  req<{ success: boolean; error?: string; points: SweepPoint[]; sweep: SweepSpec }>(`/api/sweep/${tid}`, { params: p });

export const getComponents = () => req<import('./editor/types').LibraryPayload>('/api/components');
