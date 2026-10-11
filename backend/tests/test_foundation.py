"""Batch 1: component metadata, netlist v2 normalisation, validation diagnostics, new endpoints."""
import pytest
from fastapi.testclient import TestClient
from simulation import metadata, normalize, validate, REGISTRY as _T
from simulation.components import REGISTRY as SOLVER
from simulation.topologies import REGISTRY as TOPOS, defaults_for
from main import app

client = TestClient(app)


def _rc():
    return {'ground': '0', 'components': [
        {'id': 'V1', 'type': 'dc_voltage_source', 'nodes': ['1', '0'], 'params': {'voltage': 5}},
        {'id': 'R1', 'type': 'resistor', 'nodes': ['1', '2'], 'params': {'resistance': 1000}},
        {'id': 'C1', 'type': 'capacitor', 'nodes': ['2', '0'], 'params': {'capacitance': 1e-6}}]}


# ---------------------------------------------------------------- metadata
def test_every_solver_type_has_metadata():
    for t in SOLVER:
        assert metadata.get(t) and metadata.get(t)['status'] == 'implemented', t


def test_implemented_metadata_maps_to_solver():
    for t, s in metadata.COMPONENTS.items():
        if s['status'] == 'implemented':
            assert s['solver'] in SOLVER


def test_params_defaults_and_pins_sane():
    for t, s in metadata.COMPONENTS.items():
        keys = [p['key'] for p in s['params']]
        assert len(keys) == len(set(keys)), t
        assert len(s['pins']) == len(set(s['pins'])), t
        if s['status'] == 'implemented':
            assert len(s['pins']) >= 2


def test_library_covers_requested_categories():
    lib = metadata.library()
    cats = {c['id'] for c in lib['categories']}
    assert cats == {'passive', 'source', 'semiconductor', 'magnetic', 'control', 'measurement', 'utility'}
    for need in ('resistor', 'bjt', 'triac', 'gan_hemt', 'transformer', 'pid_controller', 'svpwm_generator',
                 'differential_probe', 'ground', 'net_label', 'junction'):
        assert need in metadata.COMPONENTS


def test_components_endpoint():
    r = client.get('/api/components').json()
    assert any(c['type'] == 'mosfet' for c in r['components'])


# ---------------------------------------------------------------- normalize
def test_normalize_stamps_version_and_keeps_legacy_values():
    nl, iss = normalize(_rc())
    assert nl['version'] == 2 and not iss
    assert nl['components'][1]['params']['resistance'] == 1000.0


def test_normalize_fill_defaults_only_when_asked():
    raw = {'ground': '0', 'components': [{'id': 'R1', 'type': 'resistor', 'nodes': ['1', '0']}]}
    assert normalize(raw)[0]['components'][0]['params'] == {}
    assert normalize(raw, fill_defaults=True)[0]['components'][0]['params']['resistance'] == 10.0


@pytest.mark.parametrize('bad,code', [
    ({'components': [{'id': 'X', 'type': 'warp_core', 'nodes': ['1', '0']}]}, 'UNKNOWN_TYPE'),
    ({'components': [{'id': 'X', 'type': 'bjt', 'nodes': ['1', '2', '0']}]}, 'UNSUPPORTED_TYPE'),
    ({'components': [{'id': 'X', 'type': 'ground', 'nodes': ['0']}]}, 'SCHEMATIC_ONLY'),
    ({'components': [{'id': 'X', 'type': 'resistor', 'nodes': ['1']}]}, 'PIN_COUNT'),
    ({'components': [{'id': 'X', 'type': 'resistor', 'nodes': ['1', '0'], 'params': {'resistance': 'abc'}}]}, 'BAD_PARAM'),
    ({'components': [{'id': 'X', 'type': 'resistor', 'nodes': ['1', '0']}, {'id': 'X', 'type': 'resistor', 'nodes': ['1', '0']}]}, 'DUP_ID'),
    ({'components': 'nope'}, 'BAD_NETLIST'),
    ({'version': 9, 'components': []}, 'BAD_VERSION'),
])
def test_normalize_structural_errors(bad, code):
    assert code in {i['code'] for i in normalize(bad)[1]}


def test_node_names_coerced_to_str():
    raw = {'components': [{'id': 'R1', 'type': 'resistor', 'nodes': [1, 0], 'params': {'resistance': 1}}]}
    assert normalize(raw)[0]['components'][0]['nodes'] == ['1', '0']


def test_normalize_does_not_mutate_input():
    raw = _rc(); import copy; before = copy.deepcopy(raw)
    normalize(raw, fill_defaults=True)
    assert raw == before


@pytest.mark.parametrize('tid', list(TOPOS))
def test_every_existing_topology_is_valid_v2(tid):
    """All shipped builders must pass normalisation untouched (nothing structural, params unchanged)."""
    nl = TOPOS[tid]['build'](defaults_for(tid))
    n2, iss = normalize(nl)
    assert not iss, iss
    assert [c['params'] for c in n2['components']] == [c.get('params', {}) for c in nl['components']]
    assert [c['nodes'] for c in n2['components']] == [[str(x) for x in c['nodes']] for c in nl['components']]


# ---------------------------------------------------------------- validation diagnostics
def test_issues_carry_component_and_node_ids():
    nl = _rc(); nl['components'].append({'id': 'R9', 'type': 'resistor', 'nodes': ['7', '8'], 'params': {'resistance': 1}})
    iss = validate(nl)
    fl = next(i for i in iss if i['code'] == 'FLOATING')
    assert fl['components'] == ['R9'] and set(fl['nodes']) == {'7', '8'}
    un = [i for i in iss if i['code'] == 'UNCONNECTED']
    assert un and all(i['components'] for i in un)


def test_voltage_source_loop_detected():
    nl = {'ground': '0', 'components': [
        {'id': 'V1', 'type': 'dc_voltage_source', 'nodes': ['1', '0'], 'params': {'voltage': 5}},
        {'id': 'V2', 'type': 'dc_voltage_source', 'nodes': ['2', '1'], 'params': {'voltage': 5}},
        {'id': 'V3', 'type': 'dc_voltage_source', 'nodes': ['2', '0'], 'params': {'voltage': 5}},
        {'id': 'R1', 'type': 'resistor', 'nodes': ['2', '0'], 'params': {'resistance': 1}}]}
    loop = [i for i in validate(nl) if i['code'] == 'SOURCE_LOOP']
    assert loop and 'V3' in loop[0]['message']


def test_parallel_sources_name_both():
    nl = {'ground': '0', 'components': [
        {'id': 'V1', 'type': 'dc_voltage_source', 'nodes': ['1', '0'], 'params': {'voltage': 5}},
        {'id': 'V2', 'type': 'dc_voltage_source', 'nodes': ['1', '0'], 'params': {'voltage': 5}},
        {'id': 'R1', 'type': 'resistor', 'nodes': ['1', '0'], 'params': {'resistance': 1}}]}
    p = next(i for i in validate(nl) if i['code'] == 'SOURCE_PARALLEL')
    assert set(p['components']) == {'V1', 'V2'}


def test_valid_rc_has_no_errors():
    assert not [i for i in validate(_rc()) if i['level'] == 'error']


def test_planned_part_reported_not_crashing():
    nl = _rc(); nl['components'].append({'id': 'Q1', 'type': 'bjt', 'nodes': ['1', '2', '0']})
    assert any(i['code'] == 'UNSUPPORTED_TYPE' and i['components'] == ['Q1'] for i in validate(nl))


# ---------------------------------------------------------------- endpoints
def test_normalize_endpoint():
    r = client.post('/api/netlist/normalize', json={'netlist': _rc()}).json()
    assert r['netlist']['version'] == 2 and r['issues'] == []


def test_generic_simulate_rc_matches_analytic():
    import math
    r = client.post('/api/simulate-netlist', json={'netlist': _rc(), 't_stop': 5e-3, 'dt': 1e-6, 'probes': ['2']}).json()
    assert r['success']
    t, v = r['time'], r['signals']['v(2)']
    k = min(range(len(t)), key=lambda i: abs(t[i] - 1e-3))   # one time constant
    assert v[k] == pytest.approx(5 * (1 - math.exp(-1)), rel=0.01)


def test_generic_simulate_rejects_bad_netlist_with_ids():
    nl = _rc(); nl['components'][1]['type'] = 'warp_core'
    r = client.post('/api/simulate-netlist', json={'netlist': nl, 't_stop': 1e-3, 'dt': 1e-6}).json()
    assert not r['success'] and any(i['code'] == 'UNKNOWN_TYPE' for i in r['issues'])


def test_frontend_library_fixture_is_in_sync():
    """The editor's vitest suite runs against a dump of metadata.library(); fail loudly if the dump goes stale.
    Regenerate: python -c "import json; from simulation import metadata; json.dump(metadata.library(), open('../frontend/src/editor/__tests__/library.fixture.json','w'), indent=1)" """
    import json, os
    path = os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', 'src', 'editor', '__tests__', 'library.fixture.json')
    if not os.path.exists(path):
        pytest.skip('frontend not present')
    assert json.load(open(path)) == json.loads(json.dumps(metadata.library()))
