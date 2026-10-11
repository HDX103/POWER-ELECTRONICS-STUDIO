from .base import PowerSwitch, SwitchState

class Diode(PowerSwitch):
    def determine_state(self, v_ak: float, i_device: float, gate_signal: float) -> SwitchState:
        # A diode conducts if forward biased (v_ak > Vf) or if current is flowing (i_device > 0)
        vf = self.params.get('Vf', 0.7)
        if self.current_state in (SwitchState.CONDUCTING, SwitchState.ON):
            if i_device > 0:
                return SwitchState.CONDUCTING
            else:
                return SwitchState.BLOCKING
        else:
            if v_ak > vf:
                return SwitchState.CONDUCTING
            else:
                return SwitchState.BLOCKING
                
    def get_voltage_drop(self) -> float:
        if self.current_state == SwitchState.CONDUCTING:
            return self.params.get('Vf', 0.7)
        return 0.0


class MOSFET(PowerSwitch):
    def determine_state(self, v_ak: float, i_device: float, gate_signal: float) -> SwitchState:
        # Gate controlled. ON when gate active. (Simplification: Ignore threshold for now, use binary gate)
        if gate_signal > 0:
            return SwitchState.ON
        
        # Body diode conduction (MOSFET blocks forward but conducts reverse if not gated)
        vf = self.params.get('Vf_body', 0.7)
        if v_ak < -vf or i_device < 0:
            return SwitchState.CONDUCTING
            
        return SwitchState.OFF


class IGBT(PowerSwitch):
    def determine_state(self, v_ak: float, i_device: float, gate_signal: float) -> SwitchState:
        if gate_signal > 0 and v_ak > 0:
            return SwitchState.ON
        return SwitchState.OFF
        
    def get_voltage_drop(self) -> float:
        if self.current_state == SwitchState.ON:
            return self.params.get('Vce_sat', 1.5)
        return 0.0


class SCR(PowerSwitch):
    def determine_state(self, v_ak: float, i_device: float, gate_signal: float) -> SwitchState:
        ih = self.params.get('holding_current', 0.01)
        
        if self.current_state == SwitchState.TRIGGERED:
            if i_device > ih:
                return SwitchState.TRIGGERED
            else:
                return SwitchState.BLOCKING
        else:
            if gate_signal > 0 and v_ak > 0:
                return SwitchState.TRIGGERED
            return SwitchState.BLOCKING


class IdealSwitch(PowerSwitch):
    def determine_state(self, v_ak: float, i_device: float, gate_signal: float) -> SwitchState:
        if gate_signal > 0:
            return SwitchState.ON
        return SwitchState.OFF
