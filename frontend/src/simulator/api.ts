import { API } from '../api'; // Use existing API url

export interface TopologyDefinition {
  id: string;
  name: string;
  family: string;
  device_slots?: string[];
}

export async function getFamilies(): Promise<string[]> {
  const r = await fetch(`${API}/api/v2/families`);
  if (!r.ok) return ['AC-AC', 'AC-DC', 'DC-DC', 'DC-AC'];
  return r.json();
}

export async function getTopologies(family: string): Promise<TopologyDefinition[]> {
  const r = await fetch(`${API}/api/v2/topologies?family=${family}`);
  if (!r.ok) return []; 
  return r.json();
}

export async function simulateTopology(params: any): Promise<any> {
  const r = await fetch(`${API}/api/v2/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!r.ok) throw new Error("Simulation failed");
  return r.json();
}
