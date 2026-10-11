import { MetricResults, TheoryModel } from '../types';

interface Props {
  theory: TheoryModel;
  metrics: MetricResults;
  topologyName: string;
}

export function TheoryView({ theory, metrics, topologyName }: Props) {
  const calcError = (sim: number, theo: number) => {
    if (Math.abs(theo) < 1e-4) return '0.0 %';
    const err = (Math.abs(sim - theo) / Math.abs(theo)) * 100;
    return `${err.toFixed(2)} %`;
  };

  return (
    <div className="w-full flex flex-col gap-4 bg-slate-900 border border-slate-800 rounded-lg p-4 text-xs">
      <div>
        <h3 className="text-sm font-bold text-sky-400">Mathematical Theory & Step-by-Step Derivation</h3>
        <p className="text-[11px] text-slate-400">
          Analytical equations, boundary conditions, and direct comparison with simulated results for {topologyName}
        </p>
      </div>

      {/* Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-slate-950 p-3 rounded border border-slate-800">
          <div className="text-[10px] uppercase text-slate-500 font-semibold">Average DC Output (Vdc)</div>
          <div className="flex justify-between items-baseline mt-1 font-mono">
            <span className="text-slate-300">
              Simulated: <b className="text-emerald-400">{metrics.vdc} V</b>
            </span>
            <span className="text-slate-300">
              Theory: <b className="text-sky-400">{theory.theoryVdc} V</b>
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 flex justify-between">
            <span>Deviation Error:</span>
            <span className="font-mono text-amber-400">{calcError(metrics.vdc, theory.theoryVdc)}</span>
          </div>
        </div>

        <div className="bg-slate-950 p-3 rounded border border-slate-800">
          <div className="text-[10px] uppercase text-slate-500 font-semibold">RMS Output Voltage (Vrms)</div>
          <div className="flex justify-between items-baseline mt-1 font-mono">
            <span className="text-slate-300">
              Simulated: <b className="text-emerald-400">{metrics.vrms} V</b>
            </span>
            <span className="text-slate-300">
              Theory: <b className="text-sky-400">{theory.theoryVrms} V</b>
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 flex justify-between">
            <span>Deviation Error:</span>
            <span className="font-mono text-amber-400">{calcError(metrics.vrms, theory.theoryVrms)}</span>
          </div>
        </div>

        <div className="bg-slate-950 p-3 rounded border border-slate-800">
          <div className="text-[10px] uppercase text-slate-500 font-semibold">Average DC Current (Idc)</div>
          <div className="flex justify-between items-baseline mt-1 font-mono">
            <span className="text-slate-300">
              Simulated: <b className="text-emerald-400">{metrics.idc} A</b>
            </span>
            <span className="text-slate-300">
              Theory: <b className="text-sky-400">{theory.theoryIdc} A</b>
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 flex justify-between">
            <span>Deviation Error:</span>
            <span className="font-mono text-amber-400">{calcError(metrics.idc, theory.theoryIdc)}</span>
          </div>
        </div>
      </div>

      {/* Primary Formulas Banner */}
      <div className="bg-slate-950/70 p-3 rounded border border-slate-800 flex flex-wrap gap-6 font-mono text-[11px]">
        <div>
          <span className="text-slate-500 block text-[10px]">Vdc Governing Equation:</span>
          <span className="text-sky-300 font-semibold">{theory.formulaVdc}</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px]">Vrms Governing Equation:</span>
          <span className="text-emerald-300 font-semibold">{theory.formulaVrms}</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px]">Idc Governing Equation:</span>
          <span className="text-cyan-300 font-semibold">{theory.formulaIdc}</span>
        </div>
      </div>

      {/* Step-by-step derivation steps */}
      <div className="flex flex-col gap-2.5">
        <h4 className="font-bold text-slate-300 text-xs">Step-by-Step Mathematical Derivation</h4>
        {theory.derivationSteps.map((step, idx) => (
          <div key={idx} className="bg-slate-950 p-3 rounded border border-slate-800/80 flex flex-col gap-1.5">
            <span className="font-semibold text-sky-400 text-[11px]">{step.title}</span>
            <div className="font-mono bg-slate-900/80 px-2.5 py-1.5 rounded text-slate-200 border border-slate-800">
              {step.latex}
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-400 mt-0.5">
              <span>{step.substituted}</span>
              <span className="font-mono font-bold text-emerald-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                {step.result}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Operational Notes */}
      {theory.operationNotes.length > 0 && (
        <div className="bg-sky-950/20 border border-sky-900/40 p-3 rounded text-sky-200 text-[11px] flex flex-col gap-1">
          <span className="font-bold">Circuit Operational Notes:</span>
          {theory.operationNotes.map((n, i) => (
            <p key={i}>• {n}</p>
          ))}
        </div>
      )}
    </div>
  );
}
