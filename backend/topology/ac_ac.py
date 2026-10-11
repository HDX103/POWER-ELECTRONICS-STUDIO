import numpy as np
from typing import Dict
from devices.base import SwitchState
from topology.base import BaseTopology

class SinglePhaseACVoltageController(BaseTopology):
    """Single‑phase AC voltage controller using an SCR (or triac).
    Parameters (in `control`):
        f_sw: not used – placeholder for legacy compatibility
        firing_angle: α in degrees (0‑180) – determines when SCR conducts each positive half‑cycle.
    """
    id = "acac_single_phase_voltage_controller"
    name = "Single‑Phase AC Voltage Controller"
    family = "AC-AC"

    def initial_state(self) -> Dict[str, float]:
        # Track SCR state across cycles
        return {"scr_on": False}

    def calculate_control(self, t: float, dt: float) -> Dict[str, float]:
        # Compute instantaneous source voltage
        V_rms = self.source.get('V_rms', 230.0)
        f = self.source.get('frequency', 50.0)
        V_m = V_rms * np.sqrt(2)
        omega = 2 * np.pi * f
        vs = V_m * np.sin(omega * t)
        # Firing angle in radians
        alpha_deg = self.control.get('firing_angle', 90)
        alpha = np.deg2rad(alpha_deg)
        # Determine angle within 0‑π (positive half‑cycle)
        angle = (omega * t) % (2 * np.pi)
        # SCR conducts when angle within [α, π] and voltage positive
        conduct = (0 <= angle <= np.pi) and (angle >= alpha)
        # Once on, stays on until voltage crosses zero (angle >= π)
        if self.state["scr_on"]:
            if angle >= np.pi:
                conduct = False
        return {"SCR": 1.0 if conduct else 0.0}

    def step(self, t: float, dt: float) -> Dict[str, float]:
        V_rms = self.source.get('V_rms', 230.0)
        f = self.source.get('frequency', 50.0)
        V_m = V_rms * np.sqrt(2)
        omega = 2 * np.pi * f
        vs = V_m * np.sin(omega * t)
        gates = self.calculate_control(t, dt)
        # Determine SCR state
        scr_state = self.devices["S1"].determine_state(vs, 0, gates["SCR"])
        self.devices["S1"].current_state = scr_state
        self.state["scr_on"] = scr_state == SwitchState.ON
        # Load (R‑L)
        R = self.load.get("R", 10.0)
        L = self.load.get("L", 1e-3)
        iL = self.state.get("iL", 0.0)
        # Voltage across load is vs when SCR on, else 0
        v_load = vs if scr_state == SwitchState.ON else 0.0
        diL = (v_load - iL * R) / L
        iL += diL * dt
        self.state["iL"] = iL
        return {"time": t, "vs": vs, "vout": v_load, "iL": iL, "S1_state": scr_state.name}

class ThreePhaseACVoltageController(BaseTopology):
    """Three‑phase AC voltage controller with independent SCRs per phase."""
    id = "acac_three_phase_voltage_controller"
    name = "Three‑Phase AC Voltage Controller"
    family = "AC-AC"

    def initial_state(self) -> Dict[str, float]:
        return {"scr_on_1": False, "scr_on_2": False, "scr_on_3": False}

    def calculate_control(self, t: float, dt: float) -> Dict[str, float]:
        V_rms = self.source.get('V_rms', 400.0)
        f = self.source.get('frequency', 50.0)
        V_m = V_rms * np.sqrt(2)
        omega = 2 * np.pi * f
        alpha_deg = self.control.get('firing_angle', 90)
        alpha = np.deg2rad(alpha_deg)
        # Phase shifts for a three‑phase system
        shifts = [0, -2*np.pi/3, 2*np.pi/3]
        gates = {}
        for i, shift in enumerate(shifts, start=1):
            angle = (omega * t + shift) % (2*np.pi)
            versus = V_m * np.sin(omega * t + shift)
            conduct = (0 <= angle <= np.pi) and (angle >= alpha)
            if self.state[f"scr_on_{i}"] and angle >= np.pi:
                conduct = False
            gates[f"SCR{i}"] = 1.0 if conduct else 0.0
        return gates

    def step(self, t: float, dt: float) -> Dict[str, float]:
        V_rms = self.source.get('V_rms', 400.0)
        f = self.source.get('frequency', 50.0)
        V_m = V_rms * np.sqrt(2)
        omega = 2 * np.pi * f
        shifts = [0, -2*np.pi/3, 2*np.pi/3]
        gates = self.calculate_control(t, dt)
        v_outs = []
        iL_total = 0.0
        R = self.load.get("R", 10.0)
        L = self.load.get("L", 1e-3)
        iL = self.state.get("iL", 0.0)
        for i, shift in enumerate(shifts, start=1):
            vs = V_m * np.sin(omega * t + shift)
            scr_state = self.devices[f"S{i}"].determine_state(vs, 0, gates[f"SCR{i}"])
            self.devices[f"S{i}"].current_state = scr_state
            self.state[f"scr_on_{i}"] = scr_state == SwitchState.ON
            v_load = vs if scr_state == SwitchState.ON else 0.0
            v_outs.append(v_load)
            # Sum currents from each phase (simplified delta connection)
            iL_total += (v_load - iL * R) / L * dt
        iL += iL_total / 3.0
        self.state["iL"] = iL
        return {"time": t, "vs": [V_m*np.sin(omega*t+sh) for sh in shifts],
                "vout": v_outs, "iL": iL,
                **{f"S{i}_state": self.devices[f"S{i}"].current_state.name for i in range(1,4)}}

class SinglePhaseCycloconverter(BaseTopology):
    """Simplified single‑phase cycloconverter.
    Uses two SCRs (positive and negative) to synthesize a lower‑frequency output.
    Control parameters:
        f_out – desired output frequency (must be < input frequency).
    """
    id = "acac_single_phase_cycloconverter"
    name = "Single‑Phase Cycloconverter"
    family = "AC-AC"

    def initial_state(self) -> Dict[str, float]:
        return {}

    def calculate_control(self, t: float, dt: float) -> Dict[str, float]:
        f_in = self.source.get('frequency', 50.0)
        f_out = self.control.get('f_out', 20.0)
        # Reference output sign
        out_sign = np.sign(np.sin(2*np.pi*f_out*t))
        # Input voltage sign determines which SCR can conduct
        V_rms = self.source.get('V_rms', 230.0)
        V_m = V_rms * np.sqrt(2)
        omega = 2*np.pi*f_in
        vs = V_m * np.sin(omega*t)
        # Positive SCR conducts when vs>0 and output wants positive
        pos_gate = 1.0 if (vs > 0 and out_sign > 0) else 0.0
        # Negative SCR conducts when vs<0 and output wants negative
        neg_gate = 1.0 if (vs < 0 and out_sign < 0) else 0.0
        return {"S1": pos_gate, "S2": neg_gate}

    def step(self, t: float, dt: float) -> Dict[str, float]:
        V_rms = self.source.get('V_rms', 230.0)
        V_m = V_rms * np.sqrt(2)
        f_in = self.source.get('frequency', 50.0)
        omega = 2*np.pi*f_in
        vs = V_m * np.sin(omega*t)
        gates = self.calculate_control(t, dt)
        s1 = self.devices["S1"].determine_state(vs, 0, gates["S1"])
        s2 = self.devices["S2"].determine_state(vs, 0, gates["S2"])
        self.devices["S1"].current_state = s1
        self.devices["S2"].current_state = s2
        # Output voltage is vs when the appropriate SCR is on, else 0
        v_out = vs if s1 == SwitchState.ON else (vs if s2 == SwitchState.ON else 0.0)
        # Load RL
        R = self.load.get("R", 10.0)
        L = self.load.get("L", 1e-3)
        iL = self.state.get("iL", 0.0)
        diL = (v_out - iL * R) / L
        iL += diL * dt
        self.state["iL"] = iL
        return {"time": t, "vs": vs, "vout": v_out, "iL": iL,
                "S1_state": s1.name, "S2_state": s2.name}

class ThreePhaseCycloconverter(BaseTopology):
    """Simplified three‑phase cycloconverter using six SCRs.
    Each phase has a positive and negative SCR (S1/S2, S3/S4, S5/S6).
    The control creates a lower‑frequency output by selecting the appropriate SCRs.
    """
    id = "acac_three_phase_cycloconverter"
    name = "Three‑Phase Cycloconverter"
    family = "AC-AC"

    def initial_state(self) -> Dict[str, float]:
        return {}

    def calculate_control(self, t: float, dt: float) -> Dict[str, float]:
        f_in = self.source.get('frequency', 50.0)
        f_out = self.control.get('f_out', 20.0)
        out_sign = np.sign(np.sin(2*np.pi*f_out*t))
        V_rms = self.source.get('V_rms', 400.0)
        V_m = V_rms * np.sqrt(2)
        omega = 2*np.pi*f_in
        # Phase shifts
        shifts = [0, -2*np.pi/3, 2*np.pi/3]
        gates = {}
        for i, shift in enumerate(shifts, start=1):
            vs = V_m * np.sin(omega*t + shift)
            # Positive SCR for this phase
            pos_key = f"S{i*2-1}"
            neg_key = f"S{i*2}"
            gates[pos_key] = 1.0 if (vs > 0 and out_sign > 0) else 0.0
            gates[neg_key] = 1.0 if (vs < 0 and out_sign < 0) else 0.0
        return gates

    def step(self, t: float, dt: float) -> Dict[str, float]:
        V_rms = self.source.get('V_rms', 400.0)
        V_m = V_rms * np.sqrt(2)
        f_in = self.source.get('frequency', 50.0)
        omega = 2*np.pi*f_in
        shifts = [0, -2*np.pi/3, 2*np.pi/3]
        gates = self.calculate_control(t, dt)
        v_outs = []
        for i, shift in enumerate(shifts, start=1):
            vs = V_m * np.sin(omega*t + shift)
            pos_key = f"S{i*2-1}"
            neg_key = f"S{i*2}"
            s_pos = self.devices[pos_key].determine_state(vs, 0, gates[pos_key])
            s_neg = self.devices[neg_key].determine_state(vs, 0, gates[neg_key])
            self.devices[pos_key].current_state = s_pos
            self.devices[neg_key].current_state = s_neg
            v_out = vs if s_pos == SwitchState.ON else (vs if s_neg == SwitchState.ON else 0.0)
            v_outs.append(v_out)
        # Simplified load (balanced three‑phase RL)
        R = self.load.get("R", 10.0)
        L = self.load.get("L", 1e-3)
        iL = self.state.get("iL", 0.0)
        # Average voltage for current update
        v_avg = sum(v_outs) / 3.0
        diL = (v_avg - iL * R) / L
        iL += diL * dt
        self.state["iL"] = iL
        return {"time": t, "vs": [V_m*np.sin(omega*t+sh) for sh in shifts],
                "vout": v_outs, "iL": iL,
                **{f"{k}_state": self.devices[k].current_state.name for k in self.devices}}
