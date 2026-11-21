import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowDownRight,
  ArrowUpRight,
  PlugZap,
  Power,
  Zap,
} from 'lucide-react';
import {
  buildEnergyDashboardReport,
  clampTariffPerKwh,
  DEFAULT_TARIFF_PER_KWH,
  getEnergyMeteredDevices,
  isDedicatedPowerMeter,
  type EnergyTimeframe,
} from '../core/energyAnalytics';
import { getProtocolLabel } from '../core/protocols';
import type { SmartDeviceState } from '../core/types';
import type { EnrichedHubState } from '../hooks/useHubState';

interface EnergyUsageViewProps {
  hub: EnrichedHubState;
  darkMode: boolean;
  onUpdateDeviceState: (deviceId: string, patch: Partial<SmartDeviceState>) => Promise<void>;
  onOpenPairModal: () => void;
}

const TIMEFRAME_OPTIONS: {
  id: EnergyTimeframe;
  label: string;
  subtitle: string;
  comparisonLabel: string;
}[] = [
  {
    id: 'daily',
    label: 'Daily',
    subtitle: '24-hour local meter profile (00:00 – 23:00)',
    comparisonLabel: 'vs yesterday',
  },
  {
    id: 'weekly',
    label: 'Weekly',
    subtitle: '7-day consumption rollup (Mon – Sun)',
    comparisonLabel: 'vs prior week',
  },
  {
    id: 'monthly',
    label: 'Monthly',
    subtitle: '12-month seasonal load history (Dec – Nov)',
    comparisonLabel: 'vs prior year',
  },
];

interface TooltipPayloadItem {
  payload?: {
    label?: string;
    totalKwh?: number;
    peakWatts?: number;
    estimatedCost?: number;
    name?: string;
    periodKwh?: number;
    sharePct?: number;
    liveWatts?: number;
  };
}

export const EnergyUsageView: React.FC<EnergyUsageViewProps> = ({
  hub,
  darkMode,
  onUpdateDeviceState,
  onOpenPairModal,
}) => {
  const [timeframe, setTimeframe] = useState<EnergyTimeframe>('daily');
  const [metricMode, setMetricMode] = useState<'kwh' | 'watts'>('kwh');
  const [selectedScope, setSelectedScope] = useState<string>('all');
  const [tariffInput, setTariffInput] = useState<string>(DEFAULT_TARIFF_PER_KWH.toFixed(2));
  const [busyDeviceId, setBusyDeviceId] = useState<string | null>(null);

  const meteredDevices = useMemo(
    () => getEnergyMeteredDevices(hub.devices),
    [hub.devices]
  );

  const dedicatedMetersCount = useMemo(
    () => meteredDevices.filter(isDedicatedPowerMeter).length,
    [meteredDevices]
  );

  const tariffPerKwh = useMemo(() => {
    const parsed = Number.parseFloat(tariffInput);
    return Number.isFinite(parsed) && parsed > 0
      ? clampTariffPerKwh(parsed)
      : DEFAULT_TARIFF_PER_KWH;
  }, [tariffInput]);

  // If the previously isolated device was unpaired, fall back cleanly to 'all'
  const effectiveScope = useMemo(() => {
    if (selectedScope === 'all' || selectedScope === 'dedicated') return selectedScope;
    return meteredDevices.some((d) => d.id === selectedScope) ? selectedScope : 'all';
  }, [selectedScope, meteredDevices]);

  const report = useMemo(
    () =>
      buildEnergyDashboardReport(hub.devices, timeframe, {
        scope: effectiveScope,
        tariffPerKwh,
      }),
    [hub.devices, timeframe, effectiveScope, tariffPerKwh]
  );

  const activeTimeframeMeta =
    TIMEFRAME_OPTIONS.find((item) => item.id === timeframe) ?? TIMEFRAME_OPTIONS[0];

  const activeCircuitCount = report.deviceBreakdown.filter((d) => d.powerOn).length;

  const gridStroke = darkMode ? '#1E293B' : '#E2E8F0';
  const axisTickColor = darkMode ? '#94A3B8' : '#64748B';
  const primaryBarColor = darkMode ? '#14B8A6' : '#0F766E';
  const peakBarColor = darkMode ? '#2DD4BF' : '#115E59';

  const handleTogglePower = async (deviceId: string, nextPower: boolean) => {
    setBusyDeviceId(deviceId);
    try {
      await onUpdateDeviceState(deviceId, { power: nextPower });
    } finally {
      setBusyDeviceId(null);
    }
  };

  if (meteredDevices.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-14 text-center dark:border-slate-800 dark:bg-slate-900">
        <PlugZap className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
        <h2 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">
          No Power-Metered Smart Plugs Paired
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
          Pair a Tuya, Smart Life, Shelly, or Xiaomi energy-monitoring plug over your local LAN to track real-time Watts and kWh history privately.
        </p>
        <button
          type="button"
          onClick={onOpenPairModal}
          className="mt-5 min-h-[42px] rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800"
        >
          Scan &amp; Pair Energy Meter
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="energy-usage-view">
      {/* Flat 4-Column KPI Summary Strip */}
      <section
        aria-label="Energy consumption overview"
        className="grid grid-cols-2 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="p-4 sm:p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Live Metered Load
          </p>
          <p
            className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums dark:text-slate-100"
            data-testid="energy-live-watts"
          >
            {report.currentLiveWatts.toFixed(1)} W
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums dark:text-slate-400">
            {activeCircuitCount} of {report.deviceBreakdown.length} metered circuits active
          </p>
        </div>

        <div className="p-4 sm:p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {timeframe === 'daily'
              ? 'Daily Consumption'
              : timeframe === 'weekly'
                ? 'Weekly Consumption'
                : 'Monthly Total (12m)'}
          </p>
          <p
            className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums dark:text-slate-100"
            data-testid="energy-total-kwh"
          >
            {report.totalKwh.toFixed(2)} kWh
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs tabular-nums">
            {report.deltaPct <= 0 ? (
              <ArrowDownRight className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            ) : (
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
            )}
            <span
              className={
                report.deltaPct <= 0
                  ? 'font-medium text-emerald-700 dark:text-emerald-400'
                  : 'font-medium text-amber-700 dark:text-amber-400'
              }
            >
              {report.deltaPct > 0 ? `+${report.deltaPct}%` : `${report.deltaPct}%`}
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              {activeTimeframeMeta.comparisonLabel}
            </span>
          </p>
        </div>

        <div className="p-4 sm:p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Estimated Local Cost
          </p>
          <p
            className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums dark:text-slate-100"
            data-testid="energy-estimated-cost"
          >
            ${report.totalEstimatedCost.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums dark:text-slate-400">
            ${report.tariffPerKwh.toFixed(2)} / kWh · avg {report.averagePerBucketKwh.toFixed(2)} kWh/{report.bucketUnitLabel}
          </p>
        </div>

        <div className="p-4 sm:p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Peak Demand
          </p>
          <p
            className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums dark:text-slate-100"
            data-testid="energy-peak-watts"
          >
            {report.peakWatts.toFixed(1)} W
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums dark:text-slate-400">
            Peak window: <span className="font-mono text-slate-700 dark:text-slate-300">{report.peakLabel}</span>
          </p>
        </div>
      </section>

      {/* Timeframe, Scope & Tariff Control Bar */}
      <section className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Energy trend timeframe"
            className="inline-flex items-center gap-1 rounded-lg bg-slate-200/70 p-1 dark:bg-slate-800/80"
          >
            {TIMEFRAME_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={timeframe === option.id}
                data-testid={`timeframe-${option.id}`}
                onClick={() => setTimeframe(option.id)}
                className={`min-h-[36px] rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  timeframe === option.id
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <label htmlFor="energy-device-scope" className="sr-only">
            Filter energy meters
          </label>
          <select
            id="energy-device-scope"
            value={effectiveScope}
            onChange={(e) => setSelectedScope(e.target.value)}
            className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value="all">All Metered Plugs &amp; Loads ({meteredDevices.length})</option>
            <option value="dedicated">
              Dedicated Plugs &amp; Relays ({dedicatedMetersCount})
            </option>
            {meteredDevices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name} ({device.room})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label
              htmlFor="energy-tariff-input"
              className="text-xs font-medium text-slate-600 whitespace-nowrap dark:text-slate-400"
            >
              Local Tariff ($/kWh)
            </label>
            <input
              id="energy-tariff-input"
              type="number"
              min={0.01}
              max={5}
              step={0.01}
              value={tariffInput}
              onChange={(e) => setTariffInput(e.target.value)}
              className="min-h-[40px] w-24 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs text-slate-900 tabular-nums focus:border-teal-700 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
        </div>
      </section>

      {/* Primary Consumption Trend Chart (Recharts) */}
      <section
        aria-label="Power consumption trend chart"
        className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-teal-700 dark:text-teal-400" aria-hidden="true" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {timeframe === 'daily'
                  ? 'Daily Power Consumption Trend'
                  : timeframe === 'weekly'
                    ? 'Weekly Power Consumption Trend'
                    : 'Monthly Power Consumption Trend'}
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {activeTimeframeMeta.subtitle} · Local LAN metering telemetry only (zero cloud upload)
            </p>
          </div>

          <div
            role="group"
            aria-label="Chart measurement unit"
            className="inline-flex self-start rounded-lg bg-slate-100 p-1 dark:bg-slate-800"
          >
            <button
              type="button"
              onClick={() => setMetricMode('kwh')}
              aria-pressed={metricMode === 'kwh'}
              className={`min-h-[34px] rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                metricMode === 'kwh'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              Energy (kWh)
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('watts')}
              aria-pressed={metricMode === 'watts'}
              className={`min-h-[34px] rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                metricMode === 'watts'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              Peak Load (W)
            </button>
          </div>
        </div>

        <div className="mt-5 h-[300px] w-full" data-testid="energy-trend-chart">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            {timeframe === 'daily' ? (
              <AreaChart
                data={report.series}
                margin={{ top: 10, right: 12, left: 0, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="energyAreaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={primaryBarColor} stopOpacity={0.22} />
                    <stop offset="95%" stopColor={primaryBarColor} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: axisTickColor, fontFamily: 'var(--font-mono)' }}
                  tickLine={false}
                  axisLine={{ stroke: gridStroke }}
                  interval={2}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: axisTickColor, fontFamily: 'var(--font-mono)' }}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tickFormatter={(val: number) =>
                    metricMode === 'kwh' ? `${val.toFixed(2)}` : `${Math.round(val)} W`
                  }
                />
                <Tooltip
                  cursor={{ stroke: primaryBarColor, strokeWidth: 1, strokeDasharray: '4 4' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const item = (payload[0] as TooltipPayloadItem)?.payload;
                    if (!item) return null;
                    return (
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-900">
                        <p className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {item.label}
                        </p>
                        <div className="mt-1.5 space-y-1 font-mono tabular-nums">
                          <p className="text-slate-700 dark:text-slate-300">
                            Energy: <strong className="text-teal-700 dark:text-teal-400">{(item.totalKwh ?? 0).toFixed(3)} kWh</strong>
                          </p>
                          <p className="text-slate-700 dark:text-slate-300">
                            Peak Load: <strong>{(item.peakWatts ?? 0).toFixed(1)} W</strong>
                          </p>
                          <p className="text-slate-500 dark:text-slate-400">
                            Est. Cost: ${(item.estimatedCost ?? 0).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={metricMode === 'kwh' ? 'totalKwh' : 'peakWatts'}
                  stroke={primaryBarColor}
                  strokeWidth={2}
                  fill="url(#energyAreaFill)"
                  activeDot={{ r: 4, fill: primaryBarColor, stroke: darkMode ? '#0F172A' : '#FFFFFF', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            ) : (
              <BarChart
                data={report.series}
                margin={{ top: 10, right: 12, left: 0, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: axisTickColor, fontFamily: 'var(--font-mono)' }}
                  tickLine={false}
                  axisLine={{ stroke: gridStroke }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: axisTickColor, fontFamily: 'var(--font-mono)' }}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tickFormatter={(val: number) =>
                    metricMode === 'kwh' ? `${val.toFixed(1)}` : `${Math.round(val)} W`
                  }
                />
                <Tooltip
                  cursor={{ fill: darkMode ? 'rgba(148,163,184,0.08)' : 'rgba(15,23,42,0.04)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const item = (payload[0] as TooltipPayloadItem)?.payload;
                    if (!item) return null;
                    return (
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-900">
                        <p className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {item.label}
                        </p>
                        <div className="mt-1.5 space-y-1 font-mono tabular-nums">
                          <p className="text-slate-700 dark:text-slate-300">
                            Energy: <strong className="text-teal-700 dark:text-teal-400">{(item.totalKwh ?? 0).toFixed(2)} kWh</strong>
                          </p>
                          <p className="text-slate-700 dark:text-slate-300">
                            Peak Load: <strong>{(item.peakWatts ?? 0).toFixed(1)} W</strong>
                          </p>
                          <p className="text-slate-500 dark:text-slate-400">
                            Est. Cost: ${(item.estimatedCost ?? 0).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey={metricMode === 'kwh' ? 'totalKwh' : 'peakWatts'}
                  radius={[5, 5, 0, 0]}
                  maxBarSize={42}
                  isAnimationActive={false}
                >
                  {report.series.map((entry) => {
                    const activePeak =
                      metricMode === 'kwh' ? report.peakKwhLabel : report.peakLabel;
                    return (
                      <Cell
                        key={entry.label}
                        fill={entry.label === activePeak ? peakBarColor : primaryBarColor}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </section>

      {/* Secondary Split: Meter Breakdown Bar Chart + Interactive Metered Circuits Table */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Per-Meter Horizontal Recharts Comparison */}
        <section
          aria-label="Consumption breakdown by smart plug and meter"
          className="rounded-xl border border-slate-200 bg-white p-5 xl:col-span-5 dark:border-slate-800 dark:bg-slate-900"
        >
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Consumption by Meter
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Ranked {timeframe} energy draw (kWh) per local endpoint
          </p>

          <div className="mt-4 h-[260px] w-full" data-testid="energy-breakdown-chart">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart
                data={report.deviceBreakdown}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridStroke} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: axisTickColor, fontFamily: 'var(--font-mono)' }}
                  tickLine={false}
                  axisLine={{ stroke: gridStroke }}
                  tickFormatter={(val: number) => `${val} kWh`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={150}
                  interval={0}
                  tick={{ fontSize: 11, fill: axisTickColor }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(label: string) =>
                    label.length > 18 ? `${label.slice(0, 17).trimEnd()}…` : label
                  }
                />
                <Tooltip
                  cursor={{ fill: darkMode ? 'rgba(148,163,184,0.08)' : 'rgba(15,23,42,0.04)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const item = (payload[0] as TooltipPayloadItem)?.payload;
                    if (!item) return null;
                    return (
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-900">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {item.name}
                        </p>
                        <p className="mt-1 font-mono text-slate-700 tabular-nums dark:text-slate-300">
                          {(item.periodKwh ?? 0).toFixed(2)} kWh ({item.sharePct ?? 0}%) · Live {(item.liveWatts ?? 0).toFixed(1)} W
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="periodKwh"
                  radius={[0, 5, 5, 0]}
                  barSize={20}
                  isAnimationActive={false}
                >
                  {report.deviceBreakdown.map((entry) => (
                    <Cell key={entry.deviceId} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Interactive Smart Plugs & Metered Circuits Table */}
        <section
          aria-label="Metered smart plugs and hardware circuits"
          className="rounded-xl border border-slate-200 bg-white p-5 xl:col-span-7 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Smart Plugs &amp; Metered Circuits
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Direct local relay control with live wattage and period cost
              </p>
            </div>
            {effectiveScope !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedScope('all')}
                className="min-h-[34px] rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Show All Meters
              </button>
            )}
          </div>

          <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {report.deviceBreakdown.map((item) => (
              <li
                key={item.deviceId}
                data-testid={`energy-device-row-${item.deviceId}`}
                className="flex flex-col gap-3 py-3.5 first:pt-1 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                      aria-hidden="true"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedScope(
                          effectiveScope === item.deviceId ? 'all' : item.deviceId
                        )
                      }
                      className="truncate text-left text-sm font-semibold text-slate-900 hover:text-teal-700 dark:text-slate-100 dark:hover:text-teal-400"
                    >
                      {item.name}
                    </button>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                    <span>{item.brand}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.room}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-[11px]">{getProtocolLabel(item.protocol)}</span>
                    <span aria-hidden="true">·</span>
                    <span className={item.powerOn ? 'font-medium text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}>
                      {item.powerOn ? 'Active' : 'Relay Cut'}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
                  <div className="text-left font-mono tabular-nums sm:text-right">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {item.periodKwh.toFixed(2)} kWh{' '}
                      <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                        ({item.sharePct}%)
                      </span>
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Live {item.liveWatts.toFixed(1)} W · ${item.estimatedCost.toFixed(2)}
                    </p>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={item.powerOn}
                    aria-label={`Toggle power relay for ${item.name}`}
                    disabled={busyDeviceId === item.deviceId}
                    onClick={() => void handleTogglePower(item.deviceId, !item.powerOn)}
                    className={`inline-flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                      item.powerOn
                        ? 'border-teal-700 bg-teal-700 text-white hover:bg-teal-800'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Power className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};
