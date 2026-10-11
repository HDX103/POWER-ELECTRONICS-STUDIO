"""Netlist schema (v2) and normalisation.

v2 = the v1 format the solver already consumes, plus:
    "version": 2
    components[i].label   optional display name
    meta                  free-form (e.g. net -> schematic position mapping written by the compiler)
Nothing about v1 changes, so every existing builder output is already a valid v2 netlist
once `normalize` stamps the version.

The solver receives ONLY a normalised netlist:
    { "version": 2, "ground": "0",
      "components": [ {"id","type","nodes":[...],"params":{...}} ... ],
      "controls":   [ ... ] }
"""
import copy
from typing import Any, Dict, List, Tuple

from . import metadata

NETLIST_VERSION = 2


def _issue(code, message, components=(), nodes=(), level='error'):
    return {'level': level, 'code': code, 'message': message,
            'components': list(components), 'nodes': list(nodes)}


def normalize(netlist: Any, fill_defaults: bool = False) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """Return (normalised copy, structural issues).

    Structural issues are the ones that make a netlist unusable at all (bad shape,
    duplicate ids, unknown/planned/schematic-only types, wrong pin count, non-numeric
    numeric parameters). Electrical sanity (floating nodes, source loops...) is
    validation.validate's job.

    fill_defaults=True writes metadata defaults into missing params (used by the editor
    pipeline so a compiled netlist is fully explicit). The legacy endpoint leaves it off,
    keeping the solver's own fallbacks and therefore old results.
    """
    issues: List[Dict[str, Any]] = []
    if not isinstance(netlist, dict) or not isinstance(netlist.get('components'), list):
        return {'version': NETLIST_VERSION, 'ground': '0', 'components': [], 'controls': []}, [
            _issue('BAD_NETLIST', "Netlist must be an object with a 'components' list.")]

    ver = netlist.get('version', 1)
    if ver not in (1, 2):
        issues.append(_issue('BAD_VERSION', f"Unsupported netlist version {ver}."))

    out = {k: copy.deepcopy(v) for k, v in netlist.items() if k not in ('components', 'ground', 'version')}
    out['version'] = NETLIST_VERSION
    out['ground'] = str(netlist.get('ground', '0'))
    out.setdefault('controls', [])
    comps = []
    seen = set()
    for raw in netlist['components']:
        if not isinstance(raw, dict) or not all(k in raw for k in ('id', 'type', 'nodes')):
            issues.append(_issue('BAD_NETLIST', "Each component needs 'id', 'type' and 'nodes'."))
            continue
        cid, ctype = str(raw['id']), str(raw['type'])
        c = {k: copy.deepcopy(v) for k, v in raw.items() if k not in ('id', 'type', 'nodes', 'params')}
        c.update({'id': cid, 'type': ctype, 'nodes': [str(n) for n in raw['nodes']],
                  'params': dict(raw.get('params') or {})})
        if cid in seen:
            issues.append(_issue('DUP_ID', f"Duplicate component id '{cid}'.", [cid]))
        seen.add(cid)
        spec = metadata.get(ctype)
        if spec is None:
            issues.append(_issue('UNKNOWN_TYPE', f"{cid}: unknown component type '{ctype}'.", [cid]))
        elif spec['status'] == 'planned':
            issues.append(_issue('UNSUPPORTED_TYPE', f"{cid}: '{spec['label']}' is in the library but has no simulation model yet.", [cid]))
        elif spec['status'] == 'schematic':
            issues.append(_issue('SCHEMATIC_ONLY', f"{cid}: '{spec['label']}' is a schematic-only part and must be compiled away.", [cid]))
        else:
            if len(c['nodes']) != len(spec['pins']):
                issues.append(_issue('PIN_COUNT', f"{cid}: {spec['label']} has {len(spec['pins'])} terminals "
                                     f"({', '.join(spec['pins'])}), got {len(c['nodes'])}.", [cid]))
            for p in spec['params']:
                k = p['key']
                if k not in c['params']:
                    if fill_defaults:
                        c['params'][k] = p['default']
                    continue
                if p['kind'] == 'number':
                    try:
                        c['params'][k] = float(c['params'][k])
                    except (TypeError, ValueError):
                        issues.append(_issue('BAD_PARAM', f"{cid}: {p['label']} must be a number.", [cid]))
        comps.append(c)
    out['components'] = comps
    return out, issues
