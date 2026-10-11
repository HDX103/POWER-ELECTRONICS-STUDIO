"""Generic experiment runner: params -> netlist -> validation -> MNA simulation -> measurements/FFT/theory."""
import math
import numpy as np
from .topologies import REGISTRY, defaults_for
from .validation import validate
from .engine import simulate, SimulationError
from .analysis import measurements, dc_measurements, inv_measurements, fft_harmonics

DEFAULTS = defaults_for('scr_bridge')        # backwards compatible name
TITLES = {'ac': ['Voltage (V)', 'Current (A)', 'Gate'], 'dc': ['Voltage (V)', 'Current (A)', 'Gate'],
          'inv': ['Voltage (V)', 'Current (A)', 'Reference / carrier', 'Gate drive']}


def _intervals(state, dt_deg):
    s = np.concatenate([[0], state.astype(int), [0]]); d = np.diff(s)
    return [[float(a * dt_deg), float(b * dt_deg)] for a, b in zip(np.where(d == 1)[0], np.where(d == -1)[0])]


def _fail(issues, log, nl, msg=None):
    return {'success': False, 'issues': issues, 'log': log, 'netlist': nl,
            'error': msg or '; '.join(i['message'] for i in issues if i['level'] == 'error')}


def _timing(kind, p):
    """Base frequency, period, samples per base cycle, minimum cycles needed to settle."""
    if kind == 'dc':
        f0 = p['fsw_khz'] * 1e3
        T = 1.0 / f0 if f0 > 0 else float('nan')
        spc = int(p['spc']) if f0 > 0 else 0
        need = int(math.ceil(10 * p['r'] * p['c_uf'] * 1e-6 / T)) + 20 if spc else 0
    elif kind == 'inv':
        f0 = p['freq']
        T = 1.0 / f0 if f0 > 0 else float('nan')
        spc = int(round(p['mf'])) * int(p['spc_c']) if f0 > 0 else 0
        need = int(math.ceil(5 * (p['l'] / p['r'] if p['r'] > 0 else 0) / T)) + 3 if spc else 0
    else:
        f0 = p['freq']
        T = 1.0 / f0 if f0 > 0 else float('nan')
        spc = max(int(round(T / p['dt'])), 1) if p['dt'] > 0 and f0 > 0 else 0
        tau = max(p['l'] / p['r'] if p['r'] > 0 else 0, p['r'] * p.get('c_uf', 0) * 1e-6)
        need = int(math.ceil(5 * tau / T)) + 2 if spc else 0
    return T, spc, need


def run_topology(tid, params):
    if tid not in REGISTRY:
        raise SimulationError(f"Unknown topology '{tid}'")
    t = REGISTRY[tid]
    kind = t['kind']
    p = {**defaults_for(tid), **{k: x for k, x in params.items() if x is not None}}
    log = []
    T, spc, need = _timing(kind, p)
    n_cyc = max(int(p['n_cycles']), need) if spc else 0
    if n_cyc > int(p['n_cycles']):
        log.append(f"info: simulated {n_cyc} cycles (settling needs ≥ 5 time constants).")
    cfg = {'dt': T / spc if spc else 0, 't_stop': n_cyc * T if spc else 0, 'steps': n_cyc * spc, 'samples_per_cycle': spc}
    nl = t['build'](p)
    if p.get('ron'):                       # optional override of every switch's on-resistance (e.g. to compare with ideal theory)
        for c in nl['components']:
            if c['type'] in ('diode', 'thyristor', 'mosfet', 'igbt', 'ideal_switch'):
                c['params']['Ron'] = float(p['ron'])
    issues = validate(nl, cfg)
    if kind == 'ac' and 'alpha_deg' in p and t['gates'] and not 0 <= p['alpha_deg'] <= 180:
        issues.append({'level': 'error', 'code': 'BAD_PARAM', 'message': 'Firing angle must be within 0°–180°.'})
    if kind == 'dc' and not 0 < p['duty'] < 1:
        issues.append({'level': 'error', 'code': 'BAD_PARAM', 'message': 'Duty cycle must be between 0 and 1.'})
    if kind == 'inv':
        if p['mf'] < 3: issues.append({'level': 'error', 'code': 'BAD_PARAM', 'message': 'Carrier ratio mf must be ≥ 3.'})
        if p['ma'] <= 0: issues.append({'level': 'error', 'code': 'BAD_PARAM', 'message': 'Modulation index must be > 0.'})
        elif p['ma'] > 1 and p['mod'] != 'square':
            issues.append({'level': 'warning', 'code': 'OVERMOD', 'message': f"Over-modulation (ma = {p['ma']:.2f} > 1): fundamental no longer linear in ma, low-order harmonics appear."})
        if p['dead_us'] * 1e-6 >= 0.4 / (p['freq'] * p['mf']):
            issues.append({'level': 'error', 'code': 'BAD_PARAM', 'message': 'Dead time must be well below half a carrier period.'})
    if any(i['level'] == 'error' for i in issues):
        return _fail(issues, log, nl)

    dt, steps = cfg['dt'], cfg['steps']
    sim = simulate(nl, cfg['t_stop'], dt)
    time = sim['time']
    sig = t['probes'](sim, p, nl)
    mc = min(int(p['meas_cycles']), n_cyc); dc = min(int(p['display_cycles']), n_cyc)
    w = slice(steps - mc * spc, steps)
    theory = t['theory'](p)
    hmax = int(p['max_harmonic'])

    if kind == 'ac':
        meas = measurements(time[w], sig['Vs'][w], sig['Vo'][w], sig['Is'][w], sig['Io'][w], p, mc)
        fft_keys = ('Vs', 'Vo', 'Is', 'Io')
        table = [('Vo average', 'V', meas['Vo_avg'], theory.get('Vo_avg')), ('Vo RMS', 'V', meas['Vo_rms'], theory.get('Vo_rms')),
                 ('Io average', 'A', meas['Io_avg'], theory.get('Io_avg')), ('Io RMS', 'A', meas['Io_rms'], theory.get('Io_rms'))]
        if theory.get('ripple_pp') is not None:
            table.append(('Vo ripple (p-p)', 'V', meas['Vo_ripple_pp'], theory['ripple_pp']))
        other = [('Vo peak', meas['Vo_peak'], 'V', 2), ('Io peak', meas['Io_peak'], 'A', 2), ('Is RMS', meas['Is_rms'], 'A', 2),
                 ('Real power P', meas['P_in'], 'W', 1), ('Apparent S', meas['S'], 'VA', 1), ('Reactive Q', meas['Q'], 'var', 1),
                 ('Power factor', meas['PF'], '', 3), ('Displacement PF', meas['DPF'], '', 3), ('Distortion factor', meas['distortion_factor'], '', 3),
                 ('Efficiency', None if meas['efficiency'] is None else meas['efficiency'] * 100, '%', 2),
                 ('Ripple factor (Vo)', meas['ripple_factor'], '', 3), ('Form factor (Vo)', meas['form_factor'], '', 3),
                 ('Crest factor (Vo)', meas['crest_factor_Vo'], '', 3)]
    elif kind == 'dc':
        meas = dc_measurements(sig['Vin'][w], sig['Iin'][w], sig['Vo'][w], sig['Io'][w], sig['IL'][w], sig['Vsw'][w], sig['Id'][w])
        fft_keys = ('Vo', 'IL', 'Iin', 'Vsw')
        table = [('Vo average', 'V', meas['Vo_avg'], theory['Vo_avg']), ('Io average', 'A', meas['Io_avg'], theory['Io_avg']),
                 ('IL average', 'A', meas['IL_avg'], theory['IL_avg']), ('ΔIL (p-p)', 'A', meas['dIL_pp'], theory['dIL_pp']),
                 ('ΔVo (p-p)', 'V', meas['Vo_ripple_pp'], theory['dVo_pp'])]
        other = [('Conduction mode', None, theory['mode'], 0), ('Critical L', theory['L_crit_uh'], 'µH', 1),
                 ('Input power', meas['P_in'], 'W', 2), ('Output power', meas['P_out'], 'W', 2),
                 ('Efficiency', None if meas['efficiency'] is None else meas['efficiency'] * 100, '%', 2),
                 ('IL peak', meas['IL_peak'], 'A', 2), ('IL min', meas['IL_min'], 'A', 2), ('Switch Vsw peak', meas['Vsw_peak'], 'V', 1),
                 ('Output ripple', meas['Vo_ripple_pct'], '%', 2), ('Diode avg current', meas['Id_avg'], 'A', 2)]
    else:
        fft_keys = ('Vo', 'Io', 'Iin')
        ffts_ = {k: fft_harmonics(sig[k][w], mc, hmax) for k in fft_keys}
        meas = inv_measurements(sig['Vo'][w], sig['Io'][w], p['vdc'], sig['Iin'][w], ffts_['Vo'], ffts_['Io'])
        table = [('Vo RMS', 'V', meas['Vo_rms'], theory['Vo_rms']), ('Vo fundamental (pk)', 'V', meas['V1_pk'], theory['V1_pk']),
                 ('Io RMS', 'A', meas['Io_rms'], theory['Io_rms']), ('Io peak', 'A', meas['Io_pk'], theory['Io_pk']),
                 ('Io fundamental (pk)', 'A', meas['I1_pk'], theory['I1_pk']),
                 ('THD Vo', '%', meas['thd_v'], theory['thd_v']), ('THD Io', '%', meas['thd_i'], theory['thd_i'])]
        other = [('Vo average', meas['Vo_avg'], 'V', 3), ('Io average', meas['Io_avg'], 'A', 3), ('Output power', meas['P_out'], 'W', 1),
                 ('Input power', meas['P_in'], 'W', 1), ('Efficiency', None if meas['efficiency'] is None else meas['efficiency'] * 100, '%', 2),
                 ('Load power factor', meas['PF_load'], '', 3),
                 ('Effective ma', meas['V1_pk'] / (p['vdc'] * (1 if t['build'].__name__ == 'build_inv_full' else 0.5)), '', 3),
                 ('Carrier frequency', p['freq'] * round(p['mf']) / 1e3, 'kHz', 2)]
    ffts = ffts_ if kind == 'inv' else {k: fft_harmonics(sig[k][w], mc, hmax) for k in fft_keys}

    # steady-state check (mean Vo for converters, RMS Io for inverters) comparing the last window with one a few cycles earlier
    gap = max(mc, n_cyc // 5)
    if n_cyc >= gap + mc:
        k = 'Io' if kind == 'inv' else 'Vo'
        prev, cur = sig[k][steps - (gap + mc) * spc: steps - gap * spc], sig[k][w]
        f = (lambda a: np.sqrt(np.mean(a ** 2))) if kind == 'inv' else np.mean
        scale = max(abs(np.mean(cur)), np.sqrt(np.mean(cur ** 2)), 1e-9)
        drift = abs(f(cur) - f(prev)) / scale
        if drift > 0.005:
            log.append(f"warning: not fully at steady state ({k} changed {drift*100:.2f}% over the last {gap} cycles). Increase simulated cycles.")

    states = {s.id: sim['states'][:, j] for j, s in enumerate(sim['switches'])}
    last = slice(steps - spc, steps)
    conduction = {k: _intervals(st[last], 360.0 / spc) for k, st in states.items()}

    dsl = slice(steps - dc * spc, steps + 1)
    cap = 8000 if kind == 'inv' else 4000
    stride = max(1, int(math.ceil((dc * spc + 1) / cap)))
    pick = lambda a: np.asarray(a[dsl])[::stride]
    scale_t, unit_t = (1e6, 'µs') if kind == 'dc' else (1e3, 'ms')
    signals = {k: pick(a).tolist() for k, a in sig.items()}
    signals.update({k: pick(a).tolist() for k, a in sim['gates'].items()})
    signals.update({f'state_{k}': pick(a).astype(int).tolist() for k, a in states.items()})
    chans = [{**c, 'step': c['key'] in t['gates']} for c in t['channels'] if c['key'] in signals]

    log.append(f"solved {steps:,} steps (dt = {dt*1e6:.3f} µs, {spc} samples/cycle), {sim['events']} switching events.")
    log.append(f"measured over last {mc} cycle(s); theory: {theory.get('mode')}.")
    log += [f"{i['level']}: {i['message']}" for i in issues]
    return {
        'success': True, 'topology': tid, 'name': t['name'], 'kind': kind, 'issues': issues, 'log': log, 'netlist': nl,
        'time': ((time[dsl] - time[dsl][0])[::stride] * scale_t).tolist(), 'time_unit': unit_t,
        'signals': signals, 'channels': chans, 'group_titles': TITLES[kind],
        'readout': t['readout'], 'period': T, 'samples_per_cycle': spc,
        'measurements': meas, 'theory': theory, 'table': [{'label': a, 'unit': b, 'sim': c, 'theory': d} for a, b, c, d in table],
        'other': [{'label': a, 'value': b, 'unit': c, 'dec': d} for a, b, c, d in other],
        'fft': ffts, 'conduction_deg': conduction, 'devices': list(states),
        'sim': {'dt': dt, 't_stop': cfg['t_stop'], 'cycles': n_cyc, 'steps': steps},
    }


def run_scr_bridge(params):
    return run_topology('scr_bridge', params)


def sweep_topology(tid, params, key=None, start=None, stop=None, points=None):
    t = REGISTRY[tid]; sw = t['sweep']
    if not sw:
        raise SimulationError(f"No sweep defined for '{tid}'")
    key = key or sw['key']; start = sw['start'] if start is None else start; stop = sw['stop'] if stop is None else stop
    points = int(points or sw['points']); y = sw.get('y', 'Vo_avg')
    out = []
    for x in np.linspace(start, stop, points):
        r = run_topology(tid, {**params, key: float(x), 'display_cycles': 1})
        if not r['success']:
            raise SimulationError(r['error'])
        out.append({'x': float(x), 'y_sim': r['measurements'].get(y), 'y_theory': r['theory'].get(y),
                    'Vo_avg_sim': r['measurements'].get('Vo_avg'), 'Vo_avg_theory': r['theory'].get('Vo_avg'),
                    'Io_avg_sim': r['measurements'].get('Io_avg')})
    return out


def sweep_alpha(params, start=0.0, stop=180.0, points=19):
    return [{'alpha_deg': q['x'], **{k: v for k, v in q.items() if k != 'x'}} for q in
            sweep_topology('scr_bridge', params, 'alpha_deg', start, stop, points)]
