import { ControlParams, DerivationStep, LoadParams, SourceParams, TheoryModel } from '../types';

export function getTheoryModel(
  topologyId: string,
  source: SourceParams,
  load: LoadParams,
  control: ControlParams
): TheoryModel {
  const vrms = source.vrms || 230;
  const vm = Math.SQRT2 * vrms;
  const R = Math.max(0.1, load.R || 10);
  const alphaDeg = control.alpha ?? 0;
  const alphaRad = (alphaDeg * Math.PI) / 180;
  const duty = control.duty ?? 0.5;
  const vin = source.vdc || 24;
  const ma = control.ma ?? 0.8;

  let formulaVdc = 'V_{dc} = 0';
  let formulaVrms = 'V_{rms} = 0';
  let formulaIdc = 'I_{dc} = 0';
  let theoryVdc = 0;
  let theoryVrms = 0;
  let theoryIdc = 0;
  const steps: DerivationStep[] = [];
  const notes: string[] = [];

  switch (topologyId) {
    case 'acdc_1ph_half_wave': {
      if (alphaDeg === 0) {
        // Uncontrolled 1-phase half-wave diode
        formulaVdc = 'V_{dc} = \\frac{V_m}{\\pi} \\approx 0.318 V_m';
        formulaVrms = 'V_{rms} = \\frac{V_m}{2} = 0.5 V_m';
        formulaIdc = 'I_{dc} = \\frac{V_{dc}}{R}';
        theoryVdc = vm / Math.PI;
        theoryVrms = vm / 2;
        theoryIdc = theoryVdc / R;

        steps.push(
          {
            title: '1. Peak Source Voltage',
            latex: 'V_m = \\sqrt{2} \\times V_{rms}',
            substituted: `V_m = \\sqrt{2} \\times ${vrms} = ${vm.toFixed(2)}\\text{ V}`,
            result: `${vm.toFixed(2)} V`,
          },
          {
            title: '2. Average DC Output Voltage',
            latex: 'V_{dc} = \\frac{1}{2\\pi} \\int_0^\\pi V_m \\sin(\\omega t) d(\\omega t) = \\frac{V_m}{\\pi}',
            substituted: `V_{dc} = \\frac{${vm.toFixed(2)}}{\\pi} = ${theoryVdc.toFixed(2)}\\text{ V}`,
            result: `${theoryVdc.toFixed(2)} V`,
          },
          {
            title: '3. RMS Output Voltage',
            latex: 'V_{rms} = \\sqrt{\\frac{1}{2\\pi} \\int_0^\\pi V_m^2 \\sin^2(\\omega t) d(\\omega t)} = \\frac{V_m}{2}',
            substituted: `V_{rms} = \\frac{${vm.toFixed(2)}}{2} = ${theoryVrms.toFixed(2)}\\text{ V}`,
            result: `${theoryVrms.toFixed(2)} V`,
          },
          {
            title: '4. Average DC Load Current',
            latex: 'I_{dc} = \\frac{V_{dc}}{R}',
            substituted: `I_{dc} = \\frac{${theoryVdc.toFixed(2)}}{${R}} = ${theoryIdc.toFixed(2)}\\text{ A}`,
            result: `${theoryIdc.toFixed(2)} A`,
          }
        );
        notes.push('Diode conducts during positive half-cycle (0 to π) and blocks during negative half-cycle.');
      } else {
        // Controlled 1-phase half-wave SCR
        formulaVdc = 'V_{dc} = \\frac{V_m}{2\\pi} (1 + \\cos\\alpha)';
        formulaVrms = 'V_{rms} = \\frac{V_m}{2} \\sqrt{1 - \\frac{\\alpha}{\\pi} + \\frac{\\sin(2\\alpha)}{2\\pi}}';
        formulaIdc = 'I_{dc} = \\frac{V_{dc}}{R}';
        theoryVdc = (vm / (2 * Math.PI)) * (1 + Math.cos(alphaRad));
        const vrmsFactor = Math.sqrt(Math.max(0, 1 - alphaRad / Math.PI + Math.sin(2 * alphaRad) / (2 * Math.PI)));
        theoryVrms = (vm / 2) * vrmsFactor;
        theoryIdc = theoryVdc / R;

        steps.push(
          {
            title: '1. Peak Source Voltage',
            latex: 'V_m = \\sqrt{2} \\times V_{rms}',
            substituted: `V_m = \\sqrt{2} \\times ${vrms} = ${vm.toFixed(2)}\\text{ V}`,
            result: `${vm.toFixed(2)} V`,
          },
          {
            title: '2. Average DC Output Voltage with Firing Angle α',
            latex: 'V_{dc} = \\frac{1}{2\\pi} \\int_\\alpha^\\pi V_m \\sin(\\omega t) d(\\omega t) = \\frac{V_m}{2\\pi}(1 + \\cos\\alpha)',
            substituted: `V_{dc} = \\frac{${vm.toFixed(2)}}{2\\pi}(1 + \\cos(${alphaDeg}^\\circ)) = ${theoryVdc.toFixed(2)}\\text{ V}`,
            result: `${theoryVdc.toFixed(2)} V`,
          },
          {
            title: '3. RMS Output Voltage',
            latex: 'V_{rms} = \\frac{V_m}{2} \\sqrt{1 - \\frac{\\alpha}{\\pi} + \\frac{\\sin(2\\alpha)}{2\\pi}}',
            substituted: `V_{rms} = \\frac{${vm.toFixed(2)}}{2} \\times ${vrmsFactor.toFixed(3)} = ${theoryVrms.toFixed(2)}\\text{ V}`,
            result: `${theoryVrms.toFixed(2)} V`,
          }
        );
        notes.push(`Thyristor triggered at α = ${alphaDeg}° and commutates at zero crossing π.`);
      }
      break;
    }

    case 'acdc_1ph_full_bridge': {
      if (alphaDeg === 0) {
        // Full wave diode bridge
        formulaVdc = 'V_{dc} = \\frac{2V_m}{\\pi} \\approx 0.636 V_m';
        formulaVrms = 'V_{rms} = \\frac{V_m}{\\sqrt{2}} = V_{rms,in}';
        formulaIdc = 'I_{dc} = \\frac{V_{dc}}{R}';
        theoryVdc = (2 * vm) / Math.PI;
        theoryVrms = vm / Math.SQRT2;
        theoryIdc = theoryVdc / R;

        steps.push(
          {
            title: '1. Peak Voltage',
            latex: 'V_m = \\sqrt{2} V_{rms}',
            substituted: `V_m = \\sqrt{2} \\times ${vrms} = ${vm.toFixed(2)}\\text{ V}`,
            result: `${vm.toFixed(2)} V`,
          },
          {
            title: '2. Full-Wave Average Output Voltage',
            latex: 'V_{dc} = \\frac{2}{\\pi} \\int_0^\\pi V_m \\sin(\\omega t) d(\\omega t) = \\frac{2 V_m}{\\pi}',
            substituted: `V_{dc} = \\frac{2 \\times ${vm.toFixed(2)}}{\\pi} = ${theoryVdc.toFixed(2)}\\text{ V}`,
            result: `${theoryVdc.toFixed(2)} V`,
          },
          {
            title: '3. Full-Wave RMS Output Voltage',
            latex: 'V_{rms} = \\frac{V_m}{\\sqrt{2}}',
            substituted: `V_{rms} = ${theoryVrms.toFixed(2)}\\text{ V}`,
            result: `${theoryVrms.toFixed(2)} V`,
          }
        );
      } else {
        // Fully-controlled 1-phase bridge
        formulaVdc = 'V_{dc} = \\frac{2V_m}{\\pi} \\cos\\alpha';
        formulaVrms = 'V_{rms} = \\frac{V_m}{\\sqrt{2}} \\sqrt{1 + \\frac{\\sin(2\\alpha)}{2\\pi}}';
        formulaIdc = 'I_{dc} = \\frac{V_{dc}}{R}';
        // For continuous conduction:
        theoryVdc = ((2 * vm) / Math.PI) * Math.cos(alphaRad);
        theoryVrms = (vm / Math.SQRT2);
        theoryIdc = theoryVdc / R;

        steps.push(
          {
            title: '1. Full-Bridge Controlled Average Voltage',
            latex: 'V_{dc} = \\frac{1}{\\pi} \\int_\\alpha^{\\pi+\\alpha} V_m \\sin(\\omega t) d(\\omega t) = \\frac{2V_m}{\\pi}\\cos\\alpha',
            substituted: `V_{dc} = \\frac{2 \\times ${vm.toFixed(2)}}{\\pi} \\cos(${alphaDeg}^\\circ) = ${theoryVdc.toFixed(2)}\\text{ V}`,
            result: `${theoryVdc.toFixed(2)} V`,
          },
          {
            title: '2. Inversion Boundary Check',
            latex: '\\text{Quadrant I Rectification: } 0^\\circ \\le \\alpha \\le 90^\\circ, \\quad \\text{Quadrant IV Inversion: } 90^\\circ < \\alpha < 180^\\circ',
            substituted: `\\alpha = ${alphaDeg}^\\circ \\rightarrow ${alphaDeg <= 90 ? '\\text{Rectifier Mode (Power AC to DC)}' : '\\text{Inversion Mode (Power DC to AC)}'}`,
            result: alphaDeg <= 90 ? 'Rectification' : 'Inversion',
          }
        );
      }
      break;
    }

    case 'acdc_1ph_semi': {
      // Single-phase semi-converter
      formulaVdc = 'V_{dc} = \\frac{V_m}{\\pi} (1 + \\cos\\alpha)';
      formulaVrms = 'V_{rms} = \\frac{V_m}{\\sqrt{2}} \\sqrt{1 - \\frac{\\alpha}{\\pi} + \\frac{\\sin(2\\alpha)}{2\\pi}}';
      formulaIdc = 'I_{dc} = \\frac{V_{dc}}{R}';
      theoryVdc = (vm / Math.PI) * (1 + Math.cos(alphaRad));
      const factor = Math.sqrt(Math.max(0, 1 - alphaRad / Math.PI + Math.sin(2 * alphaRad) / (2 * Math.PI)));
      theoryVrms = (vm / Math.SQRT2) * factor;
      theoryIdc = theoryVdc / R;

      steps.push(
        {
          title: '1. Semi-Converter Average DC Output',
          latex: 'V_{dc} = \\frac{1}{\\pi} \\int_\\alpha^\\pi V_m \\sin(\\omega t) d(\\omega t) = \\frac{V_m}{\\pi}(1 + \\cos\\alpha)',
          substituted: `V_{dc} = \\frac{${vm.toFixed(2)}}{\\pi}(1 + \\cos(${alphaDeg}^\\circ)) = ${theoryVdc.toFixed(2)}\\text{ V}`,
          result: `${theoryVdc.toFixed(2)} V`,
        },
        {
          title: '2. Freewheeling Action',
          latex: '\\text{At } \\omega t = \\pi, \\text{ load voltage is clamped to zero by diodes while load current freewheels.}',
          substituted: 'Intrinsic freewheeling prevents negative voltage spikes, maintaining unipolar output.',
          result: 'Zero negative excursion',
        }
      );
      break;
    }

    case 'acdc_3ph_half_wave': {
      // 3-Phase Half-Wave (3-Pulse)
      formulaVdc = 'V_{dc} = \\frac{3\\sqrt{3} V_{m,ph}}{2\\pi} \\cos\\alpha';
      formulaVrms = 'V_{rms} = V_{m,ph} \\sqrt{\\frac{3}{2\\pi} (\\frac{\\pi}{3} + \\frac{\\sqrt{3}}{4}\\cos(2\\alpha))}';
      formulaIdc = 'I_{dc} = \\frac{V_{dc}}{R}';
      theoryVdc = ((3 * Math.sqrt(3) * vm) / (2 * Math.PI)) * Math.cos(alphaRad);
      theoryVrms = vm * Math.sqrt((3 / (2 * Math.PI)) * (Math.PI / 3 + (Math.sqrt(3) / 4) * Math.cos(2 * alphaRad)));
      theoryIdc = theoryVdc / R;

      steps.push(
        {
          title: '1. Phase Peak Voltage',
          latex: 'V_{m,ph} = \\sqrt{2} \\times V_{rms,ph}',
          substituted: `V_{m,ph} = \\sqrt{2} \\times ${vrms} = ${vm.toFixed(2)}\\text{ V}`,
          result: `${vm.toFixed(2)} V`,
        },
        {
          title: '2. 3-Pulse Controlled DC Voltage',
          latex: 'V_{dc} = \\frac{3}{2\\pi} \\int_{\\pi/6+\\alpha}^{5\\pi/6+\\alpha} V_{m,ph} \\sin(\\omega t) d(\\omega t) = \\frac{3\\sqrt{3}V_{m,ph}}{2\\pi}\\cos\\alpha',
          substituted: `V_{dc} = \\frac{3\\sqrt{3} \\times ${vm.toFixed(2)}}{2\\pi} \\cos(${alphaDeg}^\\circ) = ${theoryVdc.toFixed(2)}\\text{ V}`,
          result: `${theoryVdc.toFixed(2)} V`,
        }
      );
      break;
    }

    case 'acdc_3ph_full_bridge': {
      // 3-Phase Full-Bridge 6-Pulse Converter
      const vL_rms = Math.sqrt(3) * vrms;
      const vL_m = Math.SQRT2 * vL_rms;
      formulaVdc = 'V_{dc} = \\frac{3 V_{m,LL}}{\\pi} \\cos\\alpha = \\frac{3\\sqrt{3} V_{m,ph}}{\\pi} \\cos\\alpha';
      formulaVrms = 'V_{rms} = V_{m,LL} \\sqrt{\\frac{1}{2} + \\frac{3\\sqrt{3}}{4\\pi}\\cos(2\\alpha)}';
      formulaIdc = 'I_{dc} = \\frac{V_{dc}}{R}';
      theoryVdc = ((3 * vL_m) / Math.PI) * Math.cos(alphaRad);
      theoryVrms = vL_m * Math.sqrt(0.5 + ((3 * Math.sqrt(3)) / (4 * Math.PI)) * Math.cos(2 * alphaRad));
      theoryIdc = theoryVdc / R;

      steps.push(
        {
          title: '1. Line-to-Line Peak Voltage',
          latex: 'V_{m,LL} = \\sqrt{3} \\times \\sqrt{2} \\times V_{rms,ph} = \\sqrt{6} \\times V_{rms,ph}',
          substituted: `V_{m,LL} = \\sqrt{6} \\times ${vrms} = ${vL_m.toFixed(2)}\\text{ V}`,
          result: `${vL_m.toFixed(2)} V`,
        },
        {
          title: '2. 6-Pulse Full-Bridge Average Output',
          latex: 'V_{dc} = \\frac{3}{\\pi} \\int_{-\\pi/6+\\alpha}^{\\pi/6+\\alpha} V_{m,LL} \\cos(\\omega t) d(\\omega t) = \\frac{3 V_{m,LL}}{\\pi} \\cos\\alpha',
          substituted: `V_{dc} = \\frac{3 \\times ${vL_m.toFixed(2)}}{\\pi} \\cos(${alphaDeg}^\\circ) = ${theoryVdc.toFixed(2)}\\text{ V}`,
          result: `${theoryVdc.toFixed(2)} V`,
        },
        {
          title: '3. Ripple Frequency',
          latex: 'f_{ripple} = 6 \\times f_s',
          substituted: `f_{ripple} = 6 \\times ${source.freq || 50} = ${6 * (source.freq || 50)}\\text{ Hz}`,
          result: `${6 * (source.freq || 50)} Hz`,
        }
      );
      break;
    }

    case 'dcdc_buck': {
      // Buck Converter
      formulaVdc = 'V_o = D \\times V_{in}';
      formulaVrms = 'V_{o,rms} \\approx V_o';
      formulaIdc = 'I_o = \\frac{V_o}{R}';
      theoryVdc = duty * vin;
      theoryVrms = theoryVdc;
      theoryIdc = theoryVdc / R;
      const fsw = control.fsw || 20000;
      const L = load.L || 1e-3;
      const deltaIL = ((vin - theoryVdc) * duty) / (fsw * L);
      const Lcrit = ((1 - duty) * R) / (2 * fsw);

      steps.push(
        {
          title: '1. Voltage Conversion Ratio (CCM)',
          latex: 'V_o = D \\times V_{in}',
          substituted: `V_o = ${duty} \\times ${vin}\\text{ V} = ${theoryVdc.toFixed(2)}\\text{ V}`,
          result: `${theoryVdc.toFixed(2)} V`,
        },
        {
          title: '2. Inductor Current Ripple ΔI_L',
          latex: '\\Delta I_L = \\frac{(V_{in} - V_o) D}{f_{sw} L}',
          substituted: `\\Delta I_L = \\frac{(${vin} - ${theoryVdc.toFixed(2)}) \\times ${duty}}{${fsw} \\times ${L}} = ${deltaIL.toFixed(3)}\\text{ A}`,
          result: `${deltaIL.toFixed(3)} A`,
        },
        {
          title: '3. Critical Inductance for Continuous Conduction Mode',
          latex: 'L_{crit} = \\frac{(1 - D) R}{2 f_{sw}}',
          substituted: `L_{crit} = \\frac{(1 - ${duty}) \\times ${R}}{2 \\times ${fsw}} = ${(Lcrit * 1000).toFixed(3)}\\text{ mH}`,
          result: `${(Lcrit * 1000).toFixed(3)} mH`,
        }
      );
      notes.push(L >= Lcrit ? 'Operating in Continuous Conduction Mode (CCM).' : 'Operating in Discontinuous Conduction Mode (DCM).');
      break;
    }

    case 'dcdc_boost': {
      // Boost Converter
      formulaVdc = 'V_o = \\frac{V_{in}}{1 - D}';
      formulaVrms = 'V_{o,rms} \\approx V_o';
      formulaIdc = 'I_o = \\frac{V_o}{R}';
      const safeD = Math.min(0.92, duty);
      theoryVdc = vin / (1 - safeD);
      theoryVrms = theoryVdc;
      theoryIdc = theoryVdc / R;
      const fsw = control.fsw || 20000;
      const L = load.L || 1e-3;
      const deltaIL = (vin * safeD) / (fsw * L);

      steps.push(
        {
          title: '1. Boost Conversion Ratio (CCM)',
          latex: 'V_o = \\frac{V_{in}}{1 - D}',
          substituted: `V_o = \\frac{${vin}}{1 - ${safeD}} = ${theoryVdc.toFixed(2)}\\text{ V}`,
          result: `${theoryVdc.toFixed(2)} V`,
        },
        {
          title: '2. Average Source Input Current',
          latex: 'I_{in} = \\frac{I_o}{1 - D}',
          substituted: `I_{in} = \\frac{${theoryIdc.toFixed(2)}}{1 - ${safeD}} = ${(theoryIdc / (1 - safeD)).toFixed(2)}\\text{ A}`,
          result: `${(theoryIdc / (1 - safeD)).toFixed(2)} A`,
        },
        {
          title: '3. Inductor Ripple Current',
          latex: '\\Delta I_L = \\frac{V_{in} D}{f_{sw} L}',
          substituted: `\\Delta I_L = \\frac{${vin} \\times ${safeD}}{${fsw} \\times ${L}} = ${deltaIL.toFixed(3)}\\text{ A}`,
          result: `${deltaIL.toFixed(3)} A`,
        }
      );
      break;
    }

    case 'dcdc_buck_boost': {
      // Buck-Boost Converter (Inverting)
      formulaVdc = 'V_o = -\\frac{D}{1 - D} V_{in}';
      formulaVrms = 'V_{o,rms} \\approx |V_o|';
      formulaIdc = 'I_o = \\frac{|V_o|}{R}';
      const safeD = Math.min(0.9, duty);
      theoryVdc = -(safeD / (1 - safeD)) * vin;
      theoryVrms = Math.abs(theoryVdc);
      theoryIdc = theoryVrms / R;

      steps.push(
        {
          title: '1. Inverting Buck-Boost Conversion Ratio',
          latex: 'V_o = -\\frac{D}{1 - D} V_{in}',
          substituted: `V_o = -\\frac{${safeD}}{1 - ${safeD}} \\times ${vin} = ${theoryVdc.toFixed(2)}\\text{ V}`,
          result: `${theoryVdc.toFixed(2)} V`,
        },
        {
          title: '2. Mode Transition Point',
          latex: 'D < 0.5 \\rightarrow \\text{Buck (Step-down)}, \\quad D > 0.5 \\rightarrow \\text{Boost (Step-up)}',
          substituted: `D = ${safeD} \\rightarrow ${safeD < 0.5 ? '\\text{Step-down mode}' : safeD > 0.5 ? '\\text{Step-up mode}' : '\\text{1:1 unity transfer}'}`,
          result: safeD < 0.5 ? 'Step-Down' : safeD > 0.5 ? 'Step-Up' : 'Unity',
        }
      );
      break;
    }

    case 'dcac_full_bridge': {
      // Single-phase full-bridge inverter
      formulaVdc = 'V_{o1,rms} = \\frac{4 V_{in}}{\\pi \\sqrt{2}} \\approx 0.90 V_{in} \\text{ (Square)}';
      formulaVrms = 'V_{o,rms} = V_{in} \\text{ (Square)}, \\quad \\frac{m_a V_{in}}{\\sqrt{2}} \\text{ (SPWM)}';
      formulaIdc = 'I_{o,rms} = \\frac{V_{o,rms}}{Z}';
      if (control.modulationType === 'spwm_bipolar' || control.modulationType === 'spwm_unipolar') {
        theoryVrms = (ma * vin) / Math.SQRT2;
        theoryVdc = 0; // AC output
        theoryIdc = theoryVrms / R;
        steps.push(
          {
            title: '1. SPWM Fundamental RMS Voltage',
            latex: 'V_{o1,rms} = \\frac{m_a V_{in}}{\\sqrt{2}}',
            substituted: `V_{o1,rms} = \\frac{${ma} \\times ${vin}}{\\sqrt{2}} = ${theoryVrms.toFixed(2)}\\text{ V}`,
            result: `${theoryVrms.toFixed(2)} V`,
          },
          {
            title: '2. Peak Fundamental Output',
            latex: 'V_{o1,peak} = m_a \\times V_{in}',
            substituted: `V_{o1,peak} = ${ma} \\times ${vin} = ${(ma * vin).toFixed(2)}\\text{ V}`,
            result: `${(ma * vin).toFixed(2)} V`,
          }
        );
      } else {
        theoryVrms = vin;
        const v1_rms = (4 * vin) / (Math.PI * Math.SQRT2);
        theoryVdc = 0;
        theoryIdc = theoryVrms / R;
        steps.push(
          {
            title: '1. Full-Bridge Square-Wave RMS Output',
            latex: 'V_{o,rms} = V_{in}',
            substituted: `V_{o,rms} = ${vin}\\text{ V}`,
            result: `${vin} V`,
          },
          {
            title: '2. Fundamental Component RMS',
            latex: 'V_{o1,rms} = \\frac{4 V_{in}}{\\pi\\sqrt{2}}',
            substituted: `V_{o1,rms} = \\frac{4 \\times ${vin}}{\\pi \\sqrt{2}} = ${v1_rms.toFixed(2)}\\text{ V}`,
            result: `${v1_rms.toFixed(2)} V`,
          }
        );
      }
      break;
    }

    case 'acac_1ph_controller': {
      // Single-phase AC voltage controller
      formulaVdc = 'V_{dc} = 0 \\text{ (Symmetric AC)}';
      formulaVrms = 'V_{o,rms} = V_s \\sqrt{1 - \\frac{\\alpha}{\\pi} + \\frac{\\sin(2\\alpha)}{2\\pi}}';
      formulaIdc = 'I_{o,rms} = \\frac{V_{o,rms}}{R}';
      theoryVdc = 0;
      const acFactor = Math.sqrt(Math.max(0, 1 - alphaRad / Math.PI + Math.sin(2 * alphaRad) / (2 * Math.PI)));
      theoryVrms = vrms * acFactor;
      theoryIdc = theoryVrms / R;

      steps.push(
        {
          title: '1. AC Voltage Controller RMS Output Voltage',
          latex: 'V_{o,rms} = V_s \\sqrt{1 - \\frac{\\alpha}{\\pi} + \\frac{\\sin(2\\alpha)}{2\\pi}}',
          substituted: `V_{o,rms} = ${vrms} \\times \\sqrt{1 - \\frac{${alphaDeg}^\\circ}{180^\\circ} + \\frac{\\sin(${2 * alphaDeg}^\\circ)}{2\\pi}} = ${theoryVrms.toFixed(2)}\\text{ V}`,
          result: `${theoryVrms.toFixed(2)} V`,
        },
        {
          title: '2. Power Delivered to Load',
          latex: 'P = \\frac{V_{o,rms}^2}{R}',
          substituted: `P = \\frac{${theoryVrms.toFixed(2)}^2}{${R}} = ${((theoryVrms * theoryVrms) / R).toFixed(1)}\\text{ W}`,
          result: `${((theoryVrms * theoryVrms) / R).toFixed(1)} W`,
        },
        {
          title: '3. Input Power Factor',
          latex: 'PF = \\sqrt{1 - \\frac{\\alpha}{\\pi} + \\frac{\\sin(2\\alpha)}{2\\pi}}',
          substituted: `PF = ${acFactor.toFixed(3)}`,
          result: acFactor.toFixed(3),
        }
      );
      break;
    }

    default: {
      theoryVdc = (2 * vm) / Math.PI;
      theoryVrms = vm / Math.SQRT2;
      theoryIdc = theoryVdc / R;
      steps.push({
        title: 'Nominal Calculation',
        latex: 'V_{dc} = \\frac{2V_m}{\\pi}',
        substituted: `${theoryVdc.toFixed(2)} V`,
        result: `${theoryVdc.toFixed(2)} V`,
      });
    }
  }

  const theoryFf = theoryVdc !== 0 ? theoryVrms / Math.abs(theoryVdc) : 1;
  const theoryRf = Math.sqrt(Math.max(0, theoryFf * theoryFf - 1));
  const theoryEff = theoryVdc !== 0 ? ((theoryVdc * theoryIdc) / (theoryVrms * (theoryIdc || 1))) * 100 : 100;

  return {
    formulaVdc,
    formulaVrms,
    formulaIdc,
    theoryVdc: Number(theoryVdc.toFixed(2)),
    theoryVrms: Number(theoryVrms.toFixed(2)),
    theoryIdc: Number(theoryIdc.toFixed(2)),
    theoryEff: Number(Math.min(100, Math.max(0, theoryEff)).toFixed(1)),
    theoryRf: Number(theoryRf.toFixed(3)),
    theoryFf: Number(theoryFf.toFixed(3)),
    derivationSteps: steps,
    operationNotes: notes,
  };
}
