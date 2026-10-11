"""Closed-form / semi-analytic theory for every supported topology (independent of the solver)."""
import numpy as np
from scipy.optimize import brentq
from .analysis import scr_bridge_theory, _resistive


def _base(p):
    Vm = p['vs_rms'] * np.sqrt(2); R, L, E = p['r'], p.get('l', 0.0), p.get('E', 0.0)
    w = 2 * np.pi * p['freq']; X = w * L
    Z = np.hypot(R, X); phi = np.arctan2(X, R); wt = X / R
    return Vm, R, L, E, w, Z, phi, wt


def _first_zero(f, a, b, n=4000):
    g = np.linspace(a + 1e-6, b, n); v = f(g)
    neg = np.where(v <= 0)[0]
    if len(neg) and neg[0] > 0:
        return brentq(f, g[neg[0] - 1], g[neg[0]])
    return None


def filter_theory(p, fr):
    """Capacitor-input filter, ideal diodes, L = 0, E = 0: exact exponential-discharge solution.
    Discharge leaves the sine at the tangent point (tan th_a = -wRC) and rejoins it at th_b.
    Falls back to the textbook ripple approximation when L or E is present."""
    Vm = p['vs_rms'] * np.sqrt(2); R = p['r']; C = p['c_uf'] * 1e-6; w = 2 * np.pi * p['freq']
    if p.get('l', 0) > 0 or p.get('E', 0) > 0:
        dV = min(Vm / (fr * p['freq'] * R * C), Vm)
        return {'mode': 'capacitor filter (approx.)', 'Vo_avg': Vm - dV / 2, 'Io_avg': (Vm - dV / 2) / R, 'Vo_rms': None,
                'Io_rms': None, 'ripple_pp': dV, 'Vm': Vm, 'note': 'Approximation ΔV ≈ Vm/(f_r·R·C); exact solution only for L = 0, E = 0.'}
    x = w * R * C; per = 2 * np.pi / fr                       # conduction period in radians
    ta = np.pi - np.arctan(x)
    f = lambda tb: np.sin(tb) - np.sin(ta) * np.exp(-(tb + per - ta) / x)
    tb = brentq(f, 1e-9, np.pi / 2)
    t1 = np.linspace(tb, ta, 20001); t2 = np.linspace(ta, tb + per, 20001)
    v1 = Vm * np.sin(t1); v2 = Vm * np.sin(ta) * np.exp(-(t2 - ta) / x)
    avg = (np.trapezoid(v1, t1) + np.trapezoid(v2, t2)) / per
    rms = np.sqrt((np.trapezoid(v1 ** 2, t1) + np.trapezoid(v2 ** 2, t2)) / per)
    return {'mode': 'capacitor filter', 'Vo_avg': float(avg), 'Io_avg': float(avg / R), 'Vo_rms': float(rms), 'Io_rms': float(rms / R),
            'ripple_pp': float(Vm * (1 - np.sin(tb))), 'Vm': Vm, 'conduction_deg': float(np.rad2deg(ta - tb)),
            'note': 'Exact for ideal diodes, L = 0, E = 0 (Ron drop makes the simulation slightly lower).'}


def halfwave_theory(p):
    Vm, R, L, E, w, Z, phi, wt = _base(p)
    res = {'Vm': Vm, 'Z': Z, 'phi_deg': float(np.rad2deg(phi))}
    if p.get('fwd') and E == 0:
        res.update(mode='freewheeling diode', Vo_avg=Vm / np.pi, Vo_rms=Vm / 2, Io_avg=Vm / np.pi / R, Io_rms=None,
                   extinction_deg=None, note='With a freewheeling diode and E = 0: Vo_avg = Vm/π, Vo_rms = Vm/2.')
        return res
    if p.get('fwd'):
        res.update(mode='n/a', Vo_avg=None, Io_avg=None, Vo_rms=None, Io_rms=None); return res
    if L <= 0:
        return _resistive(Vm, R, E, 0.0, res, '2pi')
    if E >= Vm:
        res.update(mode='no conduction', Vo_avg=E, Io_avg=0.0, Vo_rms=E, Io_rms=0.0); return res
    th0 = float(np.arcsin(E / Vm)) if E > 0 else 0.0
    K = E / R - Vm / Z * np.sin(th0 - phi)
    f = lambda th: Vm / Z * np.sin(th - phi) - E / R + K * np.exp(-(th - th0) / wt)
    beta = _first_zero(f, th0, th0 + 2 * np.pi) or (th0 + 2 * np.pi)
    th = np.linspace(th0, beta, 40001); i = f(th)
    vc = Vm * np.sin(th)          # while i>0 the diode conducts, so vo = vs (even when vs<0, held on by L)
    idle = 2 * np.pi - (beta - th0)
    Vo_avg = (np.trapezoid(vc, th) + E * idle) / (2 * np.pi)
    Vo_rms = np.sqrt((np.trapezoid(vc ** 2, th) + E ** 2 * idle) / (2 * np.pi))
    res.update(mode='continuous-ish (L-delayed turn-off)' if beta > np.pi else 'discontinuous', Vo_avg=float(Vo_avg),
               Vo_rms=float(Vo_rms), Io_avg=float((Vo_avg - E) / R), Io_rms=float(np.sqrt(np.trapezoid(i ** 2, th) / (2 * np.pi))),
               extinction_deg=float(np.rad2deg(beta)))
    return res


def semi_theory(p):
    Vm, R, L, E, w, Z, phi, wt = _base(p)
    a = np.deg2rad(p['alpha_deg'])
    res = {'Vm': Vm, 'Z': Z, 'phi_deg': float(np.rad2deg(phi))}
    if L <= 0:
        return scr_bridge_theory({**p, 'l': 0.0, 'fwd': False})
    if E >= Vm:
        res.update(mode='no conduction', Vo_avg=E, Io_avg=0.0, Vo_rms=E, Io_rms=0.0); return res
    seg1 = lambda th, ts, i0: Vm / Z * np.sin(th - phi) - E / R + (i0 + E / R - Vm / Z * np.sin(ts - phi)) * np.exp(-(th - ts) / wt)
    seg2 = lambda th, t2, i2: -E / R + (i2 + E / R) * np.exp(-(th - t2) / wt)
    def end(I0):
        return seg2(a + np.pi, np.pi, seg1(np.pi, a, I0))
    f0, f1 = end(0.0), end(1.0); m = f1 - f0
    I0 = f0 / (1 - m)
    th = np.linspace(a, a + np.pi, 40001)
    ic = np.where(th <= np.pi, seg1(th, a, I0), seg2(th, np.pi, seg1(np.pi, a, I0)))
    if I0 >= 0 and ic.min() >= -1e-9:
        vo = np.where(th <= np.pi, Vm * np.sin(th), 0.0)
        res.update(mode='continuous', I0=float(I0), Vo_avg=Vm / np.pi * (1 + np.cos(a)),
                   Vo_rms=float(np.sqrt(np.trapezoid(vo ** 2, th) / np.pi)), Io_avg=float((Vm / np.pi * (1 + np.cos(a)) - E) / R),
                   Io_rms=float(np.sqrt(np.trapezoid(ic ** 2, th) / np.pi)), extinction_deg=None)
        return res
    ts = max(a, np.arcsin(E / Vm) if E > 0 else a)
    if ts >= np.pi:
        res.update(mode='discontinuous', Vo_avg=E, Io_avg=0.0, Vo_rms=E, Io_rms=0.0); return res
    g1 = lambda x: seg1(x, ts, 0.0)
    b1 = _first_zero(g1, ts, np.pi)
    if b1 is not None:
        beta = b1; th = np.linspace(ts, beta, 40001); i = g1(th); vo = Vm * np.sin(th)
        idle = np.pi - (beta - ts)
        Vo_avg = (np.trapezoid(vo, th) + E * idle) / np.pi
        Vo_rms = np.sqrt((np.trapezoid(vo ** 2, th) + E ** 2 * idle) / np.pi)
        Io_rms = np.sqrt(np.trapezoid(i ** 2, th) / np.pi)
    else:
        ipi = g1(np.pi)
        beta = min(np.pi + wt * np.log(1 + ipi * R / E), ts + np.pi) if E > 0 else ts + np.pi
        t1 = np.linspace(ts, np.pi, 20001); t2 = np.linspace(np.pi, beta, 20001)
        i1, i2 = g1(t1), seg2(t2, np.pi, ipi); v1 = Vm * np.sin(t1)
        idle = (ts + np.pi) - beta
        Vo_avg = (np.trapezoid(v1, t1) + E * idle) / np.pi
        Vo_rms = np.sqrt((np.trapezoid(v1 ** 2, t1) + E ** 2 * idle) / np.pi)
        Io_rms = np.sqrt((np.trapezoid(i1 ** 2, t1) + np.trapezoid(i2 ** 2, t2)) / np.pi)
    res.update(mode='discontinuous', Vo_avg=float(Vo_avg), Vo_rms=float(Vo_rms), Io_avg=float((Vo_avg - E) / R),
               Io_rms=float(Io_rms), extinction_deg=float(np.rad2deg(beta)))
    return res


def dc_theory(topo, p):
    Vin, D, T = p['vin'], p['duty'], 1.0 / (p['fsw_khz'] * 1e3)
    L, C, R = p['l_uh'] * 1e-6, p['c_uf'] * 1e-6, p['r']
    Lcrit = {'buck': (1 - D) * R * T / 2, 'boost': D * (1 - D) ** 2 * R * T / 2, 'buckboost': (1 - D) ** 2 * R * T / 2}[topo]
    K = 2 * L / (R * T)
    ccm = L >= Lcrit
    if ccm:
        if topo == 'buck':    Vo = D * Vin; IL = Vo / R; dI = (Vin - Vo) * D * T / L; dV = dI * T / (8 * C)
        elif topo == 'boost': Vo = Vin / (1 - D); IL = Vo / (R * (1 - D)); dI = Vin * D * T / L; dV = _cap_ripple(IL, dI, abs(Vo) / R, D, T, C)
        else:                 Vo = -D * Vin / (1 - D); IL = abs(Vo) / (R * (1 - D)); dI = Vin * D * T / L; dV = _cap_ripple(IL, dI, abs(Vo) / R, D, T, C)
    else:
        if topo == 'buck':
            Vo = Vin * 2 / (1 + np.sqrt(1 + 4 * K / D ** 2)); IL = Vo / R; dI = (Vin - Vo) * D * T / L
        elif topo == 'boost':
            Vo = Vin * (1 + np.sqrt(1 + 4 * D ** 2 / K)) / 2; IL = Vo ** 2 / (R * Vin); dI = Vin * D * T / L
        else:
            Vo = -Vin * D / np.sqrt(K); IL = Vo ** 2 / (R * Vin) + abs(Vo) / R; dI = Vin * D * T / L
        dV = None
    return {'mode': 'CCM' if ccm else 'DCM', 'Vo_avg': float(Vo), 'Io_avg': float(Vo / R), 'IL_avg': float(IL),
            'dIL_pp': float(dI), 'dVo_pp': None if dV is None else float(dV), 'L_crit_uh': float(Lcrit * 1e6),
            'gain': float(Vo / Vin)}


def _cap_ripple(IL, dI, Io, D, T, C):
    """Exact peak-to-peak ripple of an ideal capacitor for boost / buck-boost (CCM).
    On-time: capacitor alone feeds the load (i_c = -Io). Off-time: i_c = i_L(t) - Io, i_L ramping down by dI."""
    t = np.linspace(0, T, 40001)
    iL = np.where(t < D * T, 0.0, IL + dI / 2 - dI / ((1 - D) * T) * (t - D * T))
    ic = np.where(t < D * T, -Io, iL - Io)
    v = np.concatenate([[0.0], np.cumsum((ic[1:] + ic[:-1]) / 2 * np.diff(t))]) / C
    return float(v.max() - v.min())


def inverter_theory(p, topo):
    """Ideal steady state of a half/full-bridge inverter with an R-L load.
    Builds the ideal (lossless, zero dead-time) PWM voltage, takes its exact spectrum and solves the load harmonic by harmonic."""
    from .control import inverter_commands
    Vdc, fm, R, L = p['vdc'], p['freq'], p['r'], p['l']
    mode, mf, ma = p['mod'], int(round(p['mf'])), p['ma']
    N = max(mf, 3) * 400
    t = np.arange(N) / N / fm
    a, b, _, _ = inverter_commands(t, mode, fm, mf, ma)
    vo = Vdc * (a - b) if topo == 'full' else Vdc / 2 * (2 * a - 1)
    X = np.fft.rfft(vo) / N
    n = np.arange(len(X)); Z = R + 1j * 2 * np.pi * fm * n * L
    Xi = X / Z
    i = np.fft.irfft(Xi * N, N)
    hmax = int(p.get('max_harmonic', 100))
    V = 2 * np.abs(X); I = 2 * np.abs(Xi)
    thd = lambda A: float(np.sqrt(np.sum(A[2:hmax + 1] ** 2)) / A[1] * 100) if A[1] > 1e-12 else None
    k = 1.0 if topo == 'full' else 0.5
    if mode == 'square':
        V1 = 4 * Vdc * k / np.pi; rms_an = Vdc * k
    elif mode == 'unipolar':
        V1 = ma * Vdc; rms_an = Vdc * np.sqrt(2 * min(ma, 1.0) / np.pi)
    else:
        V1 = ma * Vdc * k; rms_an = Vdc * k
    lin = mode == 'square' or ma <= 1.0
    return {'mode': f"{'half' if topo == 'half' else 'full'}-bridge · {mode}", 'V1_pk': float(V1 if lin else V[1]), 'V1_pk_num': float(V[1]),
            'Vo_rms': float(np.sqrt(np.mean(vo ** 2))), 'Vo_rms_analytic': float(rms_an), 'Vo_avg': float(vo.mean()),
            'Io_rms': float(np.sqrt(np.mean(i ** 2))), 'Io_pk': float(np.max(np.abs(i))), 'I1_pk': float(I[1]),
            'thd_v': thd(V), 'thd_i': thd(I), 'Io_avg': float(i.mean()),
            'note': 'Ideal switches, no dead time: exact steady state from the ideal PWM spectrum and the load impedance at each harmonic.'}
