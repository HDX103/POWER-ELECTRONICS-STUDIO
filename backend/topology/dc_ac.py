import numpy as np
from typing import Dict
from devices.base import SwitchState
from topology.base import BaseTopology

class HalfBridgeInverter(BaseTopology):
    """Single-phase half‑bridge inverter.
    Device slots:
        S1 – high‑side switch
        S2 – low‑side switch (complementary)
    Control parameters:
        f_sw – switching frequency (carrier)
        f_out – desired output AC frequency
        modulation – modulation index (0‑1)
    """
    id = "dcac_half_bridge"
    name = "Half‑Bridge Inverter"
    family = "DC-AC"

    def initial_state(self) -> Dict[str, float]:
        # store carrier phase accumulator
        return {"carrier_phase": 0.0, "iL": 0.0, "vC": 0.0}

    def calculate_control(self, t: float, dt: float) -> Dict[str, float]:
        f_sw = self.control.get('f_sw', 20000.0)   # carrier frequency
        f_out = self.control.get('f_out', 50.0)    # output frequency
        modulation = self.control.get('modulation', 0.8)  # 0‑1
        # triangular carrier (0‑1 range)
        carrier_phase = (self.state["carrier_phase"] + dt * f_sw) % 1.0
        # map carrier Phase to triangular wave [-1,1]
        carrier = 2.0 * carrier_phase if carrier_phase < 0.5 else 2.0 * (1.0 - carrier_phase)
        # reference sine wave ([-1,1])
        ref = modulation * np.sin(2 * np.pi * f_out * t)
        # Simple SPWM: high‑side on when ref > carrier, low‑side otherwise
        s1_gate = 1.0 if ref > carrier else 0.0
        s2_gate = 1.0 - s1_gate  # complementary
        return {"S1": s1_gate, "S2": s2_gate}

    def step(self, t: float, dt: float) -> Dict[str, float]:
        vin = self.source.get('vin', 24.0)
        # Update carrier phase for next step
        self.state["carrier_phase"] = (self.state["carrier_phase"] + dt * self.control.get('f_sw', 20000.0)) % 1.0
        gates = self.calculate_control(t, dt)
        # Determine device states
        s1 = self.devices["S1"].determine_state(vin, 0, gates["S1"])  # ideal switch sees source voltage
        s2 = self.devices["S2"].determine_state(0, 0, gates["S2"])   # low side to ground
        self.devices["S1"].current_state = s1
        self.devices["S2"].current_state = s2
        # Output voltage across load: +Vin when S1 on, -Vin when S2 on (assuming bipolar)
        v_out = vin if s1 == SwitchState.ON else (-vin if s2 == SwitchState.ON else 0.0)
        # Simple RL load (R and L)
        R = self.load.get("R", 10.0)
        L = self.load.get("L", 1e-3)
        iL = self.state["iL"]
        diL = (v_out - iL * R) / L
        iL += diL * dt
        self.state["iL"] = iL
        return {"time": t, "vin": vin, "vout": v_out, "iL": iL,
                "S1_state": s1.name, "S2_state": s2.name}

class FullBridgeInverter(BaseTopology):
    """Single-phase full‑bridge inverter with four switches.
    Device slots: S1, S2 (upper leg), S3, S4 (lower leg).
    Control uses SPWM with complementary pairs.
    """
    id = "dcac_full_bridge"
    name = "Full‑Bridge Inverter"
    family = "DC-AC"

    def initial_state(self) -> Dict[str, float]:
        return {"carrier_phase": 0.0, "iL": 0.0}

    def calculate_control(self, t: float, dt: float) -> Dict[str, float]:
        f_sw = self.control.get('f_sw', 20000.0)
        f_out = self.control.get('f_out', 50.0)
        modulation = self.control.get('modulation', 0.8)
        carrier_phase = (self.state["carrier_phase"] + dt * f_sw) % 1.0
        carrier = 2.0 * carrier_phase if carrier_phase < 0.5 else 2.0 * (1.0 - carrier_phase)
        ref = modulation * np.sin(2 * np.pi * f_out * t)
        # Upper leg ON when ref > carrier, lower leg opposite
        upper_gate = 1.0 if ref > carrier else 0.0
        lower_gate = 1.0 - upper_gate
        return {"S1": upper_gate, "S2": 0.0, "S3": lower_gate, "S4": 0.0}

    def step(self, t: float, dt: float) -> Dict[str, float]:
        vin = self.source.get('vin', 24.0)
        self.state["carrier_phase"] = (self.state["carrier_phase"] + dt * self.control.get('f_sw', 20000.0)) % 1.0
        gates = self.calculate_control(t, dt)
        # Upper leg (S1, S2) behave as a single switch; lower leg (S3, S4) opposite
        s1 = self.devices["S1"].determine_state(vin, 0, gates["S1"])  # high side
        s3 = self.devices["S3"].determine_state(0, 0, gates["S3"])   # low side to ground
        self.devices["S1"].current_state = s1
        self.devices["S3"].current_state = s3
        v_out = vin if s1 == SwitchState.ON else (-vin if s3 == SwitchState.ON else 0.0)
        R = self.load.get("R", 10.0)
        L = self.load.get("L", 1e-3)
        iL = self.state["iL"]
        diL = (v_out - iL * R) / L
        iL += diL * dt
        self.state["iL"] = iL
        return {"time": t, "vin": vin, "vout": v_out, "iL": iL,
                "S1_state": s1.name, "S3_state": s3.name}

class PushPullInverter(BaseTopology):
    """Single‑phase push‑pull inverter (two primary switches).
    Device slots: S1, S2 – driven complementary.
    """
    id = "dcac_push_pull"
    name = "Push‑Pull Inverter"
    family = "DC-AC"

    def initial_state(self) -> Dict[str, float]:
        return {"carrier_phase": 0.0, "iL": 0.0}

    def calculate_control(self, t: float, dt: float) -> Dict[str, float]:
        f_sw = self.control.get('f_sw', 20000.0)
        f_out = self.control.get('f_out', 50.0)
        modulation = self.control.get('modulation', 0.8)
        carrier_phase = (self.state["carrier_phase"] + dt * f_sw) % 1.0
        carrier = 2.0 * carrier_phase if carrier_phase < 0.5 else 2.0 * (1.0 - carrier_phase)
        ref = modulation * np.sin(2 * np.pi * f_out * t)
        s1_gate = 1.0 if ref > carrier else 0.0
        s2_gate = 1.0 - s1_gate
        return {"S1": s1_gate, "S2": s2_gate}

    def step(self, t: float, dt: float) -> Dict[str, float]:
        vin = self.source.get('vin', 24.0)
        self.state["carrier_phase"] = (self.state["carrier_phase"] + dt * self.control.get('f_sw', 20000.0)) % 1.0
        gates = self.calculate_control(t, dt)
        s1 = self.devices["S1"].determine_state(vin, 0, gates["S1"])
        s2 = self.devices["S2"].determine_state(0, 0, gates["S2"])
        self.devices["S1"].current_state = s1
        self.devices["S2"].current_state = s2
        v_out = vin if s1 == SwitchState.ON else (-vin if s2 == SwitchState.ON else 0.0)
        R = self.load.get("R", 10.0)
        L = self.load.get("L", 1e-3)
        iL = self.state["iL"]
        diL = (v_out - iL * R) / L
        iL += diL * dt
        self.state["iL"] = iL
        return {"time": t, "vin": vin, "vout": v_out, "iL": iL,
                "S1_state": s1.name, "S2_state": s2.name}
