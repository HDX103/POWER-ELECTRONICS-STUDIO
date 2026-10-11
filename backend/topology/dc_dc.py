import numpy as np
from typing import Dict
from devices.base import SwitchState
from topology.base import BaseTopology

class BuckConverter(BaseTopology):
    id = "dcdc_buck"
    name = "Buck Converter"
    family = "DC-DC"
    
    def initial_state(self) -> Dict[str, float]:
        return {"iL": 0.0, "vC": 0.0}
        
    def calculate_control(self, t: float, dt: float) -> Dict[str, float]:
        f_sw = self.control.get('f_sw', 20000.0) # 20 kHz default
        duty = self.control.get('duty', 0.5)
        
        period = 1.0 / f_sw
        t_in_period = t % period
        
        g_s1 = 1.0 if t_in_period < (duty * period) else 0.0
        return {"S1": g_s1, "D1": 0.0} # Diode isn't gated, S1 is
        
    def step(self, t: float, dt: float) -> Dict[str, float]:
        vin = self.source.get('vin', 24.0)
        
        gates = self.calculate_control(t, dt)
        
        iL = self.state["iL"]
        vC = self.state["vC"]
        
        # Determine device states
        s1 = self.devices["S1"].determine_state(vin - vC, iL, gates["S1"])
        
        # Diode evaluates state based on inductor current seeking a path, or negative voltage
        # In a buck, if S1 is OFF and iL > 0, D1 must conduct (freewheel)
        v_d1_ak = -vC if s1 == SwitchState.OFF else vin - vC # Simplification
        d1 = self.devices["D1"].determine_state(v_d1_ak, iL if s1 == SwitchState.OFF else 0, 0.0)
        
        self.devices["S1"].current_state = s1
        self.devices["D1"].current_state = d1
        
        # State equations
        R = self.load.get("R", 10.0)
        L = self.load.get("L", 1e-3)
        C = self.load.get("C", 100e-6)
        
        s1_on = s1 in (SwitchState.ON, SwitchState.CONDUCTING)
        d1_on = d1 in (SwitchState.CONDUCTING, SwitchState.ON)
        
        if s1_on:
            diL = (vin - vC - self.devices["S1"].get_voltage_drop()) / L
        elif d1_on and iL > 0:
            diL = (-vC - self.devices["D1"].get_voltage_drop()) / L
        else:
            diL = 0
            iL = 0.0
            
        dvC = (iL - (vC / R)) / C
        
        iL += diL * dt
        if not s1_on and iL < 0:
            iL = 0.0 # Prevent negative current in simple diode model (DCM)
            
        vC += dvC * dt
        
        self.state["iL"] = iL
        self.state["vC"] = vC
        
        return {
            "time": t,
            "vin": vin,
            "vout": vC,
            "iL": iL,
            "S1_state": s1.name,
            "D1_state": d1.name
        }


class BoostConverter(BaseTopology):
    id = "dcdc_boost"
    name = "Boost Converter"
    family = "DC-DC"
    
    def initial_state(self) -> Dict[str, float]:
        return {"iL": 0.0, "vC": 0.0}
        
    def calculate_control(self, t: float, dt: float) -> Dict[str, float]:
        f_sw = self.control.get('f_sw', 20000.0)
        duty = self.control.get('duty', 0.5)
        
        period = 1.0 / f_sw
        g_s1 = 1.0 if (t % period) < (duty * period) else 0.0
        return {"S1": g_s1, "D1": 0.0}
        
    def step(self, t: float, dt: float) -> Dict[str, float]:
        vin = self.source.get('vin', 12.0)
        gates = self.calculate_control(t, dt)
        
        iL = self.state["iL"]
        vC = self.state["vC"]
        
        s1 = self.devices["S1"].determine_state(vin, iL, gates["S1"])
        
        # Diode conducts if S1 is OFF and inductor pushes current, or if Vin > vC
        v_d1_ak = vin - vC
        d1 = self.devices["D1"].determine_state(v_d1_ak, iL if s1 == SwitchState.OFF else 0, 0.0)
        
        self.devices["S1"].current_state = s1
        self.devices["D1"].current_state = d1
        
        R = self.load.get("R", 10.0)
        L = self.load.get("L", 1e-3)
        C = self.load.get("C", 100e-6)
        
        s1_on = s1 in (SwitchState.ON, SwitchState.CONDUCTING)
        d1_on = d1 in (SwitchState.CONDUCTING, SwitchState.ON)
        
        if s1_on:
            diL = (vin - self.devices["S1"].get_voltage_drop()) / L
            dvC = (-vC / R) / C
        elif d1_on and iL > 0:
            diL = (vin - vC - self.devices["D1"].get_voltage_drop()) / L
            dvC = (iL - (vC / R)) / C
        else:
            diL = 0
            iL = 0.0
            dvC = (-vC / R) / C
            
        iL += diL * dt
        if not s1_on and iL < 0:
            iL = 0.0
            
        vC += dvC * dt
        
        self.state["iL"] = iL
        self.state["vC"] = vC
        
        return {
            "time": t,
            "vin": vin,
            "vout": vC,
            "iL": iL,
            "S1_state": s1.name,
            "D1_state": d1.name
        }

class BuckBoostConverter(BaseTopology):
    id = "dcdc_buckboost"
    name = "Buck‑Boost Converter"
    family = "DC-DC"
    
    def initial_state(self) -> Dict[str, float]:
        return {"iL": 0.0, "vC": 0.0}
        
    def calculate_control(self, t: float, dt: float) -> Dict[str, float]:
        f_sw = self.control.get('f_sw', 20000.0)
        duty = self.control.get('duty', 0.5)
        period = 1.0 / f_sw
        g_s = 1.0 if (t % period) < (duty * period) else 0.0
        return {"S1": g_s, "D1": 0.0}
        
    def step(self, t: float, dt: float) -> Dict[str, float]:
        vin = self.source.get('vin', 12.0)
        iL = self.state["iL"]
        vC = self.state["vC"]
        gates = self.calculate_control(t, dt)
        s1 = self.devices["S1"].determine_state(vin - vC, iL, gates["S1"])
        # diode conducts when switch OFF and inductor current positive
        d1_state = SwitchState.CONDUCTING if (s1 == SwitchState.OFF and iL > 0) else SwitchState.OFF
        self.devices["S1"].current_state = s1
        R = self.load.get("R", 10.0)
        L = self.load.get("L", 1e-3)
        C = self.load.get("C", 100e-6)
        if s1 == SwitchState.ON:
            diL = (vin - vC) / L
        elif d1_state == SwitchState.CONDUCTING:
            diL = (-vC) / L
        else:
            diL = 0.0
        dvC = (iL - vC / R) / C
        iL += diL * dt
        vC += dvC * dt
        self.state["iL"] = iL
        self.state["vC"] = vC
        return {"time": t, "vin": vin, "vout": vC, "iL": iL, "S1_state": s1.name, "D1_state": d1_state.name}

class CukConverter(BaseTopology):
    id = "dcdc_cuk"
    name = "Ćuk Converter"
    family = "DC-DC"
    
    def initial_state(self) -> Dict[str, float]:
        return {"iL1": 0.0, "iL2": 0.0, "vC": 0.0}
        
    def calculate_control(self, t: float, dt: float) -> Dict[str, float]:
        f_sw = self.control.get('f_sw', 20000.0)
        duty = self.control.get('duty', 0.5)
        period = 1.0 / f_sw
        g_s = 1.0 if (t % period) < (duty * period) else 0.0
        return {"S1": g_s, "D1": 0.0}
        
    def step(self, t: float, dt: float) -> Dict[str, float]:
        vin = self.source.get('vin', 12.0)
        iL1 = self.state["iL1"]
        iL2 = self.state["iL2"]
        vC = self.state["vC"]
        gates = self.calculate_control(t, dt)
        s1 = self.devices["S1"].determine_state(vin - vC, iL1, gates["S1"])
        d1_state = SwitchState.CONDUCTING if (s1 == SwitchState.OFF and iL1 > 0) else SwitchState.OFF
        self.devices["S1"].current_state = s1
        L1 = self.load.get("L1", 1e-3)
        L2 = self.load.get("L2", 1e-3)
        C = self.load.get("C", 100e-6)
        R = self.load.get("R", 10.0)
        if s1 == SwitchState.ON:
            diL1 = (vin - vC) / L1
        elif d1_state == SwitchState.CONDUCTING:
            diL1 = (-vC) / L1
        else:
            diL1 = 0.0
        diL2 = (vC - iL2 * R) / L2
        dvC = (iL1 - iL2) / C
        iL1 += diL1 * dt
        iL2 += diL2 * dt
        vC += dvC * dt
        self.state["iL1"] = iL1
        self.state["iL2"] = iL2
        self.state["vC"] = vC
        return {"time": t, "vin": vin, "vout": vC, "iL1": iL1, "iL2": iL2, "S1_state": s1.name, "D1_state": d1_state.name}

class SepicConverter(BaseTopology):
    id = "dcdc_sepic"
    name = "SEPIC Converter"
    family = "DC-DC"
    
    def initial_state(self) -> Dict[str, float]:
        return {"iL1": 0.0, "iL2": 0.0, "vC": 0.0}
        
    def calculate_control(self, t: float, dt: float) -> Dict[str, float]:
        f_sw = self.control.get('f_sw', 20000.0)
        duty = self.control.get('duty', 0.5)
        period = 1.0 / f_sw
        g_s = 1.0 if (t % period) < (duty * period) else 0.0
        return {"S1": g_s, "D1": 0.0}
        
    def step(self, t: float, dt: float) -> Dict[str, float]:
        vin = self.source.get('vin', 12.0)
        iL1 = self.state["iL1"]
        iL2 = self.state["iL2"]
        vC = self.state["vC"]
        gates = self.calculate_control(t, dt)
        s1 = self.devices["S1"].determine_state(vin, iL1, gates["S1"])
        d1_state = SwitchState.CONDUCTING if (s1 == SwitchState.OFF and iL1 > 0) else SwitchState.OFF
        self.devices["S1"].current_state = s1
        L1 = self.load.get("L1", 1e-3)
        L2 = self.load.get("L2", 1e-3)
        C = self.load.get("C", 100e-6)
        R = self.load.get("R", 10.0)
        if s1 == SwitchState.ON:
            diL1 = (vin - vC) / L1
        elif d1_state == SwitchState.CONDUCTING:
            diL1 = (-vC) / L1
        else:
            diL1 = 0.0
        diL2 = (vC - iL2 * R) / L2
        dvC = (iL1 - iL2) / C
        iL1 += diL1 * dt
        iL2 += diL2 * dt
        vC += dvC * dt
        self.state["iL1"] = iL1
        self.state["iL2"] = iL2
        self.state["vC"] = vC
        return {"time": t, "vin": vin, "vout": vC, "iL1": iL1, "iL2": iL2, "S1_state": s1.name, "D1_state": d1_state.name}

class ZetaConverter(BaseTopology):
    id = "dcdc_zeta"
    name = "Zeta Converter"
    family = "DC-DC"
    
    def initial_state(self) -> Dict[str, float]:
        return {"iL": 0.0, "vC": 0.0}
        
    def calculate_control(self, t: float, dt: float) -> Dict[str, float]:
        f_sw = self.control.get('f_sw', 20000.0)
        duty = self.control.get('duty', 0.5)
        period = 1.0 / f_sw
        g_s = 1.0 if (t % period) < (duty * period) else 0.0
        return {"S1": g_s, "D1": 0.0}
        
    def step(self, t: float, dt: float) -> Dict[str, float]:
        vin = self.source.get('vin', 12.0)
        iL = self.state["iL"]
        vC = self.state["vC"]
        gates = self.calculate_control(t, dt)
        s1 = self.devices["S1"].determine_state(vin - vC, iL, gates["S1"])
        d1_state = SwitchState.CONDUCTING if (s1 == SwitchState.OFF and iL > 0) else SwitchState.OFF
        self.devices["S1"].current_state = s1
        R = self.load.get("R", 10.0)
        L = self.load.get("L", 1e-3)
        C = self.load.get("C", 100e-6)
        if s1 == SwitchState.ON:
            diL = (vin - vC) / L
        elif d1_state == SwitchState.CONDUCTING:
            diL = (-vC) / L
        else:
            diL = 0.0
        dvC = (iL - vC / R) / C
        iL += diL * dt
        vC += dvC * dt
        self.state["iL"] = iL
        self.state["vC"] = vC
        return {"time": t, "vin": vin, "vout": vC, "iL": iL, "S1_state": s1.name, "D1_state": d1_state.name}
