/** Engineering-notation parsing/formatting for parameter fields ("4.7k", "100uF", "10 mΩ"). */

const PREFIX: Record<string, number> = {
  f: 1e-15, p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, 'μ': 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9, T: 1e12,
};
const UNIT_ALIASES: Record<string, string[]> = { 'Ω': ['ω', 'ohm', 'ohms'], Hz: ['hz'], '°': ['deg'] };

function isUnit(s: string, unit: string): boolean {
  if (!unit || !s) return false;
  const l = s.toLowerCase();
  return l === unit.toLowerCase() || (UNIT_ALIASES[unit] ?? []).includes(l);
}

/** Parse "4.7k", "100u", "100uF", "2.2e-6", "1meg", "50 Hz". Returns NaN when it is not a number. */
export function parseSI(text: string, unit = ''): number {
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*(.*)$/.exec(text.trim());
  if (!m) return NaN;
  const base = Number(m[1]);
  let s = m[2].trim();
  let mult = 1;
  if (/^meg/i.test(s)) { mult = 1e6; s = s.slice(3).trim(); }
  else if (s && PREFIX[s[0]] !== undefined) {
    const after = s.slice(1).trim();
    if (after === '' || isUnit(after, unit)) { mult = PREFIX[s[0]]; s = after; }
  }
  if (s !== '' && !isUnit(s, unit)) return NaN;
  return base * mult;
}

const TIERS: [number, string][] = [[1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p'], [1e-15, 'f']];

/** 4 significant digits with an SI prefix: 4700 Ω -> "4.7 kΩ". */
export function formatSI(v: number, unit = ''): string {
  if (!Number.isFinite(v)) return String(v);
  if (v === 0) return `0 ${unit}`.trim();
  if (unit === '°' || unit === '%') return `${Number(v.toPrecision(4))} ${unit}`;
  const abs = Math.abs(v);
  const [scale, p] = TIERS.find(([s]) => abs >= s * 0.9995) ?? TIERS[TIERS.length - 1];
  return `${Number((v / scale).toPrecision(4))} ${p}${unit}`.trim();
}
