export type ConverterFamily = 'AC-DC' | 'DC-DC' | 'DC-AC' | 'AC-AC';

export type SwitchType = 'Diode' | 'Thyristor' | 'MOSFET' | 'IGBT' | 'TRIAC' | 'IdealSwitch';

export type SwitchState = 'ON' | 'OFF' | 'TRIGGERED' | 'FREEWHEELING' | 'BLOCKING';

export interface SwitchModel {
  id: string;
  name: string;
  type: SwitchType;
  vf: number;          // Forward voltage drop (V)
  ron: number;         // On-state resistance (Ohm)
  roff: number;        // Off-state resistance (Ohm)
  vceSat?: number;     // Vce sat for IGBT (V)
  holdingCurrent?: number; // Holding current for SCR/TRIAC (A)
  latchingCurrent?: number;
  bodyDiode?: boolean; // For MOSFET
  bodyDiodeVf?: number;
  trr?: number;        // Reverse recovery time (s)
}

export type LoadType = 'R' | 'RL' | 'RLE' | 'RC' | 'RLC';

export interface LoadParams {
  type: LoadType;
  R: number;           // Resistance (Ohms)
  L: number;           // Inductance (H)
  E: number;           // Back-EMF / battery DC voltage (V)
  C: number;           // Capacitance (F)
  fwd: boolean;        // Freewheeling diode present?
}

export interface SourceParams {
  type: 'AC_1PH' | 'AC_3PH' | 'DC';
  vrms?: number;       // RMS voltage for AC (V)
  freq?: number;       // AC frequency (Hz)
  phases?: 1 | 3;
  vdc?: number;        // DC input voltage (V)
  Ls?: number;         // Source inductance (H)
}

export type InverterModulation = 'square' | 'spwm_bipolar' | 'spwm_unipolar' | 'six_step_180' | 'six_step_120';

export interface ControlParams {
  alpha?: number;      // Firing angle in degrees (0 to 180)
  extinctionBeta?: number; // Extinction angle in degrees
  duty?: number;       // Duty cycle for DC-DC (0 to 1)
  fsw?: number;        // Switching frequency (Hz)
  ma?: number;         // Amplitude modulation index for PWM (0 to 1)
  mf?: number;         // Frequency modulation ratio (carrier/reference)
  deadTime?: number;   // Dead time in microseconds
  modulationType?: InverterModulation;
  frequencyDivision?: 2 | 3 | 4; // For Cycloconverter
  conductionCycles?: number;     // For AC on-off controller
  extinctionCycles?: number;
  turnsRatio?: number;           // Transformer turns ratio Ns/Np for isolated converters
}

export interface MetricResults {
  vdc: number;
  vrms: number;
  idc: number;
  irms: number;
  pavg: number;
  sapp: number;
  pf: number;
  rf: number;
  ff: number;
  eff: number;
  thd_v: number;
  thd_i: number;
  df: number;
}

export interface FFTResults {
  orders: number[];
  frequencies: number[];
  voltages: number[];
  currents: number[];
  voltagesPct: number[];
  currentsPct: number[];
}

export interface DerivationStep {
  title: string;
  latex: string;
  substituted: string;
  result: string;
}

export interface TheoryModel {
  formulaVdc: string;
  formulaVrms: string;
  formulaIdc: string;
  formulaThd?: string;
  theoryVdc: number;
  theoryVrms: number;
  theoryIdc: number;
  theoryEff: number;
  theoryRf: number;
  theoryFf: number;
  derivationSteps: DerivationStep[];
  operationNotes: string[];
}

export interface SimulationResult {
  time: number[];
  period: number;
  timeUnit: 'ms' | 'us' | 's';
  signals: {
    vs?: number[];      // Primary AC supply
    vs_b?: number[];    // 3-phase phase B
    vs_c?: number[];    // 3-phase phase C
    vin?: number[];     // DC input
    vo: number[];       // Output voltage
    io: number[];       // Output current
    is?: number[];      // Input source current
    iL?: number[];      // Inductor current
    vC?: number[];      // Capacitor voltage
    vsw?: number[];     // Switch voltage
    ifwd?: number[];    // Freewheeling diode current
    gate1?: number[];   // Gate 1 / firing pulses
    gate2?: number[];   // Gate 2
    carrier?: number[]; // PWM carrier wave
    reference?: number[]; // PWM reference wave
  };
  deviceStates: Record<string, SwitchState[]>;
  activePaths: Record<string, boolean>[]; // active path flags per time index
  metrics: MetricResults;
  fft: FFTResults;
  theory: TheoryModel;
}

export interface DeviceSlot {
  id: string;
  label: string;
  defaultType: SwitchType;
  allowedTypes: SwitchType[];
}

export interface TopologyDefinition {
  id: string;
  name: string;
  family: ConverterFamily;
  subCategory: string;
  description: string;
  deviceSlots: DeviceSlot[];
  defaultSource: SourceParams;
  defaultLoad: LoadParams;
  defaultControl: ControlParams;
  schematicId: string;
}
