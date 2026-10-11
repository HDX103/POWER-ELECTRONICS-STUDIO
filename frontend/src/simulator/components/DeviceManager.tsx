import { DEVICE_PRESETS } from '../engine/deviceModels';
import { DeviceSlot, SwitchModel, SwitchType } from '../types';

interface Props {
  deviceSlots: DeviceSlot[];
  devices: Record<string, SwitchModel>;
  onUpdateDevice: (slotId: string, model: SwitchModel) => void;
  selectedSlot: string | null;
  onSelectSlot: (slotId: string) => void;
}

export function DeviceManager({
  deviceSlots,
  devices,
  onUpdateDevice,
  selectedSlot,
  onSelectSlot,
}: Props) {
  const activeSlotId = selectedSlot || deviceSlots[0]?.id;
  const currentModel = devices[activeSlotId];

  const handleTypeChange = (newType: SwitchType) => {
    const defaultPreset = DEVICE_PRESETS[newType]?.[0] || {
      id: `${newType.toLowerCase()}_custom`,
      name: `Custom ${newType}`,
      type: newType,
      vf: newType === 'Diode' ? 0.8 : newType === 'Thyristor' ? 1.4 : 0,
      ron: 0.02,
      roff: 1e6,
    };
    onUpdateDevice(activeSlotId, { ...defaultPreset });
  };

  const handlePresetSelect = (preset: SwitchModel) => {
    onUpdateDevice(activeSlotId, { ...preset });
  };

  return (
    <div className="w-full flex flex-col gap-4 bg-slate-900 border border-slate-800 rounded-lg p-4 text-xs">
      <div>
        <h3 className="text-sm font-bold text-sky-400">Electronic Switch Semiconductor Manager</h3>
        <p className="text-[11px] text-slate-400">
          Configure switch semiconductor technologies (Diode, Thyristor, MOSFET, IGBT, TRIAC, Ideal) & physical parameters
        </p>
      </div>

      {/* Device Slot Selector Tabs */}
      <div className="flex gap-2 flex-wrap border-b border-slate-800 pb-2">
        {deviceSlots.map((slot) => {
          const dev = devices[slot.id];
          const isActive = activeSlotId === slot.id;
          return (
            <button
              key={slot.id}
              onClick={() => onSelectSlot(slot.id)}
              className={`px-3 py-1.5 rounded text-xs font-mono font-medium border flex items-center gap-2 transition ${
                isActive
                  ? 'bg-sky-600 border-sky-400 text-white shadow'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <span>{slot.label}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 font-bold text-sky-200">
                {dev?.type || slot.defaultType}
              </span>
            </button>
          );
        })}
      </div>

      {currentModel && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Switch Type and Presets */}
          <div className="flex flex-col gap-3 bg-slate-950 p-3 rounded border border-slate-800">
            <div>
              <label className="text-[11px] text-slate-400 font-semibold uppercase block mb-1.5">
                Switch Semiconductor Type
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {(['Diode', 'Thyristor', 'MOSFET', 'IGBT', 'TRIAC', 'IdealSwitch'] as SwitchType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => handleTypeChange(t)}
                    className={`px-2.5 py-1 rounded text-xs font-medium border ${
                      currentModel.type === t
                        ? 'bg-emerald-600 border-emerald-400 text-white font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 font-semibold uppercase block mb-1.5">
                Standard Industry Presets
              </label>
              <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                {DEVICE_PRESETS[currentModel.type]?.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handlePresetSelect(p)}
                    className={`text-left p-2 rounded border text-xs flex justify-between items-center ${
                      currentModel.id === p.id
                        ? 'bg-sky-950/60 border-sky-500 text-sky-200'
                        : 'bg-slate-900 border-slate-800/80 text-slate-300 hover:bg-slate-850'
                    }`}
                  >
                    <span className="font-semibold">{p.name}</span>
                    <span className="font-mono text-[10px] text-slate-400">
                      Ron: {p.ron * 1000}mΩ | Vf: {p.vf}V
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Physical Parameter Editors */}
          <div className="flex flex-col gap-2.5 bg-slate-950 p-3 rounded border border-slate-800">
            <h4 className="font-semibold text-slate-200 text-xs border-b border-slate-800 pb-1">
              Physical Electrical Parameters
            </h4>

            <div className="flex justify-between items-center">
              <span className="text-slate-400">Device Name / Part Number</span>
              <input
                type="text"
                value={currentModel.name}
                onChange={(e) => onUpdateDevice(activeSlotId, { ...currentModel, name: e.target.value })}
                className="w-44 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs"
              />
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400">Forward Voltage Drop Vf (V)</span>
              <input
                type="number"
                step="0.05"
                value={currentModel.vf}
                onChange={(e) => onUpdateDevice(activeSlotId, { ...currentModel, vf: Number(e.target.value) })}
                className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs"
              />
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400">On-State Resistance Ron (Ω)</span>
              <input
                type="number"
                step="0.005"
                value={currentModel.ron}
                onChange={(e) => onUpdateDevice(activeSlotId, { ...currentModel, ron: Number(e.target.value) })}
                className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs"
              />
            </div>

            {currentModel.type === 'Thyristor' && (
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Holding Current Ih (A)</span>
                <input
                  type="number"
                  step="0.01"
                  value={currentModel.holdingCurrent || 0.03}
                  onChange={(e) => onUpdateDevice(activeSlotId, { ...currentModel, holdingCurrent: Number(e.target.value) })}
                  className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs"
                />
              </div>
            )}

            {currentModel.type === 'IGBT' && (
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Vce Saturation (V)</span>
                <input
                  type="number"
                  step="0.1"
                  value={currentModel.vceSat || 1.7}
                  onChange={(e) => onUpdateDevice(activeSlotId, { ...currentModel, vceSat: Number(e.target.value) })}
                  className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs"
                />
              </div>
            )}

            {currentModel.type === 'MOSFET' && (
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Antiparallel Body Diode</span>
                <input
                  type="checkbox"
                  checked={currentModel.bodyDiode ?? true}
                  onChange={(e) => onUpdateDevice(activeSlotId, { ...currentModel, bodyDiode: e.target.checked })}
                  className="rounded accent-sky-500"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
