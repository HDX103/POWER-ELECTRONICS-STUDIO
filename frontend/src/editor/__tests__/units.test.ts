import { describe, expect, it } from 'vitest';
import { formatSI, parseSI } from '../units';

describe('parseSI', () => {
  it.each([
    ['10', '', 10], ['4.7k', 'Ω', 4700], ['4.7kΩ', 'Ω', 4700], ['4.7 kohm', 'Ω', 4700], ['100u', 'F', 1e-4], ['100uF', 'F', 1e-4],
    ['100µF', 'F', 1e-4], ['2.2e-6', 'F', 2.2e-6], ['1meg', 'Ω', 1e6], ['1MΩ', 'Ω', 1e6], ['10m', 'Ω', 0.01], ['10 mΩ', 'Ω', 0.01],
    ['50Hz', 'Hz', 50], ['20kHz', 'Hz', 2e4], ['48V', 'V', 48], ['-5', 'V', -5], ['.5', 'A', 0.5], ['120', '°', 120], ['10n', 'F', 1e-8],
    ['10p', 'F', 1e-11], ['2 mH', 'H', 2e-3],
  ])('%s [%s] -> %s', (t, u, v) => expect(parseSI(t as string, u as string)).toBeCloseTo(v as number, 12));

  it.each([['', ''], ['abc', ''], ['1x', 'Ω'], ['4.7kF', 'Ω'], ['1e', ''], ['--1', '']])('rejects %j', (t, u) =>
    expect(parseSI(t, u)).toBeNaN());
  it('does not accept a foreign unit', () => expect(parseSI('5V', 'Ω')).toBeNaN());
});

describe('formatSI', () => {
  it.each([
    [4700, 'Ω', '4.7 kΩ'], [1e-4, 'F', '100 µF'], [0.01, 'Ω', '10 mΩ'], [48, 'V', '48 V'], [2e-3, 'H', '2 mH'], [1e6, 'Ω', '1 MΩ'],
    [0, 'V', '0 V'], [-3.3, 'V', '-3.3 V'], [120, '°', '120 °'], [1e7, 'Ω', '10 MΩ'], [2.2e-9, 'F', '2.2 nF'], [10, '', '10'],
  ])('%s %s -> %s', (v, u, s) => expect(formatSI(v as number, u as string)).toBe(s));
  it('round-trips through parseSI', () => {
    for (const v of [4700, 1e-4, 0.01, 2.2e-9, 1e7, 123.4, 0.0475]) expect(parseSI(formatSI(v, 'Ω'), 'Ω')).toBeCloseTo(v, 9);
  });
});
