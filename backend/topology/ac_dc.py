import numpy as np
from typing import Dict, Any, Tuple
from devices.base import SwitchState
from topology.base import BaseTopology

class SinglePhaseBridgeRectifier(BaseTopology):
    id = "acdc_1ph_full_bridge"
    name = "Single-Phase Full Bridge Rectifier"
    family = "AC-DC"
    
    def initial_state(self) -> Dict[str, float]:
        return {"iLoad": 0.0}
        
    def calculate_control(self, t: float, dt: float) -> Dict[str, float]:
        # Generate gate signals for T1, T2, T3, T4 based on firing angle alpha
        freq = self.source.get('freq', 50.0)
        alpha_deg = self.control.get('alpha', 0.0)
        
        omega = 2 * np.pi * freq
        period = 1.0 / freq
        
        # Calculate angle in the current cycle [0, 360)
        angle = (t % period) / period * 360.0
        
        # Simplified pulse generation: 10 degree wide pulse
        g12 = 1.0 if (alpha_deg <= angle <= alpha_deg + 10) else 0.0
        g34 = 1.0 if (alpha_deg + 180 <= angle <= alpha_deg + 190) else 0.0
        
        return {
            "T1": g12, "T2": g12,
            "T3": g34, "T4": g34
        }
        
    def step(self, t: float, dt: float) -> Dict[str, float]:
        freq = self.source.get('freq', 50.0)
        v_rms = self.source.get('rms', 230.0)
        omega = 2 * np.pi * freq
        
        # 1. Source voltage
        vs = np.sqrt(2) * v_rms * np.sin(omega * t)
        
        # 2. Control & States
        gates = self.calculate_control(t, dt)
        
        # Forward voltage biases (simplified estimation for state evaluation)
        v_ak_12 = vs if vs > 0 else 0
        v_ak_34 = -vs if vs < 0 else 0
        
        # Evaluate switch states
        i_load = self.state["iLoad"]
        
        # T1, T2 are forward if vs > 0
        s1 = self.devices["T1"].determine_state(v_ak_12, i_load, gates["T1"])
        s2 = self.devices["T2"].determine_state(v_ak_12, i_load, gates["T2"])
        
        # T3, T4 are forward if vs < 0
        s3 = self.devices["T3"].determine_state(v_ak_34, i_load, gates["T3"])
        s4 = self.devices["T4"].determine_state(v_ak_34, i_load, gates["T4"])
        
        self.devices["T1"].current_state = s1
        self.devices["T2"].current_state = s2
        self.devices["T3"].current_state = s3
        self.devices["T4"].current_state = s4
        
        path_12 = s1 in (SwitchState.ON, SwitchState.CONDUCTING, SwitchState.TRIGGERED) and \
                  s2 in (SwitchState.ON, SwitchState.CONDUCTING, SwitchState.TRIGGERED)
        path_34 = s3 in (SwitchState.ON, SwitchState.CONDUCTING, SwitchState.TRIGGERED) and \
                  s4 in (SwitchState.ON, SwitchState.CONDUCTING, SwitchState.TRIGGERED)
                  
        # 3. Solve Circuit Equations
        R = self.load.get("R", 10.0)
        L = self.load.get("L", 0.0)
        
        if path_12:
            vo = vs - self.devices["T1"].get_voltage_drop() - self.devices["T2"].get_voltage_drop()
        elif path_34:
            vo = -vs - self.devices["T3"].get_voltage_drop() - self.devices["T4"].get_voltage_drop()
        else:
            if i_load > 0 and L > 0:
                # Inductor forces current. If no freewheeling, voltage spikes negatively.
                # In a real bridge, body diodes or SCR natural commutation continues the current.
                # For simplified math model, assume it continues through the last active path until 0.
                if vs > 0: vo = vs
                else: vo = -vs
            else:
                vo = 0.0

        # Update Inductor Current (Euler step)
        if L > 0:
            di = (vo - i_load * R) / L * dt
            i_load += di
            if not (path_12 or path_34) and i_load < 0:
                i_load = 0.0 # Discontinuous conduction mode
        else:
            i_load = vo / R if vo > 0 else 0.0
            
        self.state["iLoad"] = i_load
        
        return {
            "time": t,
            "vs": vs,
            "vo": vo,
            "io": i_load,
            "T1_state": s1.name,
            "T3_state": s3.name
        }
