import { describe, expect, it } from 'vitest';
import { DEFAULT_DEVICE_MODELS, evaluateSwitchState, getSwitchVoltageDrop } from '../engine/deviceModels';
import { calculateTHD, computeFFT } from '../engine/fft';
import { runSimulation } from '../engine/solvers';
import { getTheoryModel } from '../engine/theory';
import { TOPOLOGY_DEFINITIONS } from '../topologies';

describe('Power Electronics Studio Simulation Engine', () => {
  it('loads all defined topologies across all 4 converter families', () => {
    expect(TOPOLOGY_DEFINITIONS.length).toBeGreaterThanOrEqual(10);
    const families = new Set(TOPOLOGY_DEFINITIONS.map((t) => t.family));
    expect(families.has('AC-DC')).toBe(true);
    expect(families.has('DC-DC')).toBe(true);
    expect(families.has('DC-AC')).toBe(true);
    expect(families.has('AC-AC')).toBe(true);
  });

  describe('Device Semiconductor Physics Models', () => {
    it('evaluates diode forward conduction and reverse blocking', () => {
      const diode = DEFAULT_DEVICE_MODELS.Diode;
      // Forward biased above Vf
      expect(evaluateSwitchState(diode, 1.2, 0, 0, 'OFF')).toBe('ON');
      // Forward biased below Vf
      expect(evaluateSwitchState(diode, 0.4, 0, 0, 'OFF')).toBe('OFF');
      // Reverse biased
      expect(evaluateSwitchState(diode, -10, 0, 0, 'OFF')).toBe('OFF');
      // Conducting with positive current continues ON
      expect(evaluateSwitchState(diode, 0.8, 2.5, 0, 'ON')).toBe('ON');
    });

    it('evaluates thyristor (SCR) gate triggering and holding current', () => {
      const scr = DEFAULT_DEVICE_MODELS.Thyristor;
      // Forward biased but no gate pulse -> remains OFF
      expect(evaluateSwitchState(scr, 150, 0, 0, 'OFF')).toBe('OFF');
      // Forward biased WITH gate pulse -> TRIGGERED
      expect(evaluateSwitchState(scr, 150, 0, 1, 'OFF')).toBe('TRIGGERED');
      // Triggered state remains while current > holding current
      expect(evaluateSwitchState(scr, 50, 1.2, 0, 'TRIGGERED')).toBe('TRIGGERED');
      // Commutates OFF when current drops below holding current
      expect(evaluateSwitchState(scr, -10, 0.005, 0, 'TRIGGERED')).toBe('OFF');
    });

    it('evaluates MOSFET gate switching and freewheeling body diode', () => {
      const mosfet = DEFAULT_DEVICE_MODELS.MOSFET;
      // Gate ON
      expect(evaluateSwitchState(mosfet, 24, 0, 1, 'OFF')).toBe('ON');
      // Gate OFF
      expect(evaluateSwitchState(mosfet, 24, 0, 0, 'ON')).toBe('OFF');
      // Reverse body diode conduction
      expect(evaluateSwitchState(mosfet, -1.5, -2, 0, 'OFF')).toBe('FREEWHEELING');
    });

    it('calculates realistic semiconductor voltage drops', () => {
      const diode = DEFAULT_DEVICE_MODELS.Diode;
      const drop = getSwitchVoltageDrop(diode, 'ON', 5);
      expect(drop).toBeCloseTo(diode.vf + 5 * diode.ron, 2);
    });
  });

  describe('AC-DC Rectifier Simulations', () => {
    it('simulates 1-Phase Half-Wave Rectifier with positive DC output', () => {
      const top = TOPOLOGY_DEFINITIONS.find((t) => t.id === 'acdc_1ph_half_wave')!;
      const devs = {
        T1: { ...DEFAULT_DEVICE_MODELS.Diode },
        DFWD: { ...DEFAULT_DEVICE_MODELS.Diode },
      };
      const res = runSimulation(top.id, top.defaultSource, top.defaultLoad, { alpha: 0 }, devs);

      expect(res.metrics.vdc).toBeGreaterThan(50);
      expect(res.metrics.vrms).toBeGreaterThan(res.metrics.vdc);
      expect(res.signals.vo.length).toBe(res.time.length);
    });

    it('simulates 1-Phase Full-Bridge Rectifier with continuous conduction', () => {
      const top = TOPOLOGY_DEFINITIONS.find((t) => t.id === 'acdc_1ph_full_bridge')!;
      const devs = {
        T1: { ...DEFAULT_DEVICE_MODELS.Thyristor },
        T2: { ...DEFAULT_DEVICE_MODELS.Thyristor },
        T3: { ...DEFAULT_DEVICE_MODELS.Thyristor },
        T4: { ...DEFAULT_DEVICE_MODELS.Thyristor },
      };
      const res = runSimulation(top.id, top.defaultSource, top.defaultLoad, { alpha: 30 }, devs);

      expect(res.metrics.vdc).toBeGreaterThan(100);
      expect(res.theory.theoryVdc).toBeGreaterThan(100);
      expect(res.fft.orders.length).toBe(25);
    });

    it('simulates 3-Phase Full-Bridge 6-Pulse Converter', () => {
      const top = TOPOLOGY_DEFINITIONS.find((t) => t.id === 'acdc_3ph_full_bridge')!;
      const devs = {
        T1: { ...DEFAULT_DEVICE_MODELS.Thyristor },
        T2: { ...DEFAULT_DEVICE_MODELS.Thyristor },
        T3: { ...DEFAULT_DEVICE_MODELS.Thyristor },
        T4: { ...DEFAULT_DEVICE_MODELS.Thyristor },
        T5: { ...DEFAULT_DEVICE_MODELS.Thyristor },
        T6: { ...DEFAULT_DEVICE_MODELS.Thyristor },
      };
      const res = runSimulation(top.id, top.defaultSource, top.defaultLoad, { alpha: 0 }, devs);

      expect(res.metrics.vdc).toBeGreaterThan(400); // 3-phase full bridge provides high Vdc
      expect(res.metrics.rf).toBeLessThan(0.2); // Low ripple factor for 6-pulse
    });
  });

  describe('DC-DC Switch-Mode Simulations', () => {
    it('simulates Buck Converter with Vo = D * Vin', () => {
      const top = TOPOLOGY_DEFINITIONS.find((t) => t.id === 'dcdc_buck')!;
      const devs = {
        S1: { ...DEFAULT_DEVICE_MODELS.MOSFET },
        D1: { ...DEFAULT_DEVICE_MODELS.Diode },
      };
      const res = runSimulation(top.id, { type: 'DC', vdc: 48 }, top.defaultLoad, { duty: 0.5, fsw: 25000 }, devs);

      expect(res.metrics.vdc).toBeGreaterThan(15);
      expect(res.metrics.vdc).toBeLessThan(48);
      expect(res.theory.theoryVdc).toBeCloseTo(24, 0);
    });

    it('simulates Boost Converter with Vo > Vin', () => {
      const top = TOPOLOGY_DEFINITIONS.find((t) => t.id === 'dcdc_boost')!;
      const devs = {
        S1: { ...DEFAULT_DEVICE_MODELS.MOSFET },
        D1: { ...DEFAULT_DEVICE_MODELS.Diode },
      };
      const res = runSimulation(top.id, { type: 'DC', vdc: 24 }, top.defaultLoad, { duty: 0.5, fsw: 25000 }, devs);

      expect(res.metrics.vdc).toBeGreaterThan(24);
      expect(res.theory.theoryVdc).toBeCloseTo(48, 0);
    });

    it('simulates Isolated Flyback Converter with turns ratio transfer', () => {
      const top = TOPOLOGY_DEFINITIONS.find((t) => t.id === 'dcdc_flyback')!;
      const devs = {
        S1: { ...DEFAULT_DEVICE_MODELS.MOSFET },
        D1: { ...DEFAULT_DEVICE_MODELS.Diode },
      };
      const res = runSimulation(
        top.id,
        { type: 'DC', vdc: 24 },
        top.defaultLoad,
        { duty: 0.5, fsw: 50000, turnsRatio: 1.5 },
        devs
      );

      expect(res.metrics.vdc).toBeGreaterThan(15);
      expect(res.theory.theoryVdc).toBeCloseTo(36, 0); // 1.5 * (0.5/0.5) * 24 = 36V
      expect(res.signals.vo.length).toBe(res.time.length);
    });

    it('simulates Isolated Forward Converter with demag winding and LC filter', () => {
      const top = TOPOLOGY_DEFINITIONS.find((t) => t.id === 'dcdc_forward')!;
      const devs = {
        S1: { ...DEFAULT_DEVICE_MODELS.MOSFET },
        D_reset: { ...DEFAULT_DEVICE_MODELS.Diode },
        D1: { ...DEFAULT_DEVICE_MODELS.Diode },
        D2: { ...DEFAULT_DEVICE_MODELS.Diode },
      };
      const res = runSimulation(
        top.id,
        { type: 'DC', vdc: 48 },
        top.defaultLoad,
        { duty: 0.4, fsw: 50000, turnsRatio: 0.5 },
        devs
      );

      expect(res.metrics.vdc).toBeGreaterThan(5);
      expect(res.theory.theoryVdc).toBeCloseTo(9.6, 0); // 0.5 * 0.4 * 48 = 9.6V
    });
  });

  describe('DC-AC Inverter Simulations', () => {
    it('simulates Full-Bridge Inverter with bipolar SPWM modulation', () => {
      const top = TOPOLOGY_DEFINITIONS.find((t) => t.id === 'dcac_full_bridge')!;
      const devs = {
        S1: { ...DEFAULT_DEVICE_MODELS.MOSFET },
        S2: { ...DEFAULT_DEVICE_MODELS.MOSFET },
        S3: { ...DEFAULT_DEVICE_MODELS.MOSFET },
        S4: { ...DEFAULT_DEVICE_MODELS.MOSFET },
      };
      const res = runSimulation(
        top.id,
        { type: 'DC', vdc: 325 },
        top.defaultLoad,
        { modulationType: 'spwm_bipolar', ma: 0.8, fsw: 5000 },
        devs
      );

      // Inverter AC output has roughly zero DC component
      expect(Math.abs(res.metrics.vdc)).toBeLessThan(50);
      expect(res.metrics.vrms).toBeGreaterThan(100);
      expect(res.signals.carrier).toBeDefined();
    });

    it('simulates Three-Phase VSI with 3-phase line and phase voltages', () => {
      const top = TOPOLOGY_DEFINITIONS.find((t) => t.id === 'dcac_3ph_vsi')!;
      const devs = {
        S1: { ...DEFAULT_DEVICE_MODELS.IGBT },
        S2: { ...DEFAULT_DEVICE_MODELS.IGBT },
        S3: { ...DEFAULT_DEVICE_MODELS.IGBT },
        S4: { ...DEFAULT_DEVICE_MODELS.IGBT },
        S5: { ...DEFAULT_DEVICE_MODELS.IGBT },
        S6: { ...DEFAULT_DEVICE_MODELS.IGBT },
      };
      const res = runSimulation(
        top.id,
        { type: 'DC', vdc: 400 },
        top.defaultLoad,
        { modulationType: 'spwm_bipolar', ma: 0.85, fsw: 6000 },
        devs
      );

      // 3-Phase line-to-line AC has near zero DC average
      expect(Math.abs(res.metrics.vdc)).toBeLessThan(50);
      expect(res.metrics.vrms).toBeGreaterThan(100);
      expect(res.signals.vs_b).toBeDefined();
      expect(res.signals.vs_c).toBeDefined();
      expect(res.theory.theoryVrms).toBeGreaterThan(150);
    });
  });

  describe('Additional DC-DC Topologies (Ćuk & SEPIC)', () => {
    it('simulates Ćuk Converter with continuous capacitor voltage transfer', () => {
      const top = TOPOLOGY_DEFINITIONS.find((t) => t.id === 'dcdc_cuk')!;
      const devs = {
        S1: { ...DEFAULT_DEVICE_MODELS.MOSFET },
        D1: { ...DEFAULT_DEVICE_MODELS.Diode },
      };
      const res = runSimulation(top.id, { type: 'DC', vdc: 24 }, top.defaultLoad, { duty: 0.5, fsw: 30000 }, devs);

      expect(res.metrics.vdc).toBeGreaterThan(15);
      expect(res.theory.theoryVdc).toBeCloseTo(24, 0);
    });

    it('simulates SEPIC Converter with non-inverting transfer', () => {
      const top = TOPOLOGY_DEFINITIONS.find((t) => t.id === 'dcdc_sepic')!;
      const devs = {
        S1: { ...DEFAULT_DEVICE_MODELS.MOSFET },
        D1: { ...DEFAULT_DEVICE_MODELS.Diode },
      };
      const res = runSimulation(top.id, { type: 'DC', vdc: 24 }, top.defaultLoad, { duty: 0.5, fsw: 30000 }, devs);

      expect(res.metrics.vdc).toBeGreaterThan(15);
      expect(res.theory.theoryVdc).toBeCloseTo(24, 0);
    });
  });

  describe('Fourier Analysis & Analytical Theory', () => {
    it('computes FFT harmonic decomposition and calculates THD', () => {
      // Create a test synthetic square wave
      const N = 200;
      const waveV = new Array(N).fill(0).map((_, i) => (i < N / 2 ? 100 : -100));
      const waveI = new Array(N).fill(0).map((_, i) => (i < N / 2 ? 10 : -10));

      const fft = computeFFT(waveV, waveI, N, 50, 15);
      expect(fft.orders.length).toBe(15);
      expect(fft.orders[0]).toBe(1); // fundamental
      // In square wave, even harmonics are near 0 and odd harmonics are prominent
      expect(fft.voltages[1]).toBeLessThan(fft.voltages[0]); // n=2 is smaller than n=1
      const thd = calculateTHD(fft.voltages);
      expect(thd).toBeGreaterThan(30);
    });

    it('generates theoretical derivations and step-by-step formulas', () => {
      const theory = getTheoryModel(
        'acdc_1ph_full_bridge',
        { type: 'AC_1PH', vrms: 230, freq: 50 },
        { type: 'R', R: 10, L: 0, E: 0, C: 0, fwd: false },
        { alpha: 0 }
      );

      expect(theory.theoryVdc).toBeCloseTo(207.07, 1);
      expect(theory.derivationSteps.length).toBeGreaterThan(0);
      expect(theory.derivationSteps[0].latex).toContain('V_m');
    });
  });
});
