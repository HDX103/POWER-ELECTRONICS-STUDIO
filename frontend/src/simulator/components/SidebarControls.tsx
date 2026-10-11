import { useRef } from 'react';
import { Download, Upload, Sliders, Zap } from 'lucide-react';
import { ControlParams, ConverterFamily, LoadParams, SourceParams, TopologyDefinition } from '../types';

interface Props {
  families: ConverterFamily[];
  selectedFamily: ConverterFamily;
  onSelectFamily: (f: ConverterFamily) => void;
  topologies: TopologyDefinition[];
  selectedTopology: TopologyDefinition;
  onSelectTopology: (t: TopologyDefinition) => void;
  source: SourceParams;
  onUpdateSource: (s: SourceParams) => void;
  load: LoadParams;
  onUpdateLoad: (l: LoadParams) => void;
  control: ControlParams;
  onUpdateControl: (c: ControlParams) => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
  onImportJSON: (jsonStr: string) => void;
}

export function SidebarControls({
  families,
  selectedFamily,
  onSelectFamily,
  topologies,
  selectedTopology,
  onSelectTopology,
  source,
  onUpdateSource,
  load,
  onUpdateLoad,
  control,
  onUpdateControl,
  onExportCSV,
  onExportJSON,
  onImportJSON,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAc = selectedTopology.defaultSource.type.startsWith('AC');
  const isDc = selectedTopology.defaultSource.type === 'DC';

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) onImportJSON(content);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="w-80 flex-shrink-0 flex flex-col gap-3 bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs overflow-y-auto max-h-full">
      {/* 1. Converter Family Selector */}
      <div>
        <div className="flex items-center gap-1.5 text-sky-400 font-bold mb-1.5">
          <Zap size={14} />
          <span>Converter Family</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {families.map((f) => (
            <button
              key={f}
              onClick={() => onSelectFamily(f)}
              className={`py-1.5 px-2 rounded font-semibold border text-center transition ${
                selectedFamily === f
                  ? 'bg-sky-600 border-sky-400 text-white shadow-sm'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Topology Selector */}
      <div>
        <div className="flex items-center gap-1.5 text-slate-300 font-semibold mb-1.5">
          <Sliders size={13} className="text-slate-400" />
          <span>Topology</span>
        </div>
        <select
          value={selectedTopology.id}
          onChange={(e) => {
            const found = topologies.find((t) => t.id === e.target.value);
            if (found) onSelectTopology(found);
          }}
          className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-slate-200 font-medium"
        >
          {topologies
            .filter((t) => t.family === selectedFamily)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
        </select>
      </div>

      {/* 3. Source Parameters */}
      <div className="bg-slate-950 p-2.5 rounded border border-slate-800 flex flex-col gap-2">
        <span className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider">
          Source Parameters
        </span>

        {isAc && (
          <>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">RMS Voltage (V)</span>
              <input
                type="number"
                value={source.vrms || 230}
                onChange={(e) => onUpdateSource({ ...source, vrms: Number(e.target.value) })}
                className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 font-mono text-right text-slate-200"
              />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Frequency (Hz)</span>
              <input
                type="number"
                value={source.freq || 50}
                onChange={(e) => onUpdateSource({ ...source, freq: Number(e.target.value) })}
                className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 font-mono text-right text-slate-200"
              />
            </div>
          </>
        )}

        {isDc && (
          <div className="flex justify-between items-center">
            <span className="text-slate-400">DC Voltage Vin (V)</span>
            <input
              type="number"
              value={source.vdc || 24}
              onChange={(e) => onUpdateSource({ ...source, vdc: Number(e.target.value) })}
              className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 font-mono text-right text-slate-200"
            />
          </div>
        )}
      </div>

      {/* 4. Load Parameters */}
      <div className="bg-slate-950 p-2.5 rounded border border-slate-800 flex flex-col gap-2">
        <span className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider">
          Load Parameters
        </span>

        <div className="flex justify-between items-center">
          <span className="text-slate-400">Resistance R (Ω)</span>
          <input
            type="number"
            step="0.5"
            value={load.R}
            onChange={(e) => onUpdateLoad({ ...load, R: Math.max(0.1, Number(e.target.value)) })}
            className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 font-mono text-right text-slate-200"
          />
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-400">Inductance L (mH)</span>
          <input
            type="number"
            step="1"
            value={Number(((load.L || 0) * 1000).toFixed(1))}
            onChange={(e) => onUpdateLoad({ ...load, L: Math.max(0, Number(e.target.value) / 1000) })}
            className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 font-mono text-right text-slate-200"
          />
        </div>

        {selectedFamily === 'AC-DC' && (
          <>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Back-EMF / Battery E (V)</span>
              <input
                type="number"
                value={load.E || 0}
                onChange={(e) => onUpdateLoad({ ...load, E: Number(e.target.value) })}
                className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 font-mono text-right text-slate-200"
              />
            </div>

            <div className="flex justify-between items-center pt-1 border-t border-slate-800/80">
              <span className="text-slate-400">Freewheeling Diode (FWD)</span>
              <input
                type="checkbox"
                checked={load.fwd}
                onChange={(e) => onUpdateLoad({ ...load, fwd: e.target.checked })}
                className="rounded accent-sky-500 w-4 h-4 cursor-pointer"
              />
            </div>
          </>
        )}

        {selectedFamily === 'DC-DC' && (
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Capacitance C (µF)</span>
            <input
              type="number"
              step="10"
              value={Number(((load.C || 100e-6) * 1e6).toFixed(0))}
              onChange={(e) => onUpdateLoad({ ...load, C: Math.max(1, Number(e.target.value)) * 1e-6 })}
              className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 font-mono text-right text-slate-200"
            />
          </div>
        )}
      </div>

      {/* 5. Control Parameters */}
      <div className="bg-slate-950 p-2.5 rounded border border-slate-800 flex flex-col gap-2">
        <span className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider">
          Control & Modulation
        </span>

        {/* Firing Angle alpha for AC-DC and AC-AC */}
        {(selectedFamily === 'AC-DC' || selectedFamily === 'AC-AC') && control.alpha !== undefined && (
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-slate-400">Firing Angle α</span>
              <span className="font-mono font-bold text-sky-400">{control.alpha}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="175"
              value={control.alpha}
              onChange={(e) => onUpdateControl({ ...control, alpha: Number(e.target.value) })}
              className="w-full accent-sky-500 h-1.5 bg-slate-800 rounded cursor-pointer"
            />
          </div>
        )}

        {/* Duty Cycle D for DC-DC */}
        {selectedFamily === 'DC-DC' && control.duty !== undefined && (
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-slate-400">Duty Ratio D</span>
              <span className="font-mono font-bold text-emerald-400">{(control.duty * 100).toFixed(0)} %</span>
            </div>
            <input
              type="range"
              min="5"
              max="90"
              value={Math.round(control.duty * 100)}
              onChange={(e) => onUpdateControl({ ...control, duty: Number(e.target.value) / 100 })}
              className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded cursor-pointer"
            />
          </div>
        )}

        {/* Transformer Turns Ratio for Isolated Converters */}
        {control.turnsRatio !== undefined && (
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-slate-400">Turns Ratio (Ns / Np)</span>
              <span className="font-mono font-bold text-sky-400">{control.turnsRatio.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="10"
              max="500"
              step="5"
              value={Math.round(control.turnsRatio * 100)}
              onChange={(e) => onUpdateControl({ ...control, turnsRatio: Number(e.target.value) / 100 })}
              className="w-full accent-sky-500 h-1.5 bg-slate-800 rounded cursor-pointer"
            />
          </div>
        )}

        {/* Switching Frequency */}
        {control.fsw !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Switching Freq (kHz)</span>
            <input
              type="number"
              step="1"
              value={Math.round((control.fsw || 20000) / 1000)}
              onChange={(e) => onUpdateControl({ ...control, fsw: Math.max(1, Number(e.target.value)) * 1000 })}
              className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 font-mono text-right text-slate-200"
            />
          </div>
        )}

        {/* Inverter Modulation Scheme */}
        {selectedFamily === 'DC-AC' && (
          <>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Modulation Scheme</span>
              <select
                value={control.modulationType || 'spwm_bipolar'}
                onChange={(e) => onUpdateControl({ ...control, modulationType: e.target.value as any })}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
              >
                <option value="spwm_bipolar">Bipolar SPWM</option>
                <option value="spwm_unipolar">Unipolar SPWM</option>
                <option value="square">Square Wave</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-slate-400">Modulation Index ma</span>
                <span className="font-mono font-bold text-purple-400">{control.ma}</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={Math.round((control.ma || 0.8) * 100)}
                onChange={(e) => onUpdateControl({ ...control, ma: Number(e.target.value) / 100 })}
                className="w-full accent-purple-500 h-1.5 bg-slate-800 rounded cursor-pointer"
              />
            </div>
          </>
        )}

        {/* Cycloconverter Division */}
        {selectedTopology.id === 'acac_1ph_cycloconverter' && (
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Frequency Division</span>
            <select
              value={control.frequencyDivision || 3}
              onChange={(e) => onUpdateControl({ ...control, frequencyDivision: Number(e.target.value) as any })}
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
            >
              <option value="2">fo = fs / 2 (25 Hz)</option>
              <option value="3">fo = fs / 3 (16.7 Hz)</option>
              <option value="4">fo = fs / 4 (12.5 Hz)</option>
            </select>
          </div>
        )}
      </div>

      {/* 6. Export / Import Buttons */}
      <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-800">
        <button
          onClick={onExportCSV}
          className="w-full py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-1.5 font-medium transition"
        >
          <Download size={13} />
          <span>Export Waveforms (CSV)</span>
        </button>

        <div className="flex gap-2">
          <button
            onClick={onExportJSON}
            className="flex-1 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-1.5 font-medium transition"
          >
            <Download size={13} />
            <span>Save JSON</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-1.5 font-medium transition"
          >
            <Upload size={13} />
            <span>Load JSON</span>
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
        </div>
      </div>
    </div>
  );
}
