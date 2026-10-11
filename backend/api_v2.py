from fastapi import APIRouter
from typing import List, Dict, Any
from pydantic import BaseModel
import numpy as np

from devices.models import Diode, MOSFET, IGBT, SCR, IdealSwitch
from topology.ac_dc import SinglePhaseBridgeRectifier
from topology.dc_dc import BuckConverter, BoostConverter
from topology.dc_ac import HalfBridgeInverter, FullBridgeInverter, PushPullInverter
from topology.ac_ac import SinglePhaseACVoltageController, ThreePhaseACVoltageController, SinglePhaseCycloconverter, ThreePhaseCycloconverter
router = APIRouter()

FAMILIES = ["AC-AC", "AC-DC", "DC-DC", "DC-AC"]

TOPOLOGIES = [
    {
        "id": "acdc_1ph_full_bridge",
        "name": "Single-Phase Full Bridge Rectifier",
        "family": "AC-DC",
        "device_slots": ["T1", "T2", "T3", "T4"]
    },
    {
        "id": "dcdc_buck",
        "name": "Buck Converter",
        "family": "DC-DC",
        "device_slots": ["S1", "D1"]
    },
    {
        "id": "dcdc_boost",
        "name": "Boost Converter",
        "family": "DC-DC",
        "device_slots": ["S1", "D1"]
    },
    {
        "id": "dcac_half_bridge",
        "name": "Half-Bridge Inverter",
        "family": "DC-AC",
        "device_slots": ["S1", "S2"]
    },
    {
        "id": "dcac_full_bridge",
        "name": "Full-Bridge Inverter",
        "family": "DC-AC",
        "device_slots": ["S1", "S3"]
    },
    {
        "id": "dcac_push_pull",
        "name": "Push-Pull Inverter",
        "family": "DC-AC",
        "device_slots": ["S1", "S2"]
    },
    {
        "id": "acac_single_phase_voltage_controller",
        "name": "Single‑Phase AC Voltage Controller",
        "family": "AC-AC",
        "device_slots": ["S1"]
    },
    {
        "id": "acac_three_phase_voltage_controller",
        "name": "Three‑Phase AC Voltage Controller",
        "family": "AC-AC",
        "device_slots": ["S1", "S2", "S3"]
    },
    {
        "id": "acac_single_phase_cycloconverter",
        "name": "Single‑Phase Cycloconverter",
        "family": "AC-AC",
        "device_slots": ["S1", "S2"]
    },
    {
        "id": "acac_three_phase_cycloconverter",
        "name": "Three‑Phase Cycloconverter",
        "family": "AC-AC",
        "device_slots": ["S1", "S2", "S3", "S4", "S5", "S6"]
    }
]


DEVICE_CLASSES = {
    "Diode": Diode,
    "MOSFET": MOSFET,
    "IGBT": IGBT,
    "SCR": SCR,
    "IdealSwitch": IdealSwitch
}

@router.get("/families")
def get_families() -> List[str]:
    return FAMILIES

@router.get("/topologies")
def get_topologies(family: str = None) -> List[Dict[str, Any]]:
    if family:
        return [t for t in TOPOLOGIES if t["family"] == family]
    return TOPOLOGIES

class SimulationRequest(BaseModel):
    topology: str
    devices: Dict[str, str]
    source: Dict[str, float]
    load: Dict[str, float]
    control: Dict[str, float]
    time_stop: float = 0.04
    dt: float = 1e-6 # Finer dt for DC-DC 20kHz switching

@router.post("/simulate")
def simulate(req: SimulationRequest):
    # Instantiate devices
    devices = {}
    for slot, dev_type in req.devices.items():
        dev_class = DEVICE_CLASSES.get(dev_type, IdealSwitch)
        devices[slot] = dev_class(slot)
        
    # Instantiate topology
        # Instantiate topology based on requested ID
    if req.topology == "acdc_1ph_full_bridge":
        topo = SinglePhaseBridgeRectifier(devices, req.source, req.load, req.control)
    elif req.topology == "dcdc_buck":
        topo = BuckConverter(devices, req.source, req.load, req.control)
    elif req.topology == "dcdc_boost":
        topo = BoostConverter(devices, req.source, req.load, req.control)
    # DC-AC inverters
    elif req.topology == "dcac_half_bridge":
        topo = HalfBridgeInverter(devices, req.source, req.load, req.control)
    elif req.topology == "dcac_full_bridge":
        topo = FullBridgeInverter(devices, req.source, req.load, req.control)
    elif req.topology == "dcac_push_pull":
        topo = PushPullInverter(devices, req.source, req.load, req.control)
    # AC-AC converters
    elif req.topology == "acac_single_phase_voltage_controller":
        topo = SinglePhaseACVoltageController(devices, req.source, req.load, req.control)
    elif req.topology == "acac_three_phase_voltage_controller":
        topo = ThreePhaseACVoltageController(devices, req.source, req.load, req.control)
    elif req.topology == "acac_single_phase_cycloconverter":
        topo = SinglePhaseCycloconverter(devices, req.source, req.load, req.control)
    elif req.topology == "acac_three_phase_cycloconverter":
        topo = ThreePhaseCycloconverter(devices, req.source, req.load, req.control)
    else:
        return {"error": "Unsupported topology"}


    
    # Run simulation
    steps = int(req.time_stop / req.dt)
    
    results = {
        "time": np.zeros(steps).tolist(),
        "signals": {
            "v1": np.zeros(steps).tolist(),
            "v2": np.zeros(steps).tolist(),
            "i1": np.zeros(steps).tolist()
        },
        "device_states": {}
    }
    for s in devices.keys():
        results["device_states"][s] = []
    
    for i in range(steps):
        t = i * req.dt
        step_res = topo.step(t, req.dt)
        results["time"][i] = step_res["time"]
        
        # Normalize mapping of signals for UI
        if req.topology.startswith("acdc"):
            results["signals"]["v1"][i] = step_res.get("vs", 0)
            results["signals"]["v2"][i] = step_res.get("vo", 0)
            results["signals"]["i1"][i] = step_res.get("io", 0)
        else: # dc-dc
            results["signals"]["v1"][i] = step_res.get("vin", 0)
            results["signals"]["v2"][i] = step_res.get("vout", 0)
            results["signals"]["i1"][i] = step_res.get("iL", 0)
            
        for s in devices.keys():
            results["device_states"][s].append(step_res.get(f"{s}_state", ""))
        
    # Downsample for UI
    stride = max(1, steps // 2000)
    
    downsampled_signals = {
        k: v[::stride] for k, v in results["signals"].items()
    }
    downsampled_states = {
        k: v[::stride] for k, v in results["device_states"].items()
    }
    
    return {
        "success": True,
        "time": results["time"][::stride],
        "signals": downsampled_signals,
        "device_states": downsampled_states
    }

