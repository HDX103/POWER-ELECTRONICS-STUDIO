"""Pre-simulation circuit validation. Returns a list of
    {level, code, message, components: [ids], nodes: [names]}
`components` / `nodes` let the UI highlight the offending parts on the schematic.
Codes and messages of the original checks are unchanged (additive format change only).
"""
from collections import Counter, defaultdict

from . import metadata
from .netlist import normalize

POSITIVE = {'resistor': 'resistance', 'inductor': 'inductance', 'capacitor': 'capacitance'}


def validate(netlist, sim=None):
    nl, out = normalize(netlist)
    if any(i['code'] in ('BAD_NETLIST', 'BAD_VERSION') for i in out):
        return out

    def add(level, code, msg, comps=(), nodes=()):
        out.append({'level': level, 'code': code, 'message': msg, 'components': list(comps), 'nodes': list(nodes)})
    err = lambda code, msg, comps=(), nodes=(): add('error', code, msg, comps, nodes)
    warn = lambda code, msg, comps=(), nodes=(): add('warning', code, msg, comps, nodes)

    gnd = nl['ground']
    comps = nl['components']
    if not comps:
        err('EMPTY', 'Circuit has no components.')
        return out
    nodes = Counter()
    on_node = defaultdict(list)
    for c in comps:
        for n in c['nodes']:
            nodes[n] += 1
            on_node[n].append(c['id'])
    if gnd not in nodes:
        err('NO_GROUND', f"No component is connected to the ground node '{gnd}'.", nodes=[gnd])
    for n, k in nodes.items():
        if n != gnd and k < 2:
            err('UNCONNECTED', f"Node '{n}' has a single connection (unconnected terminal).", on_node[n], [n])

    # connectivity -> floating sub-circuits
    parent = {n: n for n in nodes}
    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]; a = parent[a]
        return a
    for c in comps:
        ns = c['nodes']
        for n in ns[1:]:
            parent[find(n)] = find(ns[0])
    if gnd in nodes:
        floating = sorted({n for n in nodes if find(n) != find(gnd)})
        if floating:
            fc = sorted({cid for n in floating for cid in on_node[n]})
            err('FLOATING', f"Floating node(s) with no path to ground: {', '.join(floating)}.", fc, floating)

    gates = {o['name'] for ctl in nl.get('controls', []) for o in ctl.get('params', {}).get('outputs', [])}
    gates |= {ctl.get('params', {}).get('name', ctl['id']) for ctl in nl.get('controls', []) if ctl['type'] == 'pwm'}
    vsrc = []
    for c in comps:
        t, ns, p, cid = c['type'], c['nodes'], c['params'], c['id']
        spec = metadata.get(t)
        if spec is None or spec['status'] != 'implemented':
            continue                                   # already reported by normalize
        if len(ns) == 2 and ns[0] == ns[1]:
            (err if 'source' in t else warn)('SHORT', f"{cid}: both terminals on node '{ns[0]}' (shorted).", [cid], [ns[0]])
        if t in POSITIVE and not float(p.get(POSITIVE[t], 0)) > 0:
            err('BAD_PARAM', f"{cid}: {POSITIVE[t]} must be > 0.", [cid])
        if t == 'ac_voltage_source':
            if not float(p.get('frequency', 0)) > 0: err('BAD_PARAM', f"{cid}: frequency must be > 0.", [cid])
            if float(p.get('rms', 0)) <= 0: warn('ZERO_SOURCE', f"{cid}: source amplitude is zero.", [cid])
        if 'voltage_source' in t and len(ns) == 2:
            vsrc.append((cid, ns))
        for s in spec['signals']:
            g = p.get(s['key'])
            if not g: err('NO_GATE', f"{cid}: no {s['key']} signal assigned.", [cid])
            elif g not in gates: err('NO_GATE', f"{cid}: {s['key']} '{g}' is not driven by any control block.", [cid])

    # voltage-source loops: parallel pair, or any longer cycle (union-find over source edges only)
    seen = {}
    vp = {}
    def vfind(a):
        vp.setdefault(a, a)
        while vp[a] != a:
            vp[a] = vp[vp[a]]; a = vp[a]
        return a
    for cid, (a, b) in vsrc:
        pair = frozenset((a, b))
        if len(pair) == 2 and pair in seen:
            err('SOURCE_PARALLEL', f"Voltage sources {seen[pair]} and {cid} are connected in parallel.", [seen[pair], cid], list(pair))
        elif len(pair) == 2 and vfind(a) == vfind(b):
            err('SOURCE_LOOP', f"{cid} closes a loop of ideal voltage sources (over-determined circuit).",
                [x for x, _ in vsrc], [a, b])
        seen.setdefault(pair, cid)
        vp[vfind(a)] = vfind(b)

    if sim:
        if not sim['t_stop'] > sim['dt'] > 0: err('BAD_SIM', 'Need t_stop > dt > 0.')
        if sim['steps'] > 1_000_000: err('TOO_LARGE', f"{sim['steps']:,} steps requested (limit 1,000,000). Increase dt or shorten t_stop.")
        elif sim['samples_per_cycle'] < 100: warn('COARSE_DT', f"Only {sim['samples_per_cycle']:.0f} samples per cycle; switching instants will be coarse.")
    return out
