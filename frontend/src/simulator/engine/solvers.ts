import {
  ControlParams,
  LoadParams,
  MetricResults,
  SimulationResult,
  SourceParams,
  SwitchModel,
  SwitchState,
} from '../types';
import { DEFAULT_DEVICE_MODELS, getSwitchVoltageDrop } from './deviceModels';
import { calculateTHD, computeFFT } from './fft';
import { getTheoryModel } from './theory';

export function runSimulation(
  topologyId: string,
  source: SourceParams,
  load: LoadParams,
  control: ControlParams,
  devices: Record<string, SwitchModel>
): SimulationResult {
  const R = Math.max(0.1, load.R || 10);
  const L = Math.max(0, load.L || 0);
  const C = Math.max(1e-9, load.C || 100e-6);
  const E = load.E || 0;
  const fwd = Boolean(load.fwd);

  const fAc = source.freq || 50;
  const vrms = source.vrms || 230;
  const vm = Math.SQRT2 * vrms;
  const vin = source.vdc || 24;
  const alphaDeg = control.alpha ?? 0;
  const alphaRad = (alphaDeg * Math.PI) / 180;
  const duty = Math.min(0.98, Math.max(0.02, control.duty ?? 0.5));
  const fsw = control.fsw || 20000;
  const ma = control.ma ?? 0.8;

  // Determine time scale, duration, and sampling
  let period = 1 / fAc;
  let totalTime = 2 * period;
  let timeUnit: 'ms' | 'us' | 's' = 'ms';
  let stepsCount = 1000;

  if (topologyId.startsWith('dcdc')) {
    period = 1 / fsw;
    totalTime = 4 * period;
    timeUnit = 'us';
    stepsCount = 1200;
  } else if (topologyId.startsWith('dcac')) {
    period = 1 / (control.fsw ? 50 : 50); // fundamental 50Hz
    totalTime = 2 * period;
    timeUnit = 'ms';
    stepsCount = 1200;
  } else if (topologyId === 'acac_1ph_cycloconverter') {
    const div = control.frequencyDivision || 3;
    period = div / fAc;
    totalTime = 2 * period;
    timeUnit = 'ms';
    stepsCount = 1600;
  } else if (topologyId === 'acac_1ph_integral') {
    const nc = control.conductionCycles || 3;
    const ne = control.extinctionCycles || 2;
    period = (nc + ne) / fAc;
    totalTime = period;
    timeUnit = 'ms';
    stepsCount = 1500;
  }

  const dt = totalTime / stepsCount;
  const time: number[] = new Array(stepsCount);
  const vsList: number[] = new Array(stepsCount).fill(0);
  const vsBList: number[] = new Array(stepsCount).fill(0);
  const vsCList: number[] = new Array(stepsCount).fill(0);
  const vinList: number[] = new Array(stepsCount).fill(0);
  const voList: number[] = new Array(stepsCount).fill(0);
  const ioList: number[] = new Array(stepsCount).fill(0);
  const isList: number[] = new Array(stepsCount).fill(0);
  const iLList: number[] = new Array(stepsCount).fill(0);
  const vCList: number[] = new Array(stepsCount).fill(0);
  const vswList: number[] = new Array(stepsCount).fill(0);
  const ifwdList: number[] = new Array(stepsCount).fill(0);
  const gate1List: number[] = new Array(stepsCount).fill(0);
  const gate2List: number[] = new Array(stepsCount).fill(0);
  const carrierList: number[] = new Array(stepsCount).fill(0);
  const referenceList: number[] = new Array(stepsCount).fill(0);

  const devKeys = Object.keys(devices);
  const deviceStates: Record<string, SwitchState[]> = {};
  devKeys.forEach((k) => (deviceStates[k] = new Array(stepsCount).fill('OFF')));
  const activePaths: Record<string, boolean>[] = new Array(stepsCount);

  // Initial state variables
  let iL = 0;
  let vC = topologyId === 'dcdc_buck' ? vin * duty : topologyId === 'dcdc_boost' ? vin / (1 - duty) : 0;
  let scrOn1 = false;
  let scrOn2 = false;

  const defaultDev = DEFAULT_DEVICE_MODELS.Diode;

  // Simulation Loop
  for (let step = 0; step < stepsCount; step++) {
    const t = step * dt;
    time[step] = Number((t * (timeUnit === 'ms' ? 1e3 : timeUnit === 'us' ? 1e6 : 1)).toFixed(3));

    const paths: Record<string, boolean> = {
      path_pos: false,
      path_neg: false,
      path_fwd: false,
      path_phaseA: false,
      path_phaseB: false,
      path_phaseC: false,
      path_switch_on: false,
      path_diode_on: false,
    };

    // Evaluate based on topology family
    if (topologyId === 'acdc_1ph_half_wave') {
      const omega = 2 * Math.PI * fAc;
      const vs = vm * Math.sin(omega * t);
      vsList[step] = vs;
      const angle = (omega * t) % (2 * Math.PI);
      const isSCR = devices['T1']?.type === 'Thyristor';

      // Gate pulse
      const g1 = isSCR && angle >= alphaRad && angle <= alphaRad + 0.15 ? 1 : 0;
      gate1List[step] = g1;

      if (isSCR) {
        if (!scrOn1 && g1 === 1 && vs > E) scrOn1 = true;
        if (scrOn1 && (iL <= 0.001 || vs < E - 2)) {
          if (!fwd || vs < 0) scrOn1 = false;
        }
      } else {
        scrOn1 = vs > E;
      }

      // Freewheeling diode action
      let fwdConducting = false;
      if (fwd && !scrOn1 && iL > 0) {
        fwdConducting = true;
      }

      let vo = 0;
      let drop = getSwitchVoltageDrop(devices['T1'] || defaultDev, scrOn1 ? 'ON' : 'OFF', iL);
      if (scrOn1) {
        vo = vs - drop;
        paths.path_pos = true;
        deviceStates['T1'][step] = isSCR ? 'TRIGGERED' : 'ON';
      } else if (fwdConducting) {
        vo = -0.7; // clamped by FWD
        paths.path_fwd = true;
        if (devices['DFWD']) deviceStates['DFWD'][step] = 'FREEWHEELING';
      } else {
        vo = E; // floats at back EMF
        deviceStates['T1'][step] = 'OFF';
      }

      // Inductor ODE
      if (L > 0) {
        const di = ((vo - E - iL * R) / L) * dt;
        iL += di;
        if (iL < 0) iL = 0;
      } else {
        iL = Math.max(0, (vo - E) / R);
      }

      voList[step] = vo;
      ioList[step] = iL;
      isList[step] = scrOn1 ? iL : 0;
      ifwdList[step] = fwdConducting ? iL : 0;
      vswList[step] = scrOn1 ? drop : vs - vo;
    } else if (topologyId === 'acdc_1ph_full_bridge') {
      const omega = 2 * Math.PI * fAc;
      const vs = vm * Math.sin(omega * t);
      vsList[step] = vs;
      const angle = (omega * t) % (2 * Math.PI);
      const isSCR = devices['T1']?.type === 'Thyristor';

      const g12 = isSCR && angle >= alphaRad && angle <= alphaRad + 0.15 ? 1 : 0;
      const g34 = isSCR && angle >= alphaRad + Math.PI && angle <= alphaRad + Math.PI + 0.15 ? 1 : 0;
      gate1List[step] = g12;
      gate2List[step] = g34;

      if (isSCR) {
        if (g12 === 1 && vs > 0) {
          scrOn1 = true;
          scrOn2 = false;
        }
        if (g34 === 1 && vs < 0) {
          scrOn2 = true;
          scrOn1 = false;
        }
        if (iL <= 0.001) {
          if (vs <= 0) scrOn1 = false;
          if (vs >= 0) scrOn2 = false;
        }
      } else {
        scrOn1 = vs > 0;
        scrOn2 = vs < 0;
      }

      let vo = 0;
      if (scrOn1) {
        vo = vs - 2 * 0.8;
        paths.path_pos = true;
        if (devices['T1']) deviceStates['T1'][step] = isSCR ? 'TRIGGERED' : 'ON';
        if (devices['T2']) deviceStates['T2'][step] = isSCR ? 'TRIGGERED' : 'ON';
      } else if (scrOn2) {
        vo = -vs - 2 * 0.8;
        paths.path_neg = true;
        if (devices['T3']) deviceStates['T3'][step] = isSCR ? 'TRIGGERED' : 'ON';
        if (devices['T4']) deviceStates['T4'][step] = isSCR ? 'TRIGGERED' : 'ON';
      } else {
        vo = E;
      }

      if (L > 0) {
        const di = ((vo - E - iL * R) / L) * dt;
        iL += di;
        if (iL < 0) iL = 0;
      } else {
        iL = Math.max(0, (vo - E) / R);
      }

      voList[step] = vo;
      ioList[step] = iL;
      isList[step] = scrOn1 ? iL : scrOn2 ? -iL : 0;
      vswList[step] = scrOn1 ? 0.8 : vs;
    } else if (topologyId === 'acdc_1ph_semi') {
      const omega = 2 * Math.PI * fAc;
      const vs = vm * Math.sin(omega * t);
      vsList[step] = vs;
      const angle = (omega * t) % (2 * Math.PI);

      const g1 = angle >= alphaRad && angle <= alphaRad + 0.15 ? 1 : 0;
      const g2 = angle >= alphaRad + Math.PI && angle <= alphaRad + Math.PI + 0.15 ? 1 : 0;
      gate1List[step] = g1;
      gate2List[step] = g2;

      let vo = 0;
      if (angle >= alphaRad && angle < Math.PI) {
        vo = vs - 1.5;
        paths.path_pos = true;
        if (devices['T1']) deviceStates['T1'][step] = 'TRIGGERED';
        if (devices['D2']) deviceStates['D2'][step] = 'ON';
      } else if (angle >= Math.PI + alphaRad && angle < 2 * Math.PI) {
        vo = -vs - 1.5;
        paths.path_neg = true;
        if (devices['T2']) deviceStates['T2'][step] = 'TRIGGERED';
        if (devices['D1']) deviceStates['D1'][step] = 'ON';
      } else {
        // Intrinsic freewheeling through diodes D1 & D2
        vo = -0.7;
        paths.path_fwd = true;
        if (devices['D1']) deviceStates['D1'][step] = 'FREEWHEELING';
        if (devices['D2']) deviceStates['D2'][step] = 'FREEWHEELING';
      }

      if (L > 0) {
        const di = ((Math.max(0, vo) - E - iL * R) / L) * dt;
        iL += di;
        if (iL < 0) iL = 0;
      } else {
        iL = Math.max(0, (vo - E) / R);
      }

      voList[step] = Math.max(0, vo);
      ioList[step] = iL;
      isList[step] = paths.path_pos ? iL : paths.path_neg ? -iL : 0;
      ifwdList[step] = paths.path_fwd ? iL : 0;
    } else if (topologyId === 'acdc_3ph_half_wave') {
      const omega = 2 * Math.PI * fAc;
      const va = vm * Math.sin(omega * t);
      const vb = vm * Math.sin(omega * t - (2 * Math.PI) / 3);
      const vc = vm * Math.sin(omega * t + (2 * Math.PI) / 3);
      vsList[step] = va;
      vsBList[step] = vb;
      vsCList[step] = vc;

      const angle = (omega * t) % (2 * Math.PI);
      const aTrig = (Math.PI / 6 + alphaRad) % (2 * Math.PI);
      const bTrig = (aTrig + (2 * Math.PI) / 3) % (2 * Math.PI);

      let vo = 0;
      if (angle >= aTrig && angle < aTrig + (2 * Math.PI) / 3) {
        vo = va - 1.2;
        paths.path_phaseA = true;
        if (devices['T1']) deviceStates['T1'][step] = 'TRIGGERED';
      } else if (angle >= bTrig && angle < bTrig + (2 * Math.PI) / 3) {
        vo = vb - 1.2;
        paths.path_phaseB = true;
        if (devices['T2']) deviceStates['T2'][step] = 'TRIGGERED';
      } else {
        vo = vc - 1.2;
        paths.path_phaseC = true;
        if (devices['T3']) deviceStates['T3'][step] = 'TRIGGERED';
      }

      if (L > 0) {
        iL += ((vo - E - iL * R) / L) * dt;
        if (iL < 0) iL = 0;
      } else {
        iL = Math.max(0, (vo - E) / R);
      }

      voList[step] = vo;
      ioList[step] = iL;
      isList[step] = paths.path_phaseA ? iL : 0;
    } else if (topologyId === 'acdc_3ph_full_bridge') {
      const omega = 2 * Math.PI * fAc;
      const va = vm * Math.sin(omega * t);
      const vb = vm * Math.sin(omega * t - (2 * Math.PI) / 3);
      const vc = vm * Math.sin(omega * t + (2 * Math.PI) / 3);
      vsList[step] = va;
      vsBList[step] = vb;
      vsCList[step] = vc;

      // 6-Pulse envelope
      const vMaxPh = Math.max(va, vb, vc);
      const vMinPh = Math.min(va, vb, vc);
      let vo = vMaxPh - vMinPh - 1.6;

      // When firing angle alpha is applied, phase shift the 6-pulse conduction window
      if (alphaDeg > 0) {
        const angle = (omega * t + alphaRad) % ((2 * Math.PI) / 6);
        vo = Math.sqrt(3) * vm * Math.cos(angle - Math.PI / 6) * Math.cos(alphaRad) - 1.6;
      }

      if (L > 0) {
        iL += ((vo - E - iL * R) / L) * dt;
        if (iL < 0) iL = 0;
      } else {
        iL = Math.max(0, (vo - E) / R);
      }

      paths.path_phaseA = true;
      paths.path_phaseB = true;
      voList[step] = Math.max(0, vo);
      ioList[step] = iL;
      isList[step] = va > 0 ? iL : -iL;
      if (devices['T1']) deviceStates['T1'][step] = 'ON';
      if (devices['T2']) deviceStates['T2'][step] = 'ON';
    } else if (topologyId === 'dcdc_buck') {
      // Buck Converter
      vinList[step] = vin;
      const tInPeriod = t % (1 / fsw);
      const isSwitchOn = tInPeriod < duty / fsw;
      gate1List[step] = isSwitchOn ? 1 : 0;

      const swDrop = getSwitchVoltageDrop(devices['S1'] || defaultDev, isSwitchOn ? 'ON' : 'OFF', iL);
      const dDrop = getSwitchVoltageDrop(devices['D1'] || defaultDev, !isSwitchOn && iL > 0 ? 'ON' : 'OFF', iL);

      let diL = 0;
      if (isSwitchOn) {
        diL = (vin - vC - swDrop) / (L || 1e-3);
        paths.path_switch_on = true;
        if (devices['S1']) deviceStates['S1'][step] = 'ON';
        if (devices['D1']) deviceStates['D1'][step] = 'OFF';
      } else if (iL > 0) {
        diL = (-vC - dDrop) / (L || 1e-3);
        paths.path_diode_on = true;
        if (devices['S1']) deviceStates['S1'][step] = 'OFF';
        if (devices['D1']) deviceStates['D1'][step] = 'FREEWHEELING';
      } else {
        diL = 0;
        iL = 0;
        if (devices['S1']) deviceStates['S1'][step] = 'OFF';
        if (devices['D1']) deviceStates['D1'][step] = 'OFF';
      }

      const dvC = (iL - vC / R) / C;
      iL += diL * dt;
      if (iL < 0) iL = 0;
      vC += dvC * dt;

      voList[step] = Math.max(0, vC);
      ioList[step] = vC / R;
      iLList[step] = iL;
      vCList[step] = vC;
      isList[step] = isSwitchOn ? iL : 0;
      vswList[step] = isSwitchOn ? swDrop : vin;
    } else if (topologyId === 'dcdc_boost') {
      // Boost Converter
      vinList[step] = vin;
      const tInPeriod = t % (1 / fsw);
      const isSwitchOn = tInPeriod < duty / fsw;
      gate1List[step] = isSwitchOn ? 1 : 0;

      let diL = 0;
      let dvC = 0;

      if (isSwitchOn) {
        diL = (vin - 0.2) / (L || 1e-3);
        dvC = -vC / (R * C);
        paths.path_switch_on = true;
        if (devices['S1']) deviceStates['S1'][step] = 'ON';
        if (devices['D1']) deviceStates['D1'][step] = 'OFF';
      } else {
        diL = (vin - vC - 0.7) / (L || 1e-3);
        dvC = (iL - vC / R) / C;
        paths.path_diode_on = true;
        if (devices['S1']) deviceStates['S1'][step] = 'OFF';
        if (devices['D1']) deviceStates['D1'][step] = 'ON';
      }

      iL += diL * dt;
      if (iL < 0) iL = 0;
      vC += dvC * dt;
      if (vC < vin) vC = vin;

      voList[step] = vC;
      ioList[step] = vC / R;
      iLList[step] = iL;
      vCList[step] = vC;
      isList[step] = iL;
      vswList[step] = isSwitchOn ? 0.2 : vC;
    } else if (topologyId === 'dcdc_buck_boost') {
      // Buck-Boost Converter (Inverting)
      vinList[step] = vin;
      const tInPeriod = t % (1 / fsw);
      const isSwitchOn = tInPeriod < duty / fsw;
      gate1List[step] = isSwitchOn ? 1 : 0;

      let diL = 0;
      let dvC = 0;

      if (isSwitchOn) {
        diL = (vin - 0.2) / (L || 1e-3);
        dvC = -vC / (R * C);
        paths.path_switch_on = true;
        if (devices['S1']) deviceStates['S1'][step] = 'ON';
        if (devices['D1']) deviceStates['D1'][step] = 'OFF';
      } else {
        diL = (-vC - 0.7) / (L || 1e-3);
        dvC = (iL - vC / R) / C;
        paths.path_diode_on = true;
        if (devices['S1']) deviceStates['S1'][step] = 'OFF';
        if (devices['D1']) deviceStates['D1'][step] = 'ON';
      }

      iL += diL * dt;
      if (iL < 0) iL = 0;
      vC += dvC * dt;

      voList[step] = -vC;
      ioList[step] = vC / R;
      iLList[step] = iL;
      vCList[step] = vC;
      isList[step] = isSwitchOn ? iL : 0;
    } else if (topologyId === 'dcac_full_bridge') {
      // Full-Bridge Inverter
      vinList[step] = vin;
      const fOut = 50;
      const ref = ma * Math.sin(2 * Math.PI * fOut * t);
      // Triangular carrier between -1 and +1
      const carrierPhase = (t * fsw) % 1;
      const triCarrier = carrierPhase < 0.5 ? 4 * carrierPhase - 1 : 3 - 4 * carrierPhase;

      carrierList[step] = triCarrier;
      referenceList[step] = ref;

      let s1 = false;
      let s2 = false;

      if (control.modulationType === 'spwm_bipolar') {
        s1 = ref > triCarrier;
        s2 = !s1;
      } else if (control.modulationType === 'spwm_unipolar') {
        s1 = ref > triCarrier;
        s2 = -ref > triCarrier;
      } else {
        // Square wave
        s1 = Math.sin(2 * Math.PI * fOut * t) > 0;
        s2 = !s1;
      }

      gate1List[step] = s1 ? 1 : 0;
      gate2List[step] = s2 ? 1 : 0;

      let vo = 0;
      if (control.modulationType === 'spwm_unipolar') {
        vo = (s1 ? vin : 0) - (s2 ? vin : 0);
      } else {
        vo = s1 ? vin : -vin;
      }

      // Filtered RL load response
      if (L > 0) {
        iL += ((vo - iL * R) / L) * dt;
      } else {
        iL = vo / R;
      }

      if (vo > 0) paths.path_pos = true;
      if (vo < 0) paths.path_neg = true;

      voList[step] = vo;
      ioList[step] = iL;
      isList[step] = Math.abs(iL);
      if (devices['S1']) deviceStates['S1'][step] = s1 ? 'ON' : 'OFF';
      if (devices['S2']) deviceStates['S2'][step] = s2 ? 'ON' : 'OFF';
      if (devices['S3']) deviceStates['S3'][step] = !s1 ? 'ON' : 'OFF';
      if (devices['S4']) deviceStates['S4'][step] = !s2 ? 'ON' : 'OFF';
    } else if (topologyId === 'acac_1ph_controller') {
      // Single-phase AC Voltage Controller
      const omega = 2 * Math.PI * fAc;
      const vs = vm * Math.sin(omega * t);
      vsList[step] = vs;
      const angle = (omega * t) % Math.PI; // symmetric half-cycle
      const isPos = Math.sin(omega * t) >= 0;

      const g = angle >= alphaRad && angle <= alphaRad + 0.15 ? 1 : 0;
      gate1List[step] = g;

      if (g === 1) scrOn1 = true;
      if (angle < 0.05) scrOn1 = false;

      let vo = 0;
      if (scrOn1) {
        vo = vs - 1.2 * (isPos ? 1 : -1);
        if (isPos) {
          paths.path_pos = true;
          if (devices['S1']) deviceStates['S1'][step] = 'TRIGGERED';
        } else {
          paths.path_neg = true;
          if (devices['S2']) deviceStates['S2'][step] = 'TRIGGERED';
        }
      } else {
        vo = 0;
        if (devices['S1']) deviceStates['S1'][step] = 'OFF';
        if (devices['S2']) deviceStates['S2'][step] = 'OFF';
      }

      if (L > 0) {
        iL += ((vo - iL * R) / L) * dt;
      } else {
        iL = vo / R;
      }

      voList[step] = vo;
      ioList[step] = iL;
      isList[step] = iL;
    } else if (topologyId === 'acac_1ph_cycloconverter') {
      // Cycloconverter: divides frequency by factor m
      const div = control.frequencyDivision || 3;
      const omega = 2 * Math.PI * fAc;
      const vs = vm * Math.sin(omega * t);
      vsList[step] = vs;

      const fo = fAc / div;
      const posBank = Math.sin(2 * Math.PI * fo * t) >= 0;

      // Positive bank rectifies vs positively, negative bank inverts
      const rectified = Math.abs(vs) - 1.5;
      const vo = posBank ? rectified : -rectified;

      if (L > 0) {
        iL += ((vo - iL * R) / L) * dt;
      } else {
        iL = vo / R;
      }

      if (posBank) {
        paths.path_pos = true;
        if (devices['P1']) deviceStates['P1'][step] = 'ON';
      } else {
        paths.path_neg = true;
        if (devices['N1']) deviceStates['N1'][step] = 'ON';
      }

      voList[step] = vo;
      ioList[step] = iL;
      isList[step] = posBank ? iL : -iL;
    } else {
      // General default
      const omega = 2 * Math.PI * fAc;
      const vs = vm * Math.sin(omega * t);
      vsList[step] = vs;
      const vo = Math.abs(vs);
      voList[step] = vo;
      ioList[step] = vo / R;
    }

    activePaths[step] = paths;
  }

  // Calculate Metrics (Averages, RMS, Power, Ripple Factor)
  let sumVo = 0;
  let sumVoSq = 0;
  let sumIo = 0;
  let sumIoSq = 0;
  let sumP = 0;

  for (let i = 0; i < stepsCount; i++) {
    sumVo += voList[i];
    sumVoSq += voList[i] * voList[i];
    sumIo += ioList[i];
    sumIoSq += ioList[i] * ioList[i];
    sumP += voList[i] * ioList[i];
  }

  const vdc = sumVo / stepsCount;
  const vrmsOut = Math.sqrt(sumVoSq / stepsCount);
  const idc = sumIo / stepsCount;
  const irms = Math.sqrt(sumIoSq / stepsCount);
  const pavg = sumP / stepsCount;
  const sapp = vrmsOut * irms;
  const pf = sapp > 0 ? Math.min(1, Math.max(0, pavg / sapp)) : 1;
  const ff = vdc !== 0 ? vrmsOut / Math.abs(vdc) : 1;
  const rf = Math.sqrt(Math.max(0, ff * ff - 1));
  const eff = sapp > 0 ? (Math.abs(vdc * idc) / sapp) * 100 : 100;

  // FFT analysis
  const fftSamplesPerPeriod = Math.floor(stepsCount / 2);
  const baseFreq = topologyId.startsWith('dcdc') ? fsw : fAc;
  const fft = computeFFT(voList, ioList, fftSamplesPerPeriod, baseFreq, 25);
  const thd_v = calculateTHD(fft.voltages);
  const thd_i = calculateTHD(fft.currents);
  const df = Number((1 / Math.sqrt(1 + (thd_i / 100) * (thd_i / 100))).toFixed(3));

  const metrics: MetricResults = {
    vdc: Number(vdc.toFixed(2)),
    vrms: Number(vrmsOut.toFixed(2)),
    idc: Number(idc.toFixed(2)),
    irms: Number(irms.toFixed(2)),
    pavg: Number(pavg.toFixed(1)),
    sapp: Number(sapp.toFixed(1)),
    pf: Number(pf.toFixed(3)),
    rf: Number(rf.toFixed(3)),
    ff: Number(ff.toFixed(3)),
    eff: Number(Math.min(100, Math.max(0, eff)).toFixed(1)),
    thd_v,
    thd_i,
    df,
  };

  const theory = getTheoryModel(topologyId, source, load, control);

  return {
    time,
    period,
    timeUnit,
    signals: {
      vs: vsList,
      vs_b: vsBList,
      vs_c: vsCList,
      vin: vinList,
      vo: voList,
      io: ioList,
      is: isList,
      iL: iLList,
      vC: vCList,
      vsw: vswList,
      ifwd: ifwdList,
      gate1: gate1List,
      gate2: gate2List,
      carrier: carrierList,
      reference: referenceList,
    },
    deviceStates,
    activePaths,
    metrics,
    fft,
    theory,
  };
}
