"""Component metadata: the single source of truth for the component library.

Everything the UI needs to build the palette, draw symbols, and generate the
parameter editor comes from here (served at GET /api/components). The solver
registry (components.REGISTRY) stays the source of truth for *behaviour*;
`status` says whether a metadata entry has a solver model yet:

    implemented : solver model exists, usable in the free-form editor
    planned     : listed in the library (greyed out) but not yet simulatable

Rules that keep metadata honest:
  * A parameter is declared only if the solver reads it. No silently ignored fields.
  * `pins` are the *electrical* terminals, in the same order as `nodes` in a netlist.
  * Control inputs (e.g. a gate driven by a control signal) are `signals`, stored in
    params under the signal's key as a signal *name* (string), exactly like the
    existing builders do with params['gate'].
"""
from typing import Any, Dict, List, Optional

CATEGORIES = [
    ('passive', 'Passive Components'),
    ('source', 'Sources'),
    ('semiconductor', 'Semiconductor Devices'),
    ('magnetic', 'Magnetic Components'),
    ('control', 'Control Components'),
    ('measurement', 'Measurement'),
    ('utility', 'Utility'),
]


def num(key, label, unit, default, lo=None, hi=None, group='main', log=False, doc=''):
    return {'key': key, 'label': label, 'kind': 'number', 'unit': unit, 'default': default,
            'min': lo, 'max': hi, 'group': group, 'log': log, 'doc': doc}


def text(key, label, default='', group='main', doc=''):
    return {'key': key, 'label': label, 'kind': 'string', 'unit': '', 'default': default, 'group': group, 'doc': doc}


def select(key, label, options, default, group='main'):
    return {'key': key, 'label': label, 'kind': 'select', 'options': options, 'default': default, 'unit': '', 'group': group}


def _c(type_, label, category, pins, params=(), signals=(), prefix='X', symbol=None, solver=None,
       status='implemented', desc='', aliases=()):
    return {
        'type': type_, 'label': label, 'category': category, 'pins': list(pins),
        'params': list(params), 'signals': list(signals), 'prefix': prefix,
        'symbol': symbol or type_, 'solver': solver or (type_ if status == 'implemented' else None),
        'status': status, 'description': desc, 'aliases': list(aliases),
    }


_SW = [num('Ron', 'On-resistance', 'Ω', 1e-2, 1e-9, 1e6, log=True),
       num('Roff', 'Off-resistance', 'Ω', 1e7, 1.0, 1e15, log=True)]
_GATE = [{'key': 'gate', 'label': 'Gate signal', 'doc': 'Name of the control signal driving this device'}]

_IMPL: List[Dict[str, Any]] = [
    # ---- passive
    _c('resistor', 'Resistor', 'passive', ['p', 'n'], [num('resistance', 'Resistance', 'Ω', 10.0, 1e-9, None, log=True)],
       prefix='R', desc='Linear resistor.'),
    _c('capacitor', 'Capacitor', 'passive', ['p', 'n'],
       [num('capacitance', 'Capacitance', 'F', 100e-6, 1e-15, None, log=True),
        num('v0', 'Initial voltage', 'V', 0.0, group='initial')],
       prefix='C', desc='Linear capacitor. Initial voltage is v(p) − v(n).'),
    _c('inductor', 'Inductor', 'passive', ['p', 'n'],
       [num('inductance', 'Inductance', 'H', 100e-6, 1e-15, None, log=True),
        num('i0', 'Initial current', 'A', 0.0, group='initial')],
       prefix='L', desc='Linear inductor. Initial current flows p → n.'),
    # ---- sources
    _c('dc_voltage_source', 'DC voltage source', 'source', ['p', 'n'], [num('voltage', 'Voltage', 'V', 12.0)],
       prefix='V', desc='Ideal DC voltage source, v(p) − v(n) = V.', aliases=['battery', 'vdc']),
    _c('ac_voltage_source', 'AC voltage source', 'source', ['p', 'n'],
       [num('rms', 'RMS voltage', 'V', 230.0, 0.0), num('frequency', 'Frequency', 'Hz', 50.0, 1e-3, None, log=True),
        num('phase', 'Phase', '°', 0.0)],
       prefix='V', desc='Sinusoidal voltage source (RMS amplitude).', aliases=['sine', 'vac']),
    # ---- semiconductors (piecewise-linear models today; richer models arrive with the solver upgrade)
    _c('diode', 'Diode', 'semiconductor', ['anode', 'cathode'],
       [num('Vf', 'Forward voltage threshold', 'V', 0.0, 0.0, 50.0)] + _SW,
       prefix='D', symbol='diode', desc='Piecewise-linear diode.'),
    _c('thyristor', 'SCR', 'semiconductor', ['anode', 'cathode'],
       [num('Vf', 'Forward voltage threshold', 'V', 0.0, 0.0, 50.0),
        num('Ihold', 'Holding current', 'A', 0.0, 0.0)] + _SW,
       _GATE, prefix='T', symbol='thyristor', desc='Latches on when gated and forward biased.', aliases=['thyristor']),
    _c('mosfet', 'MOSFET', 'semiconductor', ['drain', 'source'], list(_SW), _GATE, prefix='M', symbol='mosfet',
       desc='Gate-controlled switch (no body diode: add one explicitly).'),
    _c('igbt', 'IGBT', 'semiconductor', ['collector', 'emitter'], list(_SW), _GATE, prefix='Q', symbol='igbt',
       desc='Gate-controlled switch.'),
    _c('ideal_switch', 'Ideal switch', 'semiconductor', ['p', 'n'], list(_SW), _GATE, prefix='S', symbol='switch',
       desc='Controlled switch.'),
]

# Library entries that the roadmap adds later: visible, searchable, but not placeable yet.
_PLANNED_SPEC = [
    ('variable_resistor', 'Variable resistor', 'passive', ['p', 'n'], 'R'),
    ('potentiometer', 'Potentiometer', 'passive', ['a', 'wiper', 'b'], 'RV'),
    ('pulse_voltage_source', 'Pulse voltage source', 'source', ['p', 'n'], 'V'),
    ('pwl_voltage_source', 'PWL voltage source', 'source', ['p', 'n'], 'V'),
    ('dc_current_source', 'DC current source', 'source', ['p', 'n'], 'I'),
    ('ac_current_source', 'AC current source', 'source', ['p', 'n'], 'I'),
    ('pulse_current_source', 'Pulse current source', 'source', ['p', 'n'], 'I'),
    ('three_phase_source', 'Three-phase source', 'source', ['a', 'b', 'c', 'n'], 'V'),
    ('schottky_diode', 'Schottky diode', 'semiconductor', ['anode', 'cathode'], 'D'),
    ('zener_diode', 'Zener diode', 'semiconductor', ['anode', 'cathode'], 'D'),
    ('bjt', 'BJT', 'semiconductor', ['collector', 'base', 'emitter'], 'Q'),
    ('jfet', 'JFET', 'semiconductor', ['drain', 'gate', 'source'], 'J'),
    ('triac', 'TRIAC', 'semiconductor', ['mt1', 'mt2'], 'T'),
    ('gto', 'GTO', 'semiconductor', ['anode', 'cathode'], 'T'),
    ('sic_mosfet', 'SiC MOSFET', 'semiconductor', ['drain', 'source'], 'M'),
    ('gan_hemt', 'GaN HEMT', 'semiconductor', ['drain', 'source'], 'M'),
    ('transformer', 'Transformer', 'magnetic', ['p1', 'p2', 's1', 's2'], 'T'),
    ('coupled_inductors', 'Coupled inductors', 'magnetic', ['p1', 'p2', 's1', 's2'], 'K'),
    ('mutual_inductance', 'Mutual inductance', 'magnetic', ['p1', 'p2', 's1', 's2'], 'K'),
    ('saturating_inductor', 'Saturating inductor', 'magnetic', ['p', 'n'], 'L'),
    ('comparator', 'Comparator', 'control', [], 'U'),
    ('gain', 'Gain', 'control', [], 'U'),
    ('sum', 'Sum', 'control', [], 'U'),
    ('integrator', 'Integrator', 'control', [], 'U'),
    ('differentiator', 'Differentiator', 'control', [], 'U'),
    ('pi_controller', 'PI controller', 'control', [], 'U'),
    ('pid_controller', 'PID controller', 'control', [], 'U'),
    ('limiter', 'Limiter', 'control', [], 'U'),
    ('saturation', 'Saturation', 'control', [], 'U'),
    ('pwm_generator', 'PWM generator', 'control', [], 'U'),
    ('spwm_generator', 'SPWM generator', 'control', [], 'U'),
    ('svpwm_generator', 'SVPWM generator', 'control', [], 'U'),
    ('triangle_carrier', 'Triangle carrier', 'control', [], 'U'),
    ('sawtooth_carrier', 'Sawtooth carrier', 'control', [], 'U'),
    ('hysteresis_controller', 'Hysteresis controller', 'control', [], 'U'),
    ('voltage_probe', 'Voltage probe', 'measurement', ['p', 'n'], 'VP'),
    ('current_probe', 'Current probe', 'measurement', ['p', 'n'], 'IP'),
    ('power_probe', 'Power probe', 'measurement', ['p', 'n'], 'PP'),
    ('differential_probe', 'Differential voltage probe', 'measurement', ['p', 'n'], 'DP'),
]

# Utility parts are schematic-level only (the compiler consumes them; the solver never sees them).
_UTILITY = [
    _c('ground', 'Ground', 'utility', ['g'], prefix='GND', solver=None, status='schematic',
       desc='Reference node (0). Compiled away into net "0".'),
    _c('net_label', 'Net label', 'utility', ['n'], [text('name', 'Net name', 'N1')], prefix='NL', solver=None,
       status='schematic', desc='Names a net; same-named labels are the same net.'),
    _c('junction', 'Junction', 'utility', ['j'], prefix='J', solver=None, status='schematic',
       desc='Explicit wire junction.'),
]

_PLANNED = [_c(t, l, cat, pins, prefix=pre, status='planned', desc='Planned: not simulatable yet.')
            for t, l, cat, pins, pre in _PLANNED_SPEC]

COMPONENTS: Dict[str, Dict[str, Any]] = {c['type']: c for c in _IMPL + _PLANNED + _UTILITY}


def get(ctype: str) -> Optional[Dict[str, Any]]:
    return COMPONENTS.get(ctype)


def defaults(ctype: str) -> Dict[str, Any]:
    spec = COMPONENTS[ctype]
    return {p['key']: p['default'] for p in spec['params']}


def library() -> Dict[str, Any]:
    """Payload for GET /api/components."""
    return {'version': 1, 'categories': [{'id': i, 'label': l} for i, l in CATEGORIES],
            'components': list(COMPONENTS.values())}
