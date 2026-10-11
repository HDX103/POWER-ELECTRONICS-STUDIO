"""Every topology vs closed-form theory. With Ron -> 0 the solver must converge to ideal theory."""
import os, sys, pytest
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from simulation import run_topology, sweep_topology, validate, REGISTRY, defaults_for

IDEAL = {'ron': 1e-4}


def rel(sim, th):
    return abs(sim - th) / max(abs(th), 1e-9)


def check(r, keys=('Vo_avg', 'Io_avg'), tol=0.01):
    assert r['success'], r.get('error')
    for row in r['table']:
        if row['theory'] is not None and any(k.split('_')[0] in row['label'] for k in ())or True:
            pass
    m, th = r['measurements'], r['theory']
    for k in keys:
        if th.get(k) is not None:
            assert rel(m[k], th[k]) < tol or abs(m[k] - th[k]) < 0.05, f"{k}: sim {m[k]} theory {th[k]}"


@pytest.mark.parametrize('kw', [{}, {'l': 0.1}, {'l': 0.1, 'fwd': True}, {'E': 100}, {'l': 0.05, 'E': 50}, {'c_uf': 470, 'r': 50}])
def test_halfwave(kw):
    r = run_topology('halfwave', {**IDEAL, **kw})
    check(r, ('Vo_avg', 'Vo_rms', 'Io_avg'), 0.005)


@pytest.mark.parametrize('kw', [{}, {'l': 0.1}, {'l': 0.005}, {'E': 100}, {'c_uf': 1000}, {'c_uf': 220, 'r': 50}])
def test_fullwave(kw):
    r = run_topology('fullwave', {**IDEAL, **kw})
    check(r, ('Vo_avg', 'Vo_rms', 'Io_avg'), 0.005)
    if 'c_uf' in kw:
        row = next(x for x in r['table'] if 'ripple' in x['label'])
        assert rel(row['sim'], row['theory']) < 0.02


@pytest.mark.parametrize('alpha', [0, 30, 60, 90, 120, 150])
@pytest.mark.parametrize('load', [dict(l=0.05), dict(l=0.001), dict(l=0.02, r=5, E=100), dict(l=0.0)])
def test_semi(alpha, load):
    r = run_topology('semi', {**IDEAL, 'alpha_deg': alpha, **load})
    check(r, ('Vo_avg', 'Io_avg', 'Io_rms'), 0.01)


def test_semi_freewheels_without_extra_diode():
    r = run_topology('semi', {'alpha_deg': 90, 'l': 0.5})
    assert r['measurements']['Vo_avg'] >= 0 and r['measurements']['Vo_avg'] == pytest.approx(230 * 2 ** .5 / np.pi, rel=0.01)
    c = r['conduction_deg']                          # T1 on 90->270; D2 takes over at 180: T1+D2 freewheel, Vo = 0
    assert c['T1'][0] == pytest.approx([90, 270], abs=2)
    assert any(a == pytest.approx(180, abs=2) for a, b in c['D2'])


@pytest.mark.parametrize('tid', ['buck', 'boost', 'buckboost'])
@pytest.mark.parametrize('kw', [{}, {'duty': 0.3}, {'duty': 0.7}, {'l_uh': 20}, {'l_uh': 30, 'duty': 0.2}])
def test_dc_dc(tid, kw):
    r = run_topology(tid, {**IDEAL, **kw})
    assert r['success'], r.get('error')
    m, th = r['measurements'], r['theory']
    assert rel(m['Vo_avg'], th['Vo_avg']) < 0.01, (th['mode'], m['Vo_avg'], th['Vo_avg'])
    assert rel(m['IL_avg'], th['IL_avg']) < 0.015
    assert rel(m['dIL_pp'], th['dIL_pp']) < 0.03
    if th['dVo_pp']:
        assert rel(m['Vo_ripple_pp'], th['dVo_pp']) < 0.06
    assert not [l for l in r['log'] if l.startswith('warning')]


@pytest.mark.parametrize('tid,sign', [('buck', 1), ('boost', 1), ('buckboost', -1)])
def test_dc_dc_polarity_and_mode(tid, sign):
    r = run_topology(tid, {})
    assert np.sign(r['measurements']['Vo_avg']) == sign
    assert r['theory']['mode'] == 'CCM'
    assert run_topology(tid, {'l_uh': 10})['theory']['mode'] == 'DCM'
    assert 0.9 < r['measurements']['efficiency'] <= 1.0


def test_steady_state_is_periodic():
    """Regression: gate edges must not jitter by a step (float rounding) -> identical cycle means."""
    r = run_topology('buck', {'n_cycles': 300, 'meas_cycles': 1, 'display_cycles': 5})
    v = np.array(r['signals']['Vo']); spc = r['samples_per_cycle']
    means = [v[k * spc:(k + 1) * spc].mean() for k in range(4)]
    assert max(means) - min(means) < 5e-3


def test_buck_duty_sweep_is_linear():
    pts = sweep_topology('buck', {**IDEAL}, points=5)
    for q in pts:
        assert rel(q['Vo_avg_sim'], q['Vo_avg_theory']) < 0.01


def test_validation_catches_missing_gate_in_dc():
    nl = REGISTRY['buck']['build'](defaults_for('buck'))
    nl['controls'] = []
    assert any(i['code'] == 'NO_GATE' for i in validate(nl))


# ----------------------------------------------------------------------------- inverters
INV = [('inv_full', 'bipolar'), ('inv_full', 'unipolar'), ('inv_full', 'square'), ('inv_half', 'spwm'), ('inv_half', 'square')]


@pytest.mark.parametrize('tid,mod', INV)
@pytest.mark.parametrize('load', [dict(), dict(r=5, l=0.05), dict(l=0.0)])
def test_inverter_vs_ideal_spectrum(tid, mod, load):
    r = run_topology(tid, {'mod': mod, 'ron': 1e-4, **load})
    assert r['success'], r.get('error')
    m, th = r['measurements'], r['theory']
    assert rel(m['Vo_rms'], th['Vo_rms']) < 0.01
    assert rel(m['V1_pk'], th['V1_pk']) < 0.01
    assert rel(m['Io_rms'], th['Io_rms']) < 0.015
    assert rel(m['Io_pk'], th['Io_pk']) < 0.02
    assert abs(m['thd_v'] - th['thd_v']) < 0.03 * th['thd_v']
    assert abs(m['Vo_avg']) < 0.5 and abs(m['Io_avg']) < 0.3          # no DC component
    assert not [x for x in r['log'] if x.startswith('warning')]


def test_inverter_closed_forms():
    base = dict(vdc=400, freq=50, r=10, l=0.02, mf=21, ma=0.8, max_harmonic=100)
    sq = run_topology('inv_full', {'mod': 'square', 'ron': 1e-4})['measurements']
    assert sq['V1_pk'] == pytest.approx(4 * 400 / np.pi, rel=0.002) and sq['Vo_rms'] == pytest.approx(400, rel=0.002)
    assert sq['thd_v'] == pytest.approx(48.3, abs=1.0)                  # 4/pi square wave: sqrt(pi^2/8 - 1) = 48.3 %
    bp = run_topology('inv_full', {'mod': 'bipolar', 'ron': 1e-4})['measurements']
    assert bp['V1_pk'] == pytest.approx(0.8 * 400, rel=0.005) and bp['Vo_rms'] == pytest.approx(400, rel=0.003)
    un = run_topology('inv_full', {'mod': 'unipolar', 'ron': 1e-4})['measurements']
    assert un['Vo_rms'] == pytest.approx(400 * np.sqrt(2 * 0.8 / np.pi), rel=0.005)
    hb = run_topology('inv_half', {'mod': 'spwm', 'ron': 1e-4})['measurements']
    assert hb['V1_pk'] == pytest.approx(0.8 * 200, rel=0.005) and hb['Vo_rms'] == pytest.approx(200, rel=0.003)


def test_unipolar_has_lower_harmonics_than_bipolar():
    """Unipolar doubles the effective switching frequency: first PWM sidebands move from ~mf to ~2mf."""
    b = run_topology('inv_full', {'mod': 'bipolar', 'ron': 1e-4})['fft']['Vo']
    u = run_topology('inv_full', {'mod': 'unipolar', 'ron': 1e-4})['fft']['Vo']
    assert max(b['peak'][19:24]) > 0.3 * b['fundamental_peak']          # carrier-band energy near mf = 21
    assert max(u['peak'][15:27]) < 0.05 * u['fundamental_peak']          # none near mf in unipolar
    assert u['thd_percent'] < b['thd_percent']


def test_body_diode_carries_inductive_current_during_dead_time():
    r = run_topology('inv_full', {'mod': 'bipolar', 'dead_us': 5})
    assert r['success']
    st = r['signals']
    both_off = [i for i in range(len(st['state_S1'])) if not st['state_S1'][i] and not st['state_S2'][i]]
    assert both_off, 'dead time should leave a window with both leg-A switches off'
    assert all(st['state_D1'][i] or st['state_D2'][i] for i in both_off[::5])      # a body diode conducts instead
    assert r['measurements']['Io_rms'] > 15                                          # current is not interrupted


def test_no_shoot_through_without_dead_time():
    r = run_topology('inv_full', {'mod': 'bipolar', 'dead_us': 0, 'n_cycles': 3})
    s = r['signals']
    assert not any(a and b for a, b in zip(s['state_S1'], s['state_S2']))
    assert not any(a and b for a, b in zip(s['state_S3'], s['state_S4']))


def test_overmodulation_warns_and_ma_sweep_linear():
    r = run_topology('inv_full', {'ma': 1.3})
    assert any('Over-modulation' in l for l in r['log'])
    pts = sweep_topology('inv_full', {'ron': 1e-4}, points=4)
    for q in pts:                     # edge-placement quantisation is an absolute error (fraction of Vdc), not proportional to ma
        assert abs(q['y_sim'] - q['y_theory']) < 0.004 * 400
