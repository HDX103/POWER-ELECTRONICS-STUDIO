import { SwitchModel, SwitchState, SwitchType } from '../types';

export const DEFAULT_DEVICE_MODELS: Record<SwitchType, SwitchModel> = {
  Diode: {
    id: 'diode_default',
    name: '1N5408 Standard Power Diode',
    type: 'Diode',
    vf: 0.8,
    ron: 0.015,
    roff: 1e6,
    trr: 2e-6,
  },
  Thyristor: {
    id: 'scr_default',
    name: 'TYN612 Fast Phase-Control Thyristor',
    type: 'Thyristor',
    vf: 1.2,
    ron: 0.02,
    roff: 1e6,
    holdingCurrent: 0.03, // 30 mA
    latchingCurrent: 0.06,
  },
  MOSFET: {
    id: 'mosfet_default',
    name: 'IRFP460 Power MOSFET',
    type: 'MOSFET',
    vf: 0.0,
    ron: 0.025, // 25 mOhm
    roff: 1e6,
    bodyDiode: true,
    bodyDiodeVf: 0.9,
  },
  IGBT: {
    id: 'igbt_default',
    name: 'FGA25N120 High-Voltage IGBT',
    type: 'IGBT',
    vf: 0.0,
    vceSat: 1.7,
    ron: 0.03,
    roff: 1e6,
  },
  TRIAC: {
    id: 'triac_default',
    name: 'BTA16 Bidirectional TRIAC',
    type: 'TRIAC',
    vf: 1.3,
    ron: 0.02,
    roff: 1e6,
    holdingCurrent: 0.04,
  },
  IdealSwitch: {
    id: 'ideal_default',
    name: 'Ideal Lossless Switch',
    type: 'IdealSwitch',
    vf: 0.0,
    ron: 1e-4,
    roff: 1e7,
  },
};

export const DEVICE_PRESETS: Record<SwitchType, SwitchModel[]> = {
  Diode: [
    { id: '1N4007', name: '1N4007 (1000V 1A)', type: 'Diode', vf: 0.7, ron: 0.05, roff: 1e6 },
    { id: '1N5408', name: '1N5408 (1000V 3A)', type: 'Diode', vf: 0.8, ron: 0.02, roff: 1e6 },
    { id: 'MBR20100', name: 'MBR20100CT Schottky (100V 20A)', type: 'Diode', vf: 0.55, ron: 0.008, roff: 1e5 },
    { id: 'DSEI60', name: 'DSEI60 Ultrafast (600V 60A)', type: 'Diode', vf: 1.2, ron: 0.01, roff: 1e6 },
  ],
  Thyristor: [
    { id: 'BT151', name: 'BT151 (500V 12A)', type: 'Thyristor', vf: 1.4, ron: 0.025, roff: 1e6, holdingCurrent: 0.02 },
    { id: 'TYN612', name: 'TYN612 (600V 12A)', type: 'Thyristor', vf: 1.2, ron: 0.02, roff: 1e6, holdingCurrent: 0.03 },
    { id: 'SKT100', name: 'Semikron SKT100 (1200V 100A)', type: 'Thyristor', vf: 1.6, ron: 0.005, roff: 1e6, holdingCurrent: 0.15 },
  ],
  MOSFET: [
    { id: 'IRF540N', name: 'IRF540N (100V 33A 44mΩ)', type: 'MOSFET', vf: 0, ron: 0.044, roff: 1e6, bodyDiode: true, bodyDiodeVf: 0.85 },
    { id: 'IRFP460', name: 'IRFP460 (500V 20A 270mΩ)', type: 'MOSFET', vf: 0, ron: 0.27, roff: 1e6, bodyDiode: true, bodyDiodeVf: 1.0 },
    { id: 'C3M0065090D', name: 'SiC MOSFET (900V 36A 65mΩ)', type: 'MOSFET', vf: 0, ron: 0.065, roff: 1e6, bodyDiode: true, bodyDiodeVf: 1.8 },
  ],
  IGBT: [
    { id: 'FGA25N120', name: 'FGA25N120 (1200V 25A)', type: 'IGBT', vf: 0, vceSat: 1.7, ron: 0.03, roff: 1e6 },
    { id: 'IKW40N120', name: 'IKW40N120 (1200V 40A)', type: 'IGBT', vf: 0, vceSat: 1.65, ron: 0.02, roff: 1e6 },
  ],
  TRIAC: [
    { id: 'BT136', name: 'BT136 (600V 4A)', type: 'TRIAC', vf: 1.4, ron: 0.04, roff: 1e6, holdingCurrent: 0.015 },
    { id: 'BTA16', name: 'BTA16 (600V 16A)', type: 'TRIAC', vf: 1.3, ron: 0.02, roff: 1e6, holdingCurrent: 0.04 },
  ],
  IdealSwitch: [
    { id: 'Ideal', name: 'Ideal Zero-Loss Switch', type: 'IdealSwitch', vf: 0, ron: 1e-4, roff: 1e7 },
  ],
};

export function evaluateSwitchState(
  model: SwitchModel,
  vak: number,
  iDevice: number,
  gateSignal: number,
  previousState: SwitchState
): SwitchState {
  switch (model.type) {
    case 'Diode': {
      // Natural diode turn on if forward biased above Vf or ongoing forward current
      if (previousState === 'ON' || previousState === 'FREEWHEELING') {
        return iDevice > 0.001 ? 'ON' : 'OFF';
      }
      return vak > model.vf ? 'ON' : 'OFF';
    }

    case 'Thyristor': {
      // SCR turns on if forward biased AND gate pulse applied
      const holding = model.holdingCurrent || 0.03;
      if (previousState === 'TRIGGERED' || previousState === 'ON') {
        return iDevice > holding ? 'TRIGGERED' : 'OFF';
      }
      if (vak > model.vf && gateSignal > 0.5) {
        return 'TRIGGERED';
      }
      return 'OFF';
    }

    case 'MOSFET': {
      // MOSFET channel conducts when gate signal is active
      if (gateSignal > 0.5) {
        return 'ON';
      }
      // Reverse body diode conducts if vak < -bodyDiodeVf or reverse current
      if (model.bodyDiode && (vak < -(model.bodyDiodeVf || 0.9) || iDevice < -0.01)) {
        return 'FREEWHEELING';
      }
      return 'OFF';
    }

    case 'IGBT': {
      if (gateSignal > 0.5 && vak > (model.vceSat || 1.5)) {
        return 'ON';
      }
      return 'OFF';
    }

    case 'TRIAC': {
      const holding = model.holdingCurrent || 0.04;
      if (previousState === 'TRIGGERED' || previousState === 'ON') {
        return Math.abs(iDevice) > holding ? 'TRIGGERED' : 'OFF';
      }
      if (gateSignal > 0.5 && Math.abs(vak) > model.vf) {
        return 'TRIGGERED';
      }
      return 'OFF';
    }

    case 'IdealSwitch':
    default: {
      return gateSignal > 0.5 ? 'ON' : 'OFF';
    }
  }
}

export function getSwitchVoltageDrop(model: SwitchModel, state: SwitchState, current: number): number {
  if (state === 'OFF' || state === 'BLOCKING') return 0;
  let drop = model.vf;
  if (model.type === 'IGBT') drop = model.vceSat || 1.7;
  if (model.type === 'MOSFET') {
    if (state === 'FREEWHEELING') return -(model.bodyDiodeVf || 0.9);
    drop = 0;
  }
  return drop + Math.abs(current) * model.ron;
}
