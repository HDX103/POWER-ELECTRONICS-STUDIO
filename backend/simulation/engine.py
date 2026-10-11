"""Time-domain MNA solver.

netlist (JSON-able dict)
  { "ground": "0",
    "components": [ {"id","type","nodes":[..],"params":{..}} ... ],
    "controls":   [ {"id","type":"firing_controller", "params":{...}} ... ] }

Because source values enter only the right-hand side, the system matrix depends
solely on the switch-state vector. LU factorisations are cached per state vector,
so each time step costs one cheap back-substitution (plus extra only when a
switching event happens).
"""
import numpy as np
from scipy.linalg import lu_factor, lu_solve
from .components import REGISTRY, VoltageSource, Switch, Component
from .control import make_gate_signals


class SimulationError(Exception):
    pass


def build(netlist):
    ground = str(netlist.get('ground', '0'))
    names = []
    comps = []
    for c in netlist['components']:
        cls = REGISTRY.get(c['type'])
        if cls is None:
            raise SimulationError(f"Unsupported component type '{c['type']}' ({c['id']})")
        comp = cls(c['id'], c['type'], [str(n) for n in c['nodes']], c.get('params', {}))
        comps.append(comp)
        for n in comp.nodes:
            if n != ground and n not in names:
                names.append(n)
    idx = {n: i for i, n in enumerate(names)}
    nb = len(names)
    for comp in comps:
        comp.ni = [idx.get(n, -1) for n in comp.nodes]
        if comp.branch:
            comp.bi = nb
            nb += 1
    return comps, names, nb


def simulate(netlist, t_stop, dt, record_from=0.0):
    """Returns dict with time, node voltages, branch currents, device states, gates."""
    comps, names, n = build(netlist)
    gates = make_gate_signals(netlist.get('controls', []), comps)
    switches = [c for c in comps if isinstance(c, Switch)]
    steps = int(round(t_stop / dt))
    lu_cache = {}

    def factor():
        key = tuple(s.state for s in switches)
        f = lu_cache.get(key)
        if f is None:
            A = np.zeros((n, n))
            for c in comps:
                c.stamp_matrix(A, dt)
            try:
                f = lu_factor(A)
            except Exception as e:  # pragma: no cover
                raise SimulationError(f"Singular circuit matrix: {e}")
            if not np.all(np.isfinite(f[0])) or np.min(np.abs(np.diag(f[0]))) < 1e-18:
                raise SimulationError("Singular circuit matrix (floating node or source loop?)")
            lu_cache[key] = f
        return f

    X = np.zeros((steps + 1, n))
    S = np.zeros((steps + 1, len(switches)), dtype=np.int8)
    G = {k: np.zeros(steps + 1) for k in gates}
    x = None  # None => use component initial conditions (i0, v0)
    t_arr = np.arange(steps + 1) * dt
    events = 0
    for k in range(steps + 1):
        t = t_arr[k]
        gv = {name: fn(t) for name, fn in gates.items()}
        b = np.zeros(n)
        for c in comps:
            c.stamp_rhs(b, t, dt, x)
        nchg = [0] * len(switches)             # a device may change state at most 3x per instant (anti-chatter)
        for _ in range(12):                      # event iteration at this instant
            xs = lu_solve(factor(), b)
            changed = False
            for j, s in enumerate(switches):
                if nchg[j] >= 3:
                    continue
                g = gv.get(s.params.get('gate'), 0.0)
                want = s.next_state(xs, g)
                if want != s.state:
                    s.state = want
                    nchg[j] += 1
                    changed = True
                    events += 1
            if not changed:
                break
        x = xs
        X[k] = xs
        S[k] = [s.state for s in switches]
        for name in gv:
            G[name][k] = gv[name]
    if not np.all(np.isfinite(X)):
        raise SimulationError("Solution diverged (non-finite values)")

    out = {'time': t_arr, 'X': X, 'names': names, 'comps': comps, 'switches': switches,
           'states': S, 'gates': G, 'events': events}
    return out


def v(sim, node):
    if node == '0':
        return np.zeros_like(sim['time'])
    return sim['X'][:, sim['names'].index(node)]


def branch_i(sim, comp_id):
    c = next(c for c in sim['comps'] if c.id == comp_id)
    return sim['X'][:, c.bi]


def switch_i(sim, comp_id):
    j = next(i for i, s in enumerate(sim['switches']) if s.id == comp_id)
    s = sim['switches'][j]
    va = v(sim, s.nodes[0]); vk = v(sim, s.nodes[1])
    st = sim['states'][:, j]
    g = np.where(st == 1, 1.0 / s.p('Ron', 1e-2), 1.0 / s.p('Roff', 1e7))
    return g * (va - vk)
