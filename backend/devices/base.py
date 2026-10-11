import enum
from typing import Dict, Any

class SwitchState(enum.Enum):
    OFF = 0
    ON = 1
    BLOCKING = 2
    CONDUCTING = 3
    TRIGGERED = 4

class PowerSwitch:
    """Base class for all switching devices."""
    
    def __init__(self, device_id: str, params: Dict[str, Any] = None):
        self.id = device_id
        self.params = params or {}
        self.current_state = SwitchState.OFF
        
    def determine_state(self, v_ak: float, i_device: float, gate_signal: float) -> SwitchState:
        """Determines the conduction state based on voltages, currents, and gate control."""
        raise NotImplementedError
        
    def get_resistance(self) -> float:
        """Returns the equivalent resistance based on current state."""
        if self.current_state in (SwitchState.ON, SwitchState.CONDUCTING, SwitchState.TRIGGERED):
            return self.params.get('Ron', 1e-3)
        return self.params.get('Roff', 1e6)
        
    def get_voltage_drop(self) -> float:
        """Returns the forward voltage drop (e.g., Vf for diode, Vce_sat for IGBT)."""
        return 0.0
        
    def calculate_losses(self, current: float, voltage: float, dt: float) -> dict:
        """Calculates instantaneous conduction and switching losses."""
        # Base implementation for ideal/simple devices
        conduction_loss = abs(voltage * current) if self.current_state in (SwitchState.ON, SwitchState.CONDUCTING, SwitchState.TRIGGERED) else 0.0
        return {
            "conduction": conduction_loss,
            "switching": 0.0
        }
