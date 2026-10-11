"""Control blocks: they turn time into 0/1 gate signals consumed by switches."""
import numpy as np

_EPS = 1e-7   # guard so a gate edge landing exactly on a step boundary never slips one step (float rounding)


def make_gate_signals(controls, comps):
    signals = {}
    for c in controls:
        p = c.get('params', {})
        if c['type'] == 'firing_controller':
            # Synchronised to the zero crossing of a sine source: theta = 2*pi*f*t + phase
            f = float(p.get('frequency', 50.0)); ph = np.deg2rad(float(p.get('phase', 0.0)))
            a = np.deg2rad(float(p.get('alpha_deg', 0.0)))
            w = np.deg2rad(float(p.get('pulse_deg', 30.0)))
            for out in p.get('outputs', []):
                off = np.deg2rad(float(out.get('offset_deg', 0.0)))
                signals[out['name']] = _angle_window(f, ph, a + off, w)
        elif c['type'] == 'pwm':
            f = float(p.get('frequency', 10e3)); d = float(p.get('duty', 0.5))
            sh = float(p.get('shift', 0.0))
            signals[p.get('name', c['id'])] = (lambda t, f=f, d=d, sh=sh: float(((t * f + sh + _EPS) % 1.0) < d))
        elif c['type'] == 'inverter_gates':
            signals.update(_inverter_gates(p))
        else:
            raise ValueError(f"Unsupported control block '{c['type']}'")
    return signals


def _angle_window(f, ph, start, width):
    two_pi = 2 * np.pi

    def fn(t):
        th = (two_pi * f * t + ph - start + _EPS * two_pi) % two_pi
        return 1.0 if th < width else 0.0
    return fn


# ----------------------------------------------------------------------------- inverter gate logic
def tri_carrier(t, fc):
    """Symmetric triangle, -1 at phase 0 rising to +1 at phase 0.5."""
    x = (np.asarray(t, float) * fc + _EPS) % 1.0
    return 1.0 - 4.0 * np.abs(x - 0.5)


def inverter_commands(t, mode, fm, mf, ma):
    """Leg commands (1 = top switch should conduct) + reference/carrier. Vectorised: used by both the solver and the theory.
    square   : 180-degree conduction, leg B complementary to leg A
    spwm     : sine-triangle comparison on leg A (half-bridge)
    bipolar  : S1,S4 when ref > carrier, S2,S3 otherwise (vo = +-Vdc)
    unipolar : leg A compares +ref, leg B compares -ref (vo = +Vdc, 0, -Vdc)"""
    t = np.asarray(t, float)
    ref = ma * np.sin(2 * np.pi * fm * t)
    car = tri_carrier(t, fm * mf)
    if mode == 'square':
        a = ((t * fm + _EPS) % 1.0) < 0.5
        b = ~a
    elif mode in ('spwm', 'bipolar'):
        a = ref > car; b = ~a
    elif mode == 'unipolar':
        a = ref > car; b = (-ref) > car
    else:
        raise ValueError(f"Unknown modulation '{mode}'")
    return a.astype(float), b.astype(float), ref, car


def _inverter_gates(p):
    fm, mf, ma = float(p['frequency']), float(p['mf']), float(p['ma'])
    mode, td = p.get('mode', 'bipolar'), float(p.get('dead_s', 0.0))

    def leg(which):
        def cmd(t):
            a, b, _, _ = inverter_commands(t, mode, fm, mf, ma)
            return a if which == 'A' else b
        return cmd

    def gate(which, top):
        cmd = leg(which)
        def fn(t):
            c0 = cmd(t)
            if td > 0:
                c1 = cmd(t - td)
                on = c0 * c1 if top else (1 - c0) * (1 - c1)     # delay turn-on of each device by the dead time
            else:
                on = c0 if top else 1 - c0
            return float(on)
        return fn

    sig = {'G1': gate('A', True), 'G2': gate('A', False)}
    if p.get('topology') == 'full':
        sig.update({'G3': gate('B', True), 'G4': gate('B', False)})
    sig['REF'] = lambda t: float(ma * np.sin(2 * np.pi * fm * t))
    sig['CAR'] = lambda t: float(tri_carrier(t, fm * mf))
    return sig
