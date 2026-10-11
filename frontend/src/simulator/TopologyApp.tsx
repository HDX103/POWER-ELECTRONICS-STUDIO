import { useState, useMemo, useEffect } from 'react';
import { Activity, Cpu, BarChart2, BookOpen, LineChart } from 'lucide-react';
import { DEFAULT_DEVICE_MODELS } from './engine/deviceModels';
import { runSimulation } from './engine/solvers';
import { DeviceManager } from './components/DeviceManager';
import { HarmonicsView } from './components/HarmonicsView';
import { MetricsBar } from './components/MetricsBar';
import { Oscilloscope } from './components/Oscilloscope';
import { SchematicView } from './components/SchematicView';
import { SidebarControls } from './components/SidebarControls';
import { SweepView } from './components/SweepView';
import { TheoryView } from './components/TheoryView';
import { TOPOLOGY_DEFINITIONS } from './topologies';
import { ControlParams, ConverterFamily, LoadParams, SourceParams, SwitchModel, TopologyDefinition } from './types';

type ActiveTab = 'scope' | 'schematic' | 'harmonics' | 'theory' | 'devices' | 'sweep';

export function TopologyApp() {
  const families: ConverterFamily[] = ['AC-DC', 'DC-DC', 'DC-AC', 'AC-AC'];
  const [selectedFamily, setSelectedFamily] = useState<ConverterFamily>('AC-DC');

  const [selectedTopology, setSelectedTopology] = useState<TopologyDefinition>(TOPOLOGY_DEFINITIONS[0]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('scope');

  // Parameters state
  const [source, setSource] = useState<SourceParams>({ ...selectedTopology.defaultSource });
  const [load, setLoad] = useState<LoadParams>({ ...selectedTopology.defaultLoad });
  const [control, setControl] = useState<ControlParams>({ ...selectedTopology.defaultControl });

  // Electronic switches configuration per slot
  const [devices, setDevices] = useState<Record<string, SwitchModel>>(() => {
    const initDevs: Record<string, SwitchModel> = {};
    selectedTopology.deviceSlots.forEach((slot) => {
      initDevs[slot.id] = { ...DEFAULT_DEVICE_MODELS[slot.defaultType] };
    });
    return initDevs;
  });

  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  // Time-domain Animation Cursor state
  const [cursorIdx, setCursorIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1);

  // When family or topology changes, update defaults
  const handleSelectFamily = (family: ConverterFamily) => {
    setSelectedFamily(family);
    const firstTop = TOPOLOGY_DEFINITIONS.find((t) => t.family === family) || TOPOLOGY_DEFINITIONS[0];
    handleSelectTopology(firstTop);
  };

  const handleSelectTopology = (top: TopologyDefinition) => {
    setSelectedTopology(top);
    setSource({ ...top.defaultSource });
    setLoad({ ...top.defaultLoad });
    setControl({ ...top.defaultControl });

    const newDevs: Record<string, SwitchModel> = {};
    top.deviceSlots.forEach((slot) => {
      newDevs[slot.id] = { ...DEFAULT_DEVICE_MODELS[slot.defaultType] };
    });
    setDevices(newDevs);
    setSelectedSlot(top.deviceSlots[0]?.id || null);
    setCursorIdx(0);
    setIsPlaying(false);
  };

  const handleUpdateDevice = (slotId: string, model: SwitchModel) => {
    setDevices((prev) => ({ ...prev, [slotId]: model }));
  };

  // Run pure client-side simulation on parameter change
  const simResult = useMemo(() => {
    return runSimulation(selectedTopology.id, source, load, control, devices);
  }, [selectedTopology.id, source, load, control, devices]);

  // Keep cursor in range
  useEffect(() => {
    if (cursorIdx >= simResult.time.length) {
      setCursorIdx(0);
    }
  }, [simResult.time.length, cursorIdx]);

  // Export functions
  const handleExportCSV = () => {
    const { time, signals, timeUnit } = simResult;
    const sigKeys = Object.keys(signals).filter((k) => (signals as any)[k] !== undefined);
    const header = `time_${timeUnit},` + sigKeys.join(',');
    const rows = time.map((t, i) => {
      const vals = sigKeys.map((k) => (signals as any)[k][i] ?? 0);
      return `${t},${vals.join(',')}`;
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [header, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${selectedTopology.id}_simulation.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    const data = {
      version: '2.0.0',
      topology: selectedTopology.id,
      source,
      load,
      control,
      devices,
    };
    const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', jsonStr);
    link.setAttribute('download', `${selectedTopology.id}_config.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportJSON = (jsonStr: string) => {
    try {
      const data = JSON.parse(jsonStr);
      const top = TOPOLOGY_DEFINITIONS.find((t) => t.id === data.topology);
      if (top) {
        setSelectedFamily(top.family);
        setSelectedTopology(top);
        if (data.source) setSource(data.source);
        if (data.load) setLoad(data.load);
        if (data.control) setControl(data.control);
        if (data.devices) setDevices(data.devices);
      }
    } catch (err) {
      alert('Invalid circuit configuration JSON file.');
    }
  };

  const tabs: Array<{ id: ActiveTab; label: string; icon: any }> = [
    { id: 'scope', label: 'Oscilloscope & Circuit', icon: Activity },
    { id: 'devices', label: 'Semiconductor Switches', icon: Cpu },
    { id: 'harmonics', label: 'Harmonic FFT', icon: BarChart2 },
    { id: 'theory', label: 'Theory & Derivations', icon: BookOpen },
    { id: 'sweep', label: 'Parameter Sweep', icon: LineChart },
  ];

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-200 overflow-hidden select-none">
      {/* Top Measurements Dashboard */}
      <div className="p-2 border-b border-slate-800 bg-slate-950/90 flex-shrink-0">
        <MetricsBar metrics={simResult.metrics} />
      </div>

      {/* Main Workspace Body */}
      <div className="flex-1 flex min-h-0 p-2 gap-2 overflow-hidden">
        {/* Left Sidebar Controls */}
        <SidebarControls
          families={families}
          selectedFamily={selectedFamily}
          onSelectFamily={handleSelectFamily}
          topologies={TOPOLOGY_DEFINITIONS}
          selectedTopology={selectedTopology}
          onSelectTopology={handleSelectTopology}
          source={source}
          onUpdateSource={setSource}
          load={load}
          onUpdateLoad={setLoad}
          control={control}
          onUpdateControl={setControl}
          onExportCSV={handleExportCSV}
          onExportJSON={handleExportJSON}
          onImportJSON={handleImportJSON}
        />

        {/* Center/Right Main Tab Workspace */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-900/60 rounded-lg border border-slate-800 p-2 overflow-hidden">
          {/* Navigation Bar Tabs */}
          <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2 mb-2 flex-shrink-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition ${
                    isActive
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'bg-slate-950/80 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                  }`}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content Display */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {activeTab === 'scope' && (
              <div className="h-full flex flex-col gap-2">
                {/* Upper: Oscilloscope */}
                <Oscilloscope
                  result={simResult}
                  cursorIdx={cursorIdx}
                  setCursorIdx={setCursorIdx}
                  isPlaying={isPlaying}
                  setIsPlaying={setIsPlaying}
                  speed={speed}
                  setSpeed={setSpeed}
                />

                {/* Lower: Animated SVG Schematic */}
                <div className="flex-1 min-h-[220px]">
                  <SchematicView
                    topology={selectedTopology}
                    cursorIdx={cursorIdx}
                    deviceStates={simResult.deviceStates}
                    activePaths={simResult.activePaths}
                    devices={devices}
                    onSelectDevice={(slotId) => {
                      setSelectedSlot(slotId);
                      setActiveTab('devices');
                    }}
                    selectedSlot={selectedSlot}
                  />
                </div>
              </div>
            )}

            {activeTab === 'devices' && (
              <DeviceManager
                deviceSlots={selectedTopology.deviceSlots}
                devices={devices}
                onUpdateDevice={handleUpdateDevice}
                selectedSlot={selectedSlot}
                onSelectSlot={setSelectedSlot}
              />
            )}

            {activeTab === 'harmonics' && (
              <HarmonicsView
                fft={simResult.fft}
                thdV={simResult.metrics.thd_v}
                thdI={simResult.metrics.thd_i}
              />
            )}

            {activeTab === 'theory' && (
              <TheoryView
                theory={simResult.theory}
                metrics={simResult.metrics}
                topologyName={selectedTopology.name}
              />
            )}

            {activeTab === 'sweep' && (
              <SweepView
                topology={selectedTopology}
                source={source}
                load={load}
                control={control}
                devices={devices}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
