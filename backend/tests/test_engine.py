"""Solver vs closed-form theory. Tolerance covers the Ron drop (2 x 10 mOhm) and dt discretisation."""
import itertools, sys, os
import pytest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from simulation import run_scr_bridge, validate, sweep_alpha
from simulation.topologies import scr_bridge_netlist

CASES = list(itertools.product((0, 30, 60, 90, 120, 150), ((10, 0.05, 0), (10, 1e-3, 0), (10, 0.05, 100), (5, 0.002, 60))))


@pytest.mark.parametrize('alpha,load', CASES)
def test_matches_theory(alpha, load):
    r, l, E = load
    out = run_scr_bridge(dict(alpha_deg=alpha, r=r, l=l, E=E))
    assert out['success']
    m, th = out['measurements'], out['theory']
    assert m['Vo_avg'] == pytest.approx(th['Vo_avg'], abs=1.0, rel=0.01)
    assert m['Io_rms'] == pytest.approx(th['Io_rms'], rel=0.02, abs=0.05)


def test_alpha_zero_vo_avg():
    out = run_scr_bridge(dict(alpha_deg=0, r=10, l=0.5))
    assert out['measurements']['Vo_avg'] == pytest.approx(2 * 230 * 2 ** .5 / 3.14159265, rel=0.01)


def test_conduction_sequence_continuous():
    out = run_scr_bridge(dict(alpha_deg=45, r=10, l=0.5))
    c = out['conduction_deg']
    assert c['T1'][0][0] == pytest.approx(45, abs=0.5) and c['T1'][0][1] == pytest.approx(225, abs=1)
    assert c['T3'][0][0] == pytest.approx(225, abs=1) or c['T3'][0][0] == pytest.approx(0, abs=1)


def test_energy_balance():
    out = run_scr_bridge(dict(alpha_deg=60, r=10, l=0.05))
    m = out['measurements']
    assert m['P_in'] == pytest.approx(m['P_load'], rel=0.01)       # only Ron losses separate them
    assert m['P_R'] == pytest.approx(m['P_load'], rel=0.01)        # E=0, L stores no average energy


def test_fwd_raises_average_voltage():
    a = run_scr_bridge(dict(alpha_deg=90, r=10, l=0.5, fwd=False))['measurements']['Vo_avg']
    b = run_scr_bridge(dict(alpha_deg=90, r=10, l=0.5, fwd=True))['measurements']['Vo_avg']
    assert b == pytest.approx(230 * 2 ** .5 / 3.14159265, rel=0.02) and b > a


def test_validation_flags():
    n = scr_bridge_netlist(dict(vs_rms=230, freq=50, r=10, l=0.05, alpha_deg=30))
    assert not [i for i in validate(n) if i['level'] == 'error']
    n['controls'] = []
    assert any(i['code'] == 'NO_GATE' for i in validate(n))
    n = scr_bridge_netlist(dict(vs_rms=230, freq=50, r=10, l=0.05, alpha_deg=30))
    n['components'] = [c for c in n['components'] if c['id'] != 'R1']
    codes = {i['code'] for i in validate(n)}
    assert 'UNCONNECTED' in codes
    n = scr_bridge_netlist(dict(vs_rms=230, freq=50, r=-1, l=0.05, alpha_deg=30))
    assert any(i['code'] == 'BAD_PARAM' for i in validate(n))


def test_sweep_monotonic():
    pts = sweep_alpha(dict(r=10, l=0.5), 0, 150, 6)
    v = [p['Vo_avg_sim'] for p in pts]
    assert all(a > b for a, b in zip(v, v[1:]))
