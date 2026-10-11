"""Measurements, FFT/THD and closed-form theory for the controlled bridge."""
import numpy as np
from scipy.optimize import brentq


def rms(x): return float(np.sqrt(np.mean(np.square(x))))
def avg(x): return float(np.mean(x))


def fft_harmonics(x, cycles, hmax):
    """x spans an integer number of cycles -> exact bins. Amplitudes are peak values."""
    N = len(x)
    X = np.fft.rfft(x) / N
    h = np.arange(0, hmax + 1)
    idx = h * cycles
    idx = idx[idx < len(X)]
    mag = np.abs(X[idx]) * np.where(h[:len(idx)] == 0, 1, 2)
    ph = np.angle(X[idx], deg=True)
    fund = mag[1] if len(mag) > 1 else 0.0
    thd = float(np.sqrt(np.sum(mag[2:] ** 2)) / fund * 100) if fund > 1e-12 else None
    return {
        'order': h[:len(idx)].tolist(), 'peak': mag.tolist(), 'rms': (mag / np.sqrt(2)).tolist(),
        'phase_deg': ph.tolist(), 'percent_of_fundamental': (mag / fund * 100).tolist() if fund > 1e-12 else None,
        'dc': float(mag[0]), 'fundamental_peak': float(fund), 'thd_percent': thd,
    }


def measurements(t, vs, vo, i_s, io, p, cycles):
    """All arrays cover an integer number of steady-state cycles."""
    Vo_avg, Vo_rms = avg(vo), rms(vo)
    Io_avg, Io_rms = avg(io), rms(io)
    Vs_rms, Is_rms = rms(vs), rms(i_s)
    P = avg(vs * i_s)
    S = Vs_rms * Is_rms
    pf = P / S if S > 1e-12 else None
    # displacement factor from fundamental of supply current vs voltage
    N = len(vs)
    V1 = np.fft.rfft(vs)[cycles]; I1 = np.fft.rfft(i_s)[cycles]
    dpf = float(np.cos(np.angle(V1) - np.angle(I1))) if abs(I1) > 1e-9 else None
    Is1_rms = 2 * abs(I1) / N / np.sqrt(2)
    dist = float(Is1_rms / Is_rms) if Is_rms > 1e-12 else None
    P_load = avg(vo * io)
    P_R = Io_rms ** 2 * p['r']
    return {
        'Vo_avg': Vo_avg, 'Vo_rms': Vo_rms, 'Vo_peak': float(np.max(np.abs(vo))),
        'Io_avg': Io_avg, 'Io_rms': Io_rms, 'Io_peak': float(np.max(np.abs(io))),
        'Vs_rms': Vs_rms, 'Is_rms': Is_rms, 'Is_peak': float(np.max(np.abs(i_s))),
        'P_in': P, 'S': S, 'Q': float(np.sqrt(max(S * S - P * P, 0.0))), 'PF': pf,
        'DPF': dpf, 'distortion_factor': dist,
        'P_load': P_load, 'P_R': P_R,
        'efficiency': (P_load / P) if P > 1e-9 else None,
        'form_factor': Vo_rms / Vo_avg if abs(Vo_avg) > 1e-9 else None,
        'ripple_factor': float(np.sqrt(max(Vo_rms ** 2 - Vo_avg ** 2, 0)) / abs(Vo_avg)) if abs(Vo_avg) > 1e-9 else None,
        'crest_factor_Vo': float(np.max(np.abs(vo)) / Vo_rms) if Vo_rms > 1e-9 else None,
        'Io_ripple_pp': float(np.max(io) - np.min(io)), 'Vo_ripple_pp': float(np.max(vo) - np.min(vo)),
    }


def scr_bridge_theory(p):
    """Closed-form (analytic current solution) values for one pulse period (pi rad).

    i(th) = Vm/Z sin(th - phi) - E/R + K exp(-(th - th0)/wt)
    Continuous: I0 from periodicity.  Discontinuous: i(th0)=0, extinction angle beta from i(beta)=0.
    """
    Vm = p['vs_rms'] * np.sqrt(2); R, L, E = p['r'], p['l'], p.get('E', 0.0)
    a = np.deg2rad(p['alpha_deg']); w = 2 * np.pi * p['freq']
    X = w * L; Z = np.hypot(R, X); phi = np.arctan2(X, R); wt = X / R
    res = {'Vm': Vm, 'Z': Z, 'phi_deg': float(np.rad2deg(phi))}
    if p.get('fwd'):
        if E == 0:
            va = Vm / np.pi * (1 + np.cos(a))
            res.update(mode='fwd (ideal, continuous)', Vo_avg=va, Io_avg=va / R, extinction_deg=None,
                       note='Freewheeling diode: Vo_avg = (Vm/π)(1+cos α). Valid for sufficiently large L.')
            return res
        res.update(mode='n/a', Vo_avg=None, Io_avg=None, note='No closed form with FWD and back-EMF.')
        return res
    if E >= Vm:
        res.update(mode='no conduction', Vo_avg=E, Io_avg=0.0, Vo_rms=E, Io_rms=0.0, extinction_deg=None); return res
    if L <= 0:                                   # purely resistive load
        return _resistive(Vm, R, E, a, res, 'pi')
    s = Vm / Z * np.sin(a - phi); e = np.exp(-np.pi / wt) if wt > 0 else 0.0
    I0 = -s * (1 + e) / (1 - e) - E / R if wt > 0 else None
    cont = False
    if I0 is not None and I0 >= 0:
        thc = np.linspace(a, a + np.pi, 4001)
        ic = Vm / Z * np.sin(thc - phi) - E / R + (I0 + E / R - s) * np.exp(-(thc - a) / wt)
        cont = bool(np.min(ic) >= -1e-9)      # periodic solution must stay non-negative
    if cont:
        res['mode'] = 'continuous'
        res['I0'] = float(I0)
        th = thc
        i = ic
        vo = Vm * np.abs(np.sin(th))
        res.update(Vo_avg=2 * Vm / np.pi * np.cos(a), Vo_rms=float(np.sqrt(np.trapezoid(vo ** 2, th) / np.pi)),
                   Io_avg=float((2 * Vm / np.pi * np.cos(a) - E) / R),
                   Io_rms=float(np.sqrt(np.trapezoid(i ** 2, th) / np.pi)), extinction_deg=None)
        return res
    res['mode'] = 'discontinuous'
    th0 = max(a, np.arcsin(E / Vm)) if E > 0 else a
    # a thyristor pair can only start while the source is positive in this half-cycle
    if th0 > np.pi:
        res.update(Vo_avg=E, Io_avg=0.0, Vo_rms=E, Io_rms=0.0, extinction_deg=None); return res
    K = E / R - Vm / Z * np.sin(th0 - phi)
    f = lambda th: Vm / Z * np.sin(th - phi) - E / R + K * np.exp(-(th - th0) / wt)
    grid = np.linspace(th0 + 1e-6, th0 + np.pi, 4000)
    vals = f(grid)
    neg = np.where(vals <= 0)[0]
    beta = brentq(f, grid[neg[0] - 1], grid[neg[0]]) if len(neg) and neg[0] > 0 else th0 + np.pi
    th = np.linspace(th0, beta, 20001)
    i = f(th); vc = Vm * np.sin(th)
    Vo_avg = (Vm * (np.cos(th0) - np.cos(beta)) + E * (np.pi - (beta - th0))) / np.pi
    Vo_rms = float(np.sqrt((np.trapezoid(vc ** 2, th) + E ** 2 * (np.pi - (beta - th0))) / np.pi))
    res.update(Vo_avg=float(Vo_avg), Vo_rms=Vo_rms, Io_avg=float((Vo_avg - E) / R),
               Io_rms=float(np.sqrt(np.trapezoid(i ** 2, th) / np.pi)), extinction_deg=float(np.rad2deg(beta)))
    return res


def _resistive(Vm, R, E, a, res, period):
    """R(-E) load: conducts while Vm*sin(th) > E (and th >= alpha). period 'pi' (bridge) or '2pi' (half-wave)."""
    P = np.pi if period == 'pi' else 2 * np.pi
    if E >= Vm:
        res.update(mode='no conduction', Vo_avg=E, Io_avg=0.0, Vo_rms=E, Io_rms=0.0, extinction_deg=None); return res
    th0 = max(a, np.arcsin(E / Vm) if E > 0 else 0.0)
    beta = np.pi - (np.arcsin(E / Vm) if E > 0 else 0.0)
    if th0 >= beta:
        res.update(mode='no conduction', Vo_avg=E, Io_avg=0.0, Vo_rms=E, Io_rms=0.0, extinction_deg=None); return res
    th = np.linspace(th0, beta, 20001)
    vc = Vm * np.sin(th); i = (vc - E) / R
    idle = P - (beta - th0)
    Vo_avg = (Vm * (np.cos(th0) - np.cos(beta)) + E * idle) / P
    Vo_rms = float(np.sqrt((np.trapezoid(vc ** 2, th) + E ** 2 * idle) / P))
    res.update(mode='resistive', Vo_avg=float(Vo_avg), Vo_rms=Vo_rms, Io_avg=float((Vo_avg - E) / R),
               Io_rms=float(np.sqrt(np.trapezoid(i ** 2, th) / P)), extinction_deg=float(np.rad2deg(beta)))
    return res


def dc_measurements(vin, iin, vo, io, il, vsw, idiode):
    Pin, Pout = avg(vin * iin), avg(vo * io)
    Vo_avg = avg(vo)
    return {
        'Vo_avg': Vo_avg, 'Vo_rms': rms(vo), 'Vo_ripple_pp': float(np.max(vo) - np.min(vo)),
        'Io_avg': avg(io), 'Io_rms': rms(io), 'IL_avg': avg(il), 'IL_peak': float(np.max(il)), 'IL_min': float(np.min(il)),
        'dIL_pp': float(np.max(il) - np.min(il)), 'Vin_avg': avg(vin), 'Iin_avg': avg(iin), 'Iin_rms': rms(iin),
        'P_in': Pin, 'P_out': Pout, 'efficiency': Pout / Pin if Pin > 1e-9 else None,
        'Vo_ripple_pct': float((np.max(vo) - np.min(vo)) / abs(Vo_avg) * 100) if abs(Vo_avg) > 1e-9 else None,
        'Vsw_peak': float(np.max(np.abs(vsw))), 'Id_avg': avg(idiode),
    }


def inv_measurements(vo, io, vdc, iin, fft_v, fft_i):
    Pout, Pin = avg(vo * io), avg(vdc * iin)
    Vo_rms, Io_rms = rms(vo), rms(io)
    return {
        'Vo_avg': avg(vo), 'Vo_rms': Vo_rms, 'Vo_peak': float(np.max(np.abs(vo))),
        'V1_pk': fft_v['fundamental_peak'], 'V1_rms': fft_v['fundamental_peak'] / np.sqrt(2), 'thd_v': fft_v['thd_percent'],
        'Io_avg': avg(io), 'Io_rms': Io_rms, 'Io_pk': float(np.max(np.abs(io))), 'I1_pk': fft_i['fundamental_peak'], 'thd_i': fft_i['thd_percent'],
        'P_out': Pout, 'P_in': Pin, 'efficiency': Pout / Pin if Pin > 1e-9 else None,
        'PF_load': Pout / (Vo_rms * Io_rms) if Vo_rms * Io_rms > 1e-9 else None, 'Iin_avg': avg(iin),
    }
