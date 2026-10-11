from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
try:
    from simulation import (run_topology, sweep_topology, REGISTRY, defaults_for, SimulationError, validate)
except ImportError:
    # Legacy simulation module not present in Phase 2; placeholder definitions
    run_topology = lambda *args, **kwargs: {"error": "Legacy simulation not available"}
    sweep_topology = lambda *args, **kwargs: {"error": "Legacy simulation not available"}
    REGISTRY = {}
    defaults_for = lambda tid: {}
    SimulationError = Exception
    validate = lambda *args, **kwargs: []
try:
    from simulation.engine import simulate, v
    from simulation import metadata
    from simulation.netlist import normalize
except ImportError:
    # Legacy simulation not required for Phase 2; provide stubs
    simulate = lambda *args, **kwargs: {"error": "Legacy simulate not available"}
    v = lambda *args, **kwargs: 0
    metadata = lambda *args, **kwargs: {"library": lambda: []}
    normalize = lambda *args, **kwargs: ({}, [])
import api_v2

app = FastAPI(title="PowerElectronics Studio API", version="0.5.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

app.include_router(api_v2.router, prefix="/api/v2")

def _tid(name: str) -> str:
    tid = name.replace('-', '_')
    if tid not in REGISTRY:
        raise HTTPException(404, f"Unknown topology '{name}'. Available: {', '.join(REGISTRY)}")
    return tid


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/topologies")
def topologies():
    """Everything the UI needs to build itself: parameter schema (with defaults), flags, sweep definition."""
    out = []
    for tid, t in REGISTRY.items():
        d = defaults_for(tid)
        out.append({"id": tid, "name": t["name"], "kind": t["kind"], "defaults": d, "flags": t["flags"], "sweep": t["sweep"],
                    "params": [{**q, "default": d.get(q["key"], q["default"])} for q in t["params"]],
                    "gated": bool(t["gates"])})
    return out


@app.post("/api/simulate/{topology}")
def simulate_topology(topology: str, params: Dict[str, Any] = {}):
    try:
        return run_topology(_tid(topology), params)
    except SimulationError as e:
        return {"success": False, "error": str(e), "issues": [], "log": [f"error: {e}"]}


class SweepRequest(BaseModel):
    params: Dict[str, Any] = {}
    key: Optional[str] = None
    start: Optional[float] = None
    stop: Optional[float] = None
    points: Optional[int] = None


@app.post("/api/sweep/{topology}")
def sweep(topology: str, req: SweepRequest):
    tid = _tid(topology)
    try:
        return {"success": True, "sweep": REGISTRY[tid]["sweep"],
                "points": sweep_topology(tid, req.params, req.key, req.start, req.stop, req.points)}
    except SimulationError as e:
        return {"success": False, "error": str(e)}


@app.post("/api/topology/{topology}/netlist")
def netlist(topology: str, params: Dict[str, Any] = {}):
    tid = _tid(topology)
    return REGISTRY[tid]["build"]({**defaults_for(tid), **params})


@app.get("/api/components")
def components():
    """Component library: categories, pins, parameter schema, symbols. Drives the palette and parameter editor."""
    return metadata.library()


class NormalizeRequest(BaseModel):
    netlist: Dict[str, Any]
    fill_defaults: bool = True


@app.post("/api/netlist/normalize")
def normalize_netlist(req: NormalizeRequest):
    nl, issues = normalize(req.netlist, req.fill_defaults)
    return {"netlist": nl, "issues": issues}


@app.post("/api/validate")
def validate_netlist(req: Dict[str, Any]):
    return {"issues": validate(req)}


class NetlistRequest(BaseModel):
    netlist: Dict[str, Any]
    t_stop: float
    dt: float
    probes: List[str] = []


@app.post("/api/simulate-netlist")
def sim_netlist(req: NetlistRequest):
    """Generic entry point: any netlist the engine understands -> node voltages for requested nodes."""
    issues = validate(req.netlist, {"t_stop": req.t_stop, "dt": req.dt, "steps": int(req.t_stop / req.dt), "samples_per_cycle": 1e9})
    if any(i["level"] == "error" for i in issues):
        return {"success": False, "issues": issues}
    try:
        s = simulate(normalize(req.netlist)[0], req.t_stop, req.dt)
    except SimulationError as e:
        return {"success": False, "error": str(e), "issues": issues}
    stride = max(1, len(s["time"]) // 5000)
    nodes = req.probes or s["names"]
    return {"success": True, "issues": issues, "time": s["time"][::stride].tolist(),
            "signals": {f"v({n})": v(s, n)[::stride].tolist() for n in nodes}}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
