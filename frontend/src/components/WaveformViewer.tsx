import { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import type { SimResult } from '../api';

interface Props { data: SimResult | null; cursor: number; setCursor: (t: number) => void }

export function WaveformViewer({ data, cursor, setCursor }: Props) {
  const [off, setOff] = useState<Record<string, boolean>>({});
  const on = (k: string) => !off[k];
  const option = useMemo(() => {
    if (!data) return null;
    const groups = [...new Set(data.channels.map((c) => c.g))].sort().filter((g) => data.channels.some((c) => c.g === g && on(c.key)));
    const logic = (g: number) => data.channels.filter((c) => c.g === g).every((c) => c.step);
    const h = 78 / Math.max(groups.length, 1);
    const first = (g: number) => data.channels.find((c) => c.g === g && on(c.key))?.key;
    const series: any[] = [];
    data.channels.forEach((c) => {
      const gi = groups.indexOf(c.g);
      if (gi < 0 || !on(c.key)) return;
      series.push({
        name: c.label, type: 'line', xAxisIndex: gi, yAxisIndex: gi, showSymbol: false, sampling: 'lttb', animation: false,
        step: c.step ? 'end' : undefined, lineStyle: { width: 1.6, color: c.c }, itemStyle: { color: c.c },
        data: data.time.map((t, i) => [t, data.signals[c.key][i]]),
        ...(c.key === first(c.g) && gi === 0 ? { markLine: { silent: true, symbol: 'none', animation: false, lineStyle: { color: '#e2e8f0', type: 'dashed' }, label: { show: false }, data: [{ xAxis: cursor }] } } : {}),
      });
    });
    return {
      backgroundColor: 'transparent', animation: false,
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' }, backgroundColor: '#0f172a', borderColor: '#334155', textStyle: { color: '#e2e8f0', fontSize: 11 }, valueFormatter: (v: number) => v.toFixed(3) },
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      grid: groups.map((_, gi) => ({ top: `${4 + gi * h}%`, height: `${h - 7}%`, left: 62, right: 20 })),
      xAxis: groups.map((_, gi) => ({ type: 'value', gridIndex: gi, min: 0, max: data.time[data.time.length - 1], name: gi === groups.length - 1 ? data.time_unit : '', nameTextStyle: { color: '#94a3b8' }, axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: '#1e293b' } } })),
      yAxis: groups.map((g, gi) => ({ type: 'value', gridIndex: gi, name: data.group_titles[g], nameTextStyle: { color: '#94a3b8', align: 'left' }, scale: !logic(g), axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: '#1e293b' } }, ...(logic(g) ? { min: -0.1, max: 1.2 } : {}) })),
      dataZoom: [{ type: 'inside', xAxisIndex: groups.map((_, i) => i) }, { type: 'slider', xAxisIndex: groups.map((_, i) => i), height: 14, bottom: 4, borderColor: '#334155', textStyle: { color: '#94a3b8' } }],
      series,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, off, cursor]);

  if (!data || !option) return <div className="h-full flex items-center justify-center text-slate-500">Run the simulation to see waveforms</div>;
  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-wrap gap-3 px-3 py-1.5 border-b border-slate-800 text-xs">
        {data.channels.map((c) => (
          <label key={c.key} className="flex items-center gap-1 cursor-pointer" style={{ color: c.c }}>
            <input type="checkbox" checked={on(c.key)} onChange={(e) => setOff({ ...off, [c.key]: !e.target.checked })} />{c.label}</label>))}
        <span className="ml-auto text-slate-500">scroll = zoom · slider = pan · hover = cursor</span>
      </div>
      <ReactECharts className="flex-1 min-h-0" style={{ height: '100%' }} notMerge option={option}
        onEvents={{ updateAxisPointer: (e: any) => { const x = e?.axesInfo?.[0]?.value; if (typeof x === 'number') setCursor(x); } }} />
    </div>
  );
}
