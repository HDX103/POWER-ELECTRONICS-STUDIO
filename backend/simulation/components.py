"""Component models for the MNA solver.

Unknown vector x = [ node voltages (non-ground nodes) | branch currents ].
Every model contributes to the constant system matrix (given the current
switch states) and to the right-hand side (sources + companion-model history).
Switch-like devices (diode / thyristor / MOSFET / IGBT / ideal switch) are
piecewise-linear: Ron when ON, Roff when OFF. More accurate models can be added
by subclassing `Switch` and overriding `next_state`.
"""
import numpy as np


class Component:
    branch = False          # needs an extra MNA branch-current unknown?
    switching = False

    def __init__(self, cid, ctype, nodes, params):
        self.id, self.type, self.nodes, self.params = cid, ctype, nodes, params
        self.ni = []        # matrix indices of terminals (-1 = ground)
        self.bi = -1        # branch index

    def p(self, key, default):
        return float(self.params.get(key, default))

    def stamp_matrix(self, A, dt):
        pass

    def stamp_rhs(self, b, t, dt, xprev):
        pass


def _v(x, i):
    return 0.0 if i < 0 else x[i]


def _stamp_g(A, a, k, g):
    if a >= 0: A[a, a] += g
    if k >= 0: A[k, k] += g
    if a >= 0 and k >= 0:
        A[a, k] -= g
        A[k, a] -= g


class Resistor(Component):
    def stamp_matrix(self, A, dt):
        _stamp_g(A, self.ni[0], self.ni[1], 1.0 / self.p('resistance', 1.0))


class Capacitor(Component):
    def stamp_matrix(self, A, dt):
        _stamp_g(A, self.ni[0], self.ni[1], self.p('capacitance', 1e-6) / dt)

    def stamp_rhs(self, b, t, dt, xprev):
        a, k = self.ni
        g = self.p('capacitance', 1e-6) / dt
        v0 = self.p('v0', 0.0) if xprev is None else _v(xprev, a) - _v(xprev, k)
        if a >= 0: b[a] += g * v0
        if k >= 0: b[k] -= g * v0


class Inductor(Component):
    branch = True

    def stamp_matrix(self, A, dt):
        a, k = self.ni
        br = self.bi
        if a >= 0: A[a, br] += 1; A[br, a] += 1
        if k >= 0: A[k, br] -= 1; A[br, k] -= 1
        A[br, br] -= self.p('inductance', 1e-3) / dt     # backward Euler

    def stamp_rhs(self, b, t, dt, xprev):
        i0 = self.p('i0', 0.0) if xprev is None else xprev[self.bi]
        b[self.bi] -= self.p('inductance', 1e-3) / dt * i0


class VoltageSource(Component):
    branch = True

    def value(self, t):
        return self.p('voltage', 0.0)

    def stamp_matrix(self, A, dt):
        a, k = self.ni
        br = self.bi
        if a >= 0: A[a, br] += 1; A[br, a] += 1
        if k >= 0: A[k, br] -= 1; A[br, k] -= 1

    def stamp_rhs(self, b, t, dt, xprev):
        b[self.bi] += self.value(t)


class DCSource(VoltageSource):
    pass


class ACSource(VoltageSource):
    def value(self, t):
        vm = self.p('rms', 230.0) * np.sqrt(2.0)
        return vm * np.sin(2 * np.pi * self.p('frequency', 50.0) * t
                           + np.deg2rad(self.p('phase', 0.0)))


class Switch(Component):
    """Two-terminal piecewise-linear switch (anode/drain a -> cathode/source k)."""
    switching = True

    def __init__(self, *args):
        super().__init__(*args)
        self.state = 0

    def stamp_matrix(self, A, dt):
        g = 1.0 / (self.p('Ron', 1e-2) if self.state else self.p('Roff', 1e7))
        _stamp_g(A, self.ni[0], self.ni[1], g)

    def current(self, x):
        g = 1.0 / (self.p('Ron', 1e-2) if self.state else self.p('Roff', 1e7))
        return g * (_v(x, self.ni[0]) - _v(x, self.ni[1]))

    def next_state(self, x, gate):
        """Return the desired state given the present solution. Gate is 0/1."""
        return self.state


class Diode(Switch):
    def next_state(self, x, gate):
        vak = _v(x, self.ni[0]) - _v(x, self.ni[1])
        return int(vak > self.p('Vf', 0.0)) if not self.state else int(self.current(x) > 0.0)


class Thyristor(Switch):
    """Latches ON when gated and forward biased; turns OFF when current falls to <= I_hold."""
    def next_state(self, x, gate):
        vak = _v(x, self.ni[0]) - _v(x, self.ni[1])
        if not self.state:
            return int(gate > 0.5 and vak > self.p('Vf', 0.0))
        return int(self.current(x) > self.p('Ihold', 0.0))


class GatedSwitch(Switch):
    """MOSFET / IGBT / ideal switch: conducts while gate is high (bidirectional for MOSFET body diode ignored)."""
    def next_state(self, x, gate):
        return int(gate > 0.5)


REGISTRY = {
    'resistor': Resistor, 'capacitor': Capacitor, 'inductor': Inductor,
    'dc_voltage_source': DCSource, 'ac_voltage_source': ACSource,
    'diode': Diode, 'thyristor': Thyristor,
    'mosfet': GatedSwitch, 'igbt': GatedSwitch, 'ideal_switch': GatedSwitch,
}
