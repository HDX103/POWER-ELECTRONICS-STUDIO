"""Topology registry. Each entry: netlist builder (the circuit graph), probes, theory, UI schema.

Adding a topology = one builder + probes + theory + schema entry; the solver is untouched.
"""
import numpy as np
from .engine import v, branch_i, switch_i
from .analysis import scr_bridge_theory
from .theory import halfwave_theory, semi_theory, filter_theory, dc_theory, inverter_theory

TH = {'Ron': 1e-2, 'Roff': 1e7, 'Ihold': 0.0}
DI = {'Ron': 1e-2, 'Roff': 1e7}


# ----------------------------------------------------------------- shared load stage
def _load(p, comps, top='P'):
    """R [-L] [-E] to ground, optional filter C across the output, optional freewheeling diode.
    Returns the node at the far side of R (used to measure the load current)."""
    E, l = float(p.get('E', 0.0)), float(p.get('l', 0.0))
    after_r = 'M' if l > 0 else ('Q' if E else '0')
    comps.append({'id': 'R1', 'type': 'resistor', 'nodes': [top, after_r], 'params': {'resistance': p['r']}})
    if l > 0:
        comps.append({'id': 'L1', 'type': 'inductor', 'nodes': ['M', 'Q' if E else '0'], 'params': {'inductance': l, 'i0': 0.0}})
    if E:
        comps.append({'id': 'E1', 'type': 'dc_voltage_source', 'nodes': ['Q', '0'], 'params': {'voltage': E}})
    if float(p.get('c_uf', 0)) > 0:
        comps.append({'id': 'C1', 'type': 'capacitor', 'nodes': [top, '0'], 'params': {'capacitance': p['c_uf'] * 1e-6}})
    if p.get('fwd'):
        comps.append({'id': 'D5', 'type': 'diode', 'nodes': ['0', top], 'params': dict(DI)})
    return after_r


def _firing(p, outputs):
    return [{'id': 'FC1', 'type': 'firing_controller',
             'params': {'alpha_deg': p.get('alpha_deg', 0.0), 'pulse_deg': p.get('pulse_deg', 30.0),
                        'frequency': p['freq'], 'outputs': outputs}}]


def _src(p, neg):
    return {'id': 'Vs', 'type': 'ac_voltage_source', 'nodes': ['A', neg],
            'params': {'rms': p['vs_rms'], 'frequency': p['freq'], 'phase': 0.0}}


# ----------------------------------------------------------------- AC builders
def build_halfwave(p):
    comps = [_src(p, '0'), {'id': 'D1', 'type': 'diode', 'nodes': ['A', 'P'], 'params': dict(DI)}]
    io = _load(p, comps)
    return {'name': 'Single-phase half-wave rectifier', 'ground': '0', 'components': comps, 'controls': [], 'meta': {'io_node': io, 'src_neg': '0'}}


def _bridge(p, upper, lower, gates):
    """upper: kinds for (A->P, B->P); lower: kinds for (0->B, 0->A).  kind 'T' thyristor / 'D' diode."""
    def dev(i, kind, a, k, gate=None):
        if kind == 'T':
            return {'id': f'T{i}', 'type': 'thyristor', 'nodes': [a, k], 'params': {**TH, 'gate': gate}}
        return {'id': f'D{i}', 'type': 'diode', 'nodes': [a, k], 'params': dict(DI)}
    comps = [_src(p, 'B'), dev(1, upper[0], 'A', 'P', gates[0]), dev(3, upper[1], 'B', 'P', gates[1]),
             dev(4, lower[0], '0', 'B', gates[0]), dev(2, lower[1], '0', 'A', gates[1])]
    io = _load(p, comps)
    return comps, io


def build_fullwave(p):
    comps, io = _bridge(p, 'DD', 'DD', (None, None))
    return {'name': 'Single-phase full-wave (bridge) rectifier', 'ground': '0', 'components': comps, 'controls': [], 'meta': {'io_node': io, 'src_neg': 'B'}}


def build_scr_bridge(p):
    comps, io = _bridge(p, 'TT', 'TT', ('G14', 'G23'))
    return {'name': 'Single-phase fully controlled bridge', 'ground': '0', 'components': comps,
            'controls': _firing(p, [{'name': 'G14', 'offset_deg': 0.0}, {'name': 'G23', 'offset_deg': 180.0}]),
            'meta': {'io_node': io, 'src_neg': 'B'}}


def build_semi(p):
    comps, io = _bridge(p, 'TT', 'DD', ('G1', 'G2'))
    return {'name': 'Single-phase semi-converter', 'ground': '0', 'components': comps,
            'controls': _firing(p, [{'name': 'G1', 'offset_deg': 0.0}, {'name': 'G2', 'offset_deg': 180.0}]),
            'meta': {'io_node': io, 'src_neg': 'B'}}


def scr_bridge_netlist(p):          # kept for API/test compatibility
    return build_scr_bridge(p)


# ----------------------------------------------------------------- DC-DC builders
def _dc_common(p):
    T = 1.0 / (p['fsw_khz'] * 1e3)
    comps = [{'id': 'Vin', 'type': 'dc_voltage_source', 'nodes': ['IN', '0'], 'params': {'voltage': p['vin']}}]
    sw = {'id': 'S1', 'type': 'mosfet', 'params': {'Ron': 2e-2, 'Roff': 1e7, 'gate': 'G1'}}
    ctl = [{'id': 'PWM1', 'type': 'pwm', 'params': {'frequency': p['fsw_khz'] * 1e3, 'duty': p['duty'], 'name': 'G1'}}]
    th = dc_theory(p['_topo'], p) if p.get('precharge', True) else None
    v0 = th['Vo_avg'] if th else 0.0
    # cycle starts at switch turn-on = inductor-current valley (0 in DCM)
    i0 = max(th['IL_avg'] - th['dIL_pp'] / 2, 0.0) if th and th['mode'] == 'CCM' else 0.0
    return comps, sw, ctl, v0, i0


def _out(p, comps, v0):
    comps.append({'id': 'C1', 'type': 'capacitor', 'nodes': ['OUT', '0'], 'params': {'capacitance': p['c_uf'] * 1e-6, 'v0': v0}})
    comps.append({'id': 'R1', 'type': 'resistor', 'nodes': ['OUT', '0'], 'params': {'resistance': p['r']}})


def build_buck(p):
    comps, sw, ctl, v0, i0 = _dc_common({**p, '_topo': 'buck'})
    comps += [{**sw, 'nodes': ['IN', 'SW']}, {'id': 'D1', 'type': 'diode', 'nodes': ['0', 'SW'], 'params': dict(DI)},
              {'id': 'L1', 'type': 'inductor', 'nodes': ['SW', 'OUT'], 'params': {'inductance': p['l_uh'] * 1e-6, 'i0': i0}}]
    _out(p, comps, v0)
    return {'name': 'Buck converter', 'ground': '0', 'components': comps, 'controls': ctl, 'meta': {}}


def build_boost(p):
    comps, sw, ctl, v0, i0 = _dc_common({**p, '_topo': 'boost'})
    comps += [{'id': 'L1', 'type': 'inductor', 'nodes': ['IN', 'SW'], 'params': {'inductance': p['l_uh'] * 1e-6, 'i0': i0}},
              {**sw, 'nodes': ['SW', '0']}, {'id': 'D1', 'type': 'diode', 'nodes': ['SW', 'OUT'], 'params': dict(DI)}]
    _out(p, comps, v0)
    return {'name': 'Boost converter', 'ground': '0', 'components': comps, 'controls': ctl, 'meta': {}}


def build_buckboost(p):
    comps, sw, ctl, v0, i0 = _dc_common({**p, '_topo': 'buckboost'})
    comps += [{**sw, 'nodes': ['IN', 'SW']},
              {'id': 'L1', 'type': 'inductor', 'nodes': ['SW', '0'], 'params': {'inductance': p['l_uh'] * 1e-6, 'i0': i0}},
              {'id': 'D1', 'type': 'diode', 'nodes': ['OUT', 'SW'], 'params': dict(DI)}]
    _out(p, comps, v0)
    return {'name': 'Buck-boost (inverting) converter', 'ground': '0', 'components': comps, 'controls': ctl, 'meta': {}}


# ----------------------------------------------------------------- DC-AC builders (MOSFET legs with body diodes)
MOS = {'Ron': 2e-2, 'Roff': 1e7}


def _inv_controls(p, topo):
    outs = [{'name': n} for n in (['G1', 'G2'] if topo == 'half' else ['G1', 'G2', 'G3', 'G4'])] + [{'name': 'REF'}, {'name': 'CAR'}]
    return [{'id': 'INV1', 'type': 'inverter_gates',
             'params': {'mode': p['mod'], 'frequency': p['freq'], 'mf': int(round(p['mf'])), 'ma': p['ma'], 'topology': topo,
                        'dead_s': p.get('dead_us', 0.0) * 1e-6, 'outputs': outs}}]


def _leg(comps, a, top, bot, tg, bg, td, bd):
    """Half-bridge leg: MOSFET + antiparallel body diode on each side. Switch conducts drain->source, diode source->drain."""
    comps += [{'id': tg[0], 'type': 'mosfet', 'nodes': [top, a], 'params': {**MOS, 'gate': tg[1]}},
              {'id': bg[0], 'type': 'mosfet', 'nodes': [a, bot], 'params': {**MOS, 'gate': bg[1]}},
              {'id': td, 'type': 'diode', 'nodes': [a, top], 'params': dict(DI)},
              {'id': bd, 'type': 'diode', 'nodes': [bot, a], 'params': dict(DI)}]


def _rl(p, comps, a, b):
    if p['l'] > 0:
        comps += [{'id': 'R1', 'type': 'resistor', 'nodes': [a, 'M'], 'params': {'resistance': p['r']}},
                  {'id': 'L1', 'type': 'inductor', 'nodes': ['M', b], 'params': {'inductance': p['l'], 'i0': 0.0}}]
        return 'M'
    comps.append({'id': 'R1', 'type': 'resistor', 'nodes': [a, b], 'params': {'resistance': p['r']}})
    return b


def build_inv_full(p):
    comps = [{'id': 'Vdc', 'type': 'dc_voltage_source', 'nodes': ['VP', '0'], 'params': {'voltage': p['vdc']}}]
    _leg(comps, 'OA', 'VP', '0', ('S1', 'G1'), ('S2', 'G2'), 'D1', 'D2')
    _leg(comps, 'OB', 'VP', '0', ('S3', 'G3'), ('S4', 'G4'), 'D3', 'D4')
    rn = _rl(p, comps, 'OA', 'OB')
    return {'name': 'Single-phase full-bridge inverter', 'ground': '0', 'components': comps, 'controls': _inv_controls(p, 'full'),
            'meta': {'out_n': 'OB', 'r_node': rn, 'topo': 'full'}}


def build_inv_half(p):
    comps = [{'id': 'Vh1', 'type': 'dc_voltage_source', 'nodes': ['VP', 'MID'], 'params': {'voltage': p['vdc'] / 2}},
             {'id': 'Vh2', 'type': 'dc_voltage_source', 'nodes': ['MID', '0'], 'params': {'voltage': p['vdc'] / 2}}]
    _leg(comps, 'OA', 'VP', '0', ('S1', 'G1'), ('S2', 'G2'), 'D1', 'D2')
    rn = _rl(p, comps, 'OA', 'MID')
    return {'name': 'Single-phase half-bridge inverter', 'ground': '0', 'components': comps, 'controls': _inv_controls(p, 'half'),
            'meta': {'out_n': 'MID', 'r_node': rn, 'topo': 'half'}}


# ----------------------------------------------------------------- probes
def ac_probes(sim, p, nl):
    m = nl['meta']
    return {'Vs': v(sim, 'A') - v(sim, m['src_neg']), 'Vo': v(sim, 'P'), 'Is': -branch_i(sim, 'Vs'),
            'Io': (v(sim, 'P') - v(sim, m['io_node'])) / p['r']}


def dc_probes(sim, p, nl):
    return {'Vo': v(sim, 'OUT'), 'Vsw': v(sim, 'SW'), 'IL': branch_i(sim, 'L1'), 'Iin': -branch_i(sim, 'Vin'),
            'Id': switch_i(sim, 'D1'), 'Io': v(sim, 'OUT') / p['r'], 'Vin': v(sim, 'IN')}


def inv_probes(sim, p, nl):
    m = nl['meta']
    iin = -branch_i(sim, 'Vdc') if m['topo'] == 'full' else (-branch_i(sim, 'Vh1') - branch_i(sim, 'Vh2')) / 2   # Vdc * Iin = input power
    return {'Vo': v(sim, 'OA') - v(sim, m['out_n']), 'Io': (v(sim, 'OA') - v(sim, m['r_node'])) / p['r'], 'Iin': iin}


# ----------------------------------------------------------------- UI schema helpers
def P(key, label, unit, default, lo, hi, step):
    return {'key': key, 'label': label, 'unit': unit, 'default': default, 'min': lo, 'max': hi, 'step': step}

AC_BASE = [P('vs_rms', 'Vs (RMS)', 'V', 230.0, 1, 1000, 1), P('freq', 'Frequency', 'Hz', 50.0, 1, 1000, 1),
           P('r', 'R', 'Ω', 10.0, 0.01, 1e5, 0.5), P('l', 'L', 'H', 0.0, 0, 10, 0.005), P('E', 'Back-EMF E', 'V', 0.0, 0, 1000, 5)]
AC_SIM = [P('dt', 'Timestep', 's', 1e-5, 1e-7, 1e-3, 1e-6), P('n_cycles', 'Cycles simulated', '', 10, 2, 200, 1)]
ALPHA = P('alpha_deg', 'Firing angle α', '°', 45.0, 0, 180, 1)
PULSE = P('pulse_deg', 'Gate pulse width', '°', 30.0, 1, 180, 5)
CAP = P('c_uf', 'Filter capacitor C', 'µF', 0.0, 0, 1e5, 100)
DC_BASE = [P('duty', 'Duty cycle D', '', 0.5, 0.05, 0.95, 0.05), P('fsw_khz', 'Switching freq', 'kHz', 20.0, 1, 500, 1),
           P('l_uh', 'L', 'µH', 200.0, 1, 1e5, 10), P('c_uf', 'C', 'µF', 100.0, 1, 1e5, 10), P('r', 'Load R', 'Ω', 5.0, 0.1, 1e4, 0.5)]
DC_SIM = [P('spc', 'Steps per switching cycle', '', 200, 50, 2000, 50), P('n_cycles', 'Switching cycles', '', 100, 10, 2000, 10)]

ACCH = [{'key': 'Vs', 'label': 'Vs', 'g': 0, 'c': '#38bdf8'}, {'key': 'Vo', 'label': 'Vo', 'g': 0, 'c': '#f472b6'},
        {'key': 'Is', 'label': 'Is', 'g': 1, 'c': '#fbbf24'}, {'key': 'Io', 'label': 'Io', 'g': 1, 'c': '#a3e635'}]
DCCH = [{'key': 'Vo', 'label': 'Vo', 'g': 0, 'c': '#f472b6'}, {'key': 'Vsw', 'label': 'Vsw', 'g': 0, 'c': '#38bdf8'},
        {'key': 'IL', 'label': 'IL', 'g': 1, 'c': '#a3e635'}, {'key': 'Iin', 'label': 'Iin', 'g': 1, 'c': '#fbbf24'},
        {'key': 'Id', 'label': 'Id', 'g': 1, 'c': '#a78bfa'}, {'key': 'G1', 'label': 'G1', 'g': 2, 'c': '#34d399'}]
GCOL = ['#34d399', '#fb923c']


def SEL(key, label, options, default):
    return {'key': key, 'label': label, 'type': 'select', 'options': [{'value': v_, 'label': l_} for v_, l_ in options], 'default': default,
            'unit': '', 'min': 0, 'max': 0, 'step': 0}


INV_BASE = [P('vdc', 'DC link Vdc', 'V', 400.0, 1, 2000, 10), P('freq', 'Output frequency', 'Hz', 50.0, 1, 1000, 1),
            P('r', 'Load R', 'Ω', 10.0, 0.01, 1e4, 0.5), P('l', 'Load L', 'H', 0.02, 0, 10, 0.005),
            P('ma', 'Modulation index ma', '', 0.8, 0.05, 1.5, 0.05), P('mf', 'Carrier ratio mf = fc/fm', '', 21, 3, 101, 2),
            P('dead_us', 'Dead time', 'µs', 0.0, 0, 50, 1)]
INV_SIM = [P('spc_c', 'Steps per carrier cycle', '', 200, 40, 400, 20), P('n_cycles', 'Output cycles simulated', '', 6, 2, 100, 1)]
INVCH = [{'key': 'Vo', 'label': 'Vo', 'g': 0, 'c': '#f472b6'}, {'key': 'Io', 'label': 'Io', 'g': 1, 'c': '#a3e635'},
         {'key': 'Iin', 'label': 'Iin', 'g': 1, 'c': '#fbbf24'}, {'key': 'REF', 'label': 'Vref', 'g': 2, 'c': '#38bdf8'},
         {'key': 'CAR', 'label': 'Carrier', 'g': 2, 'c': '#94a3b8'}, {'key': 'G1', 'label': 'G1', 'g': 3, 'c': '#34d399'},
         {'key': 'G2', 'label': 'G2', 'g': 3, 'c': '#fb923c'}, {'key': 'G3', 'label': 'G3', 'g': 3, 'c': '#a78bfa'},
         {'key': 'G4', 'label': 'G4', 'g': 3, 'c': '#fbbf24'}]


INV_SWEEP = {'key': 'ma', 'label': 'Modulation index ma', 'start': 0.1, 'stop': 1.0, 'points': 10, 'y': 'V1_pk', 'ylabel': 'Vo fundamental peak (V)'}


def _filtered(theory_fn, fr):
    return lambda p: filter_theory(p, fr) if p.get('c_uf', 0) > 0 else theory_fn(p)


REGISTRY = {
    'halfwave': dict(name='Half-wave rectifier', kind='ac', build=build_halfwave, probes=ac_probes,
                     theory=_filtered(halfwave_theory, 1), channels=ACCH, gates=[], readout=['Vs', 'Vo', 'Is', 'Io'],
                     params=AC_BASE + [CAP] + AC_SIM, flags=[{'key': 'fwd', 'label': 'Freewheeling diode'}], sweep=None,
                     defaults_override={'r': 100.0}),
    'fullwave': dict(name='Full-wave bridge rectifier', kind='ac', build=build_fullwave, probes=ac_probes,
                     theory=_filtered(lambda p: scr_bridge_theory({**p, 'alpha_deg': 0.0, 'fwd': False}), 2),
                     channels=ACCH, gates=[], readout=['Vs', 'Vo', 'Is', 'Io'], params=AC_BASE + [CAP] + AC_SIM,
                     flags=[], sweep=None, defaults_override={'r': 100.0}),
    'scr_bridge': dict(name='Fully controlled bridge', kind='ac', build=build_scr_bridge, probes=ac_probes,
                       theory=lambda p: scr_bridge_theory(p), channels=ACCH + [
                           {'key': 'G14', 'label': 'G1,4', 'g': 2, 'c': GCOL[0]}, {'key': 'G23', 'label': 'G2,3', 'g': 2, 'c': GCOL[1]}],
                       gates=['G14', 'G23'], readout=['Vs', 'Vo', 'Is', 'Io'], params=[ALPHA] + AC_BASE + [PULSE] + AC_SIM,
                       flags=[{'key': 'fwd', 'label': 'Freewheeling diode'}],
                       sweep={'key': 'alpha_deg', 'label': 'α (°)', 'start': 0, 'stop': 180, 'points': 19},
                       defaults_override={'l': 0.05}),
    'semi': dict(name='Semi-converter (half-controlled)', kind='ac', build=build_semi, probes=ac_probes,
                 theory=semi_theory, channels=ACCH + [{'key': 'G1', 'label': 'G1', 'g': 2, 'c': GCOL[0]}, {'key': 'G2', 'label': 'G2', 'g': 2, 'c': GCOL[1]}],
                 gates=['G1', 'G2'], readout=['Vs', 'Vo', 'Is', 'Io'], params=[ALPHA] + AC_BASE + [PULSE] + AC_SIM, flags=[],
                 sweep={'key': 'alpha_deg', 'label': 'α (°)', 'start': 0, 'stop': 180, 'points': 19},
                 defaults_override={'l': 0.05, 'alpha_deg': 60.0}),
    'buck': dict(name='Buck converter', kind='dc', build=build_buck, probes=dc_probes, theory=lambda p: dc_theory('buck', p),
                 channels=DCCH, gates=['G1'], readout=['Vo', 'IL', 'Iin', 'Vsw'], params=[P('vin', 'Vin', 'V', 48.0, 1, 1000, 1)] + DC_BASE + DC_SIM,
                 flags=[], sweep={'key': 'duty', 'label': 'Duty cycle D', 'start': 0.1, 'stop': 0.9, 'points': 9}, defaults_override={}),
    'boost': dict(name='Boost converter', kind='dc', build=build_boost, probes=dc_probes, theory=lambda p: dc_theory('boost', p),
                  channels=DCCH, gates=['G1'], readout=['Vo', 'IL', 'Iin', 'Vsw'], params=[P('vin', 'Vin', 'V', 12.0, 1, 1000, 1)] + DC_BASE + DC_SIM,
                  flags=[], sweep={'key': 'duty', 'label': 'Duty cycle D', 'start': 0.1, 'stop': 0.8, 'points': 8},
                  defaults_override={'r': 10.0, 'c_uf': 220.0}),
    'buckboost': dict(name='Buck-boost converter', kind='dc', build=build_buckboost, probes=dc_probes, theory=lambda p: dc_theory('buckboost', p),
                      channels=DCCH, gates=['G1'], readout=['Vo', 'IL', 'Iin', 'Vsw'], params=[P('vin', 'Vin', 'V', 24.0, 1, 1000, 1)] + DC_BASE + DC_SIM,
                      flags=[], sweep={'key': 'duty', 'label': 'Duty cycle D', 'start': 0.1, 'stop': 0.8, 'points': 8},
                      defaults_override={'r': 10.0}),
    'inv_full': dict(name='Full-bridge inverter', kind='inv', build=build_inv_full, probes=inv_probes, theory=lambda p: inverter_theory(p, 'full'),
                     channels=INVCH, gates=['G1', 'G2', 'G3', 'G4'], readout=['Vo', 'Io', 'Iin', 'REF'],
                     params=[SEL('mod', 'Modulation', [('bipolar', 'Bipolar SPWM'), ('unipolar', 'Unipolar SPWM'), ('square', 'Square wave')], 'bipolar')] + INV_BASE + INV_SIM,
                     flags=[], sweep=INV_SWEEP, defaults_override={}),
    'inv_half': dict(name='Half-bridge inverter', kind='inv', build=build_inv_half, probes=inv_probes, theory=lambda p: inverter_theory(p, 'half'),
                     channels=INVCH[:7], gates=['G1', 'G2'], readout=['Vo', 'Io', 'Iin', 'REF'],
                     params=[SEL('mod', 'Modulation', [('spwm', 'Sinusoidal PWM'), ('square', 'Square wave')], 'spwm')] + INV_BASE + INV_SIM,
                     flags=[], sweep=INV_SWEEP, defaults_override={}),
}


def defaults_for(tid):
    t = REGISTRY[tid]
    d = {q['key']: q['default'] for q in t['params']}
    d.update(t['defaults_override'])
    d.update({f['key']: False for f in t['flags']})
    if t['kind'] == 'ac':
        d.setdefault('pulse_deg', 30.0); d.setdefault('alpha_deg', 0.0)
    elif t['kind'] == 'dc':
        d['precharge'] = True
    d.update(meas_cycles=1, display_cycles={'ac': 3, 'dc': 6, 'inv': 2}[t['kind']], max_harmonic=100 if t['kind'] == 'inv' else 50)
    return d
