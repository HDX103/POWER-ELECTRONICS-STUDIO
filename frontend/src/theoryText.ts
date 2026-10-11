export interface TheoryDoc {
  title: string; principle: string; sequence: string; equations: string[]; applications: string; pros: string; cons: string;
}

const LOAD_EQ = 'L·di/dt + R·i + E = vo      (Z = √(R²+(ωL)²), φ = atan(ωL/R), ωτ = ωL/R)';

export const THEORY: Record<string, TheoryDoc> = {
  halfwave: {
    title: 'Single-phase half-wave rectifier',
    principle: 'One diode conducts only while the source is positive (and larger than the load EMF). With an inductive load the diode keeps conducting after Vs reverses until the current reaches zero (extinction angle β > 180°).',
    sequence: 'D1 ON: θ0 → β (θ0 = asin(E/Vm), β = 180° − θ0 for a resistive load). D1 OFF for the rest of the cycle; vo = E (or decays on the filter capacitor).',
    equations: ['R load: Vo_avg = Vm/π   Vo_rms = Vm/2   Io_avg = Vo_avg/R', LOAD_EQ,
      'R-L load: Vo_avg = Vm(1 − cos β)/(2π),  i(β) = 0   (β from the exponential solution)',
      'With freewheeling diode (E=0): Vo_avg = Vm/π, vo ≥ 0',
      'C filter: conduction starts at θ_b, discharge from tan θ_a = −ωRC;  ΔV = Vm(1 − sin θ_b)'],
    applications: 'Small low-power supplies, signal detection, battery-charger front ends.',
    pros: 'Simplest circuit, one diode.', cons: 'Low Vo_avg (0.318 Vm), high ripple, DC current in the supply (transformer saturation), poor utilisation.',
  },
  fullwave: {
    title: 'Single-phase full-wave (bridge) rectifier',
    principle: 'Four diodes steer both half-cycles into the load in the same direction. D1+D4 conduct while A is positive; D2+D3 while B is positive.',
    sequence: '0° → 180°: D1,D4.  180° → 360°: D2,D3.  With large L the current is continuous and the pairs commutate at the zero crossings.',
    equations: ['R load: Vo_avg = 2Vm/π   Vo_rms = Vm/√2   Io_avg = Vo_avg/R', LOAD_EQ,
      'Continuous (large L): Vo_avg = 2Vm/π, Io ≈ constant, Is = ± Io (square wave): THD ≈ 48.3 %, PF ≈ 0.9',
      'C filter: ΔV ≈ Vm/(2f·R·C) (small ripple); exact value from the tangent/intersection solution'],
    applications: 'General DC power supplies, chargers, motor-drive DC links.',
    pros: 'Twice the DC output of half-wave, no DC in the supply, ripple at 2f.', cons: 'Two diode drops in the path, uncontrolled output.',
  },
  scr_bridge: {
    title: 'Single-phase fully controlled bridge · R-L(-E) load',
    principle: 'Thyristor pairs T1–T4 and T2–T3 are fired α after each zero crossing. A pair stays on until its current reaches zero, so with a large L the bridge briefly inverts (Vo < 0) when α > 0; for α > 90° with E > 0 it regenerates.',
    sequence: 'α → 180°+α: T1,T4.  180°+α → 360°+α: T2,T3 (continuous conduction). With discontinuous current the load idles at Vo = E from the extinction angle β to the next firing.',
    equations: [LOAD_EQ, 'i(θ) = (Vm/Z)·sin(θ−φ) − E/R + K·e^(−(θ−θ0)/ωτ)',
      'Continuous: I0 = −(Vm/Z)·sin(α−φ)·(1+e^(−π/ωτ))/(1−e^(−π/ωτ)) − E/R ≥ 0',
      'Vo_avg = (2Vm/π)·cos α      Vo_rms = Vs_rms      Io_avg = (Vo_avg − E)/R',
      'Discontinuous: Vo_avg = [Vm(cos θ0 − cos β) + E(π − β + θ0)]/π',
      'PF = P/(Vs_rms·Is_rms) = DPF × distortion factor ≈ cos α × 0.9'],
    applications: 'DC-motor drives (4-quadrant), battery charging, electroplating, HVDC converter stations.',
    pros: 'Controllable Vo, regeneration capability.', cons: 'Lagging input PF that worsens with α, low-order current harmonics.',
  },
  semi: {
    title: 'Single-phase semi-converter (half-controlled bridge)',
    principle: 'Two thyristors (T1, T3) in the upper arms and two diodes (D4, D2) in the lower arms. The output voltage can never go negative: after the source reverses, the load current freewheels through one thyristor and one diode (T1 + D2, or T3 + D4) with Vo = 0.',
    sequence: 'α → 180°: T1 + D4 (source feeds the load).  180° → 180°+α: T1 + D2 freewheel (Vo = 0).  180°+α → 360°: T3 + D2 …, then T3 + D4 freewheel.',
    equations: ['Continuous or resistive: Vo_avg = (Vm/π)(1 + cos α)', 'Io_avg = (Vo_avg − E)/R',
      'Vo_rms = Vs_rms·√((π − α)/π + sin(2α)/(2π))', 'Discontinuous (E>0): conduction starts at θ0 = max(α, asin(E/Vm)), ends at β from i(β) = 0'],
    applications: 'Lower-cost DC drives and field supplies where regeneration is not needed.',
    pros: 'Better input PF than the fully controlled bridge for the same Vo, no negative output, fewer thyristors.', cons: 'Single-quadrant, Vo range 0 – 2Vm/π, asymmetrical harmonics.',
  },
  buck: {
    title: 'Buck (step-down) converter',
    principle: 'S1 chops Vin; L and C filter the pulses. While S1 is on, iL ramps up; when it turns off the inductor current freewheels through D1.',
    sequence: '0 → DT: S1 ON, D1 OFF (iL rises).  DT → T: S1 OFF, D1 ON (iL falls). In DCM the diode turns off when iL reaches 0.',
    equations: ['CCM: Vo = D·Vin     IL = Vo/R', 'ΔiL = (Vin − Vo)·D·T/L     ΔVo = ΔiL·T/(8C)', 'Boundary: L_crit = (1 − D)·R·T/2',
      'DCM: Vo/Vin = 2/(1 + √(1 + 4K/D²)),  K = 2L/(R·T)'],
    applications: 'Point-of-load regulators, battery chargers, LED drivers, motor drives.',
    pros: 'Simple, high efficiency, continuous output current.', cons: 'Pulsating input current, output lower than the input only.',
  },
  boost: {
    title: 'Boost (step-up) converter',
    principle: 'While S1 is on the inductor charges from Vin; when S1 opens the inductor current is forced into the output through D1, adding to Vin.',
    sequence: '0 → DT: S1 ON, D1 OFF (iL rises, C feeds the load).  DT → T: S1 OFF, D1 ON (iL falls into C and load).',
    equations: ['CCM: Vo = Vin/(1 − D)     IL = Vo/(R(1 − D))', 'ΔiL = Vin·D·T/L     ΔVo from integrating the capacitor current (≈ Vo·D·T/(R·C) for small ΔiL)',
      'Boundary: L_crit = D(1 − D)²·R·T/2', 'DCM: Vo/Vin = (1 + √(1 + 4D²/K))/2'],
    applications: 'PV/MPPT stages, power-factor correction, battery-to-bus boosters, LED backlights.',
    pros: 'Continuous input current, step-up.', cons: 'Pulsating output current, right-half-plane zero, gain collapses at high D (losses).',
  },
  buckboost: {
    title: 'Buck-boost (inverting) converter',
    principle: 'Energy is stored in L while S1 is on and delivered to the output (reversed polarity) through D1 when S1 opens. Vo can be above or below |Vin|.',
    sequence: '0 → DT: S1 ON, D1 OFF (L charges, C feeds the load).  DT → T: S1 OFF, D1 ON (L discharges into C and load).',
    equations: ['CCM: Vo = −D·Vin/(1 − D)     IL = |Vo|/(R(1 − D))', 'ΔiL = Vin·D·T/L', 'Boundary: L_crit = (1 − D)²·R·T/2', 'DCM: |Vo|/Vin = D/√K,  K = 2L/(R·T)'],
    applications: 'Negative rails from a positive supply, battery systems where Vin spans the output voltage.',
    pros: 'Step-up and step-down with one inductor.', cons: 'Inverted output, pulsating input and output currents, higher device stress (Vin + |Vo|).',
  },
};

const INV_COMMON = [
  'Ideal steady state: Vo(t) = Σ Vn·sin(nωt + θn);  In = Vn / |R + j·nωL|  (each harmonic sees its own impedance)',
  'Vo_rms = √(ΣVn²/2);  Io_rms = √(ΣIn²/2);  THD = √(Σ_{n≥2} Vn²) / V1',
];

THEORY.inv_full = {
  title: 'Single-phase full-bridge inverter (square wave, bipolar and unipolar SPWM)',
  principle: 'Two MOSFET legs, each with an antiparallel body diode, connect the load between mid-points A and B. The body diodes give the inductive load current a path whenever the opposite switch is not yet on (dead time or lagging current), so Vo is set by the switching pattern, not the load.',
  sequence: 'Square: S1,S4 for 180°, then S2,S3 (Vo = ±Vdc).  Bipolar SPWM: S1,S4 while Vref > carrier, otherwise S2,S3 (Vo = ±Vdc at fc).  Unipolar SPWM: leg A compares +Vref, leg B compares −Vref, so Vo ∈ {+Vdc, 0, −Vdc} and the effective ripple frequency is 2fc.',
  equations: [
    'ma = V_ref,peak / V_carrier,peak;   mf = fc / fm',
    'Square:   V1 = 4·Vdc/π,   Vo_rms = Vdc,   Vn = V1/n (odd n),   THD ≈ 48.3 %',
    'Bipolar:  V1 = ma·Vdc (ma ≤ 1),   Vo_rms = Vdc,   harmonics at mf ± 2, 2mf ± 1, …',
    'Unipolar: V1 = ma·Vdc (ma ≤ 1),   Vo_rms = Vdc·√(2·ma/π),   harmonics start near 2mf',
    ...INV_COMMON, 'Over-modulation (ma > 1): V1 saturates toward 4Vdc/π and low-order harmonics appear.'],
  applications: 'UPS and standalone AC supplies, motor drives, grid-tied inverters (single-phase), induction heating.',
  pros: 'Full Vdc swing (twice a half-bridge), unipolar SPWM halves the filter size for the same fc, easy amplitude and frequency control.',
  cons: 'Four switches and drivers, dead time distorts the output, switching losses grow with fc, shoot-through risk if gating overlaps.',
};

THEORY.inv_half = {
  title: 'Single-phase half-bridge inverter (square wave and SPWM)',
  principle: 'One MOSFET leg across a split DC link (two Vdc/2 sources, shown ideal). The load connects between the leg mid-point and the DC-link mid-point, so Vo swings ±Vdc/2. Body diodes feed back the reactive current of the load.',
  sequence: 'Square: S1 for 180° (Vo = +Vdc/2), then S2 for 180° (−Vdc/2).  SPWM: S1 on while Vref > carrier, S2 on otherwise (complementary).',
  equations: ['Square: V1 = 2·Vdc/π,   Vo_rms = Vdc/2,   THD ≈ 48.3 %', 'SPWM: V1 = ma·Vdc/2 (ma ≤ 1),   Vo_rms = Vdc/2', ...INV_COMMON,
    'Each device blocks Vdc; the DC-link capacitors see the load-current ripple at the output frequency.'],
  applications: 'Low-power inverters, resonant/induction heating, audio class-D stages.',
  pros: 'Only two switches, simple drive.', cons: 'Output limited to Vdc/2, needs a split supply or two large capacitors, device voltage stress = Vdc.',
};
