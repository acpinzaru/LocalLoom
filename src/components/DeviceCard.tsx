import React, { useState } from 'react';
import {
  Activity,
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  BatteryWarning,
  Lock,
  Minus,
  PlugZap,
  Plus,
  Power,
  ShieldCheck,
  Sun,
  Thermometer,
  Trash2,
  Unlock,
  Wind,
} from 'lucide-react';
import {
  DEFAULT_LOW_BATTERY_THRESHOLD,
  getBatteryHealthStatus,
  simulateBatteryChange,
} from '../core/batteryMonitor';
import { getProtocolLabel } from '../core/protocols';
import type { SmartDevice, SmartDeviceState } from '../core/types';

interface DeviceCardProps {
  device: SmartDevice;
  lowBatteryThreshold?: number;
  onUpdateState: (deviceId: string, patch: Partial<SmartDeviceState>) => Promise<void>;
  onRemove: (deviceId: string, deviceName: string) => Promise<void>;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({
  device,
  lowBatteryThreshold = DEFAULT_LOW_BATTERY_THRESHOLD,
  onUpdateState,
  onRemove,
}) => {
  const [busy, setBusy] = useState(false);
  const [confirmUnpair, setConfirmUnpair] = useState(false);

  const runPatch = async (patch: Partial<SmartDeviceState>) => {
    setBusy(true);
    try {
      await onUpdateState(device.id, patch);
    } finally {
      setBusy(false);
    }
  };

  const renderCategoryIcon = () => {
    const cls = 'h-4 w-4 text-slate-600 dark:text-slate-300';
    switch (device.category) {
      case 'lighting':
        return <Sun className={cls} aria-hidden="true" />;
      case 'climate':
        return device.state.aqi !== undefined ? (
          <Wind className={cls} aria-hidden="true" />
        ) : (
          <Thermometer className={cls} aria-hidden="true" />
        );
      case 'power':
        return <PlugZap className={cls} aria-hidden="true" />;
      case 'sensor':
        return <Activity className={cls} aria-hidden="true" />;
      case 'security':
        return device.state.locked ? (
          <Lock className={cls} aria-hidden="true" />
        ) : (
          <Unlock className={cls} aria-hidden="true" />
        );
    }
  };

  const renderBatteryIcon = (pct: number, status: 'critical' | 'low' | 'normal') => {
    if (status === 'critical') {
      return <BatteryWarning className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />;
    }
    if (status === 'low') {
      return <BatteryLow className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />;
    }
    if (pct <= 65) {
      return <BatteryMedium className="h-4 w-4 shrink-0 text-teal-700 dark:text-teal-400" aria-hidden="true" />;
    }
    return <BatteryFull className="h-4 w-4 shrink-0 text-teal-700 dark:text-teal-400" aria-hidden="true" />;
  };

  const isActive = device.state.power;
  const hasBattery = typeof device.state.batteryPct === 'number';
  const batteryPct = hasBattery ? (device.state.batteryPct as number) : null;
  const batteryStatus =
    batteryPct !== null ? getBatteryHealthStatus(batteryPct, lowBatteryThreshold) : null;

  return (
    <article
      className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 transition-colors dark:border-slate-800 dark:bg-slate-900"
      data-testid={`device-card-${device.id}`}
    >
      <div>
        {/* Header Row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              {renderCategoryIcon()}
              <span className="truncate">{device.brand}</span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{device.room}</span>
              <span aria-hidden="true">·</span>
              <span className={device.online ? 'font-medium text-emerald-700 dark:text-emerald-400' : 'font-medium text-rose-700 dark:text-rose-400'}>
                {device.online ? 'Local Online' : 'Offline'}
              </span>
            </div>
            <h3 className="mt-1.5 text-base font-semibold leading-snug text-slate-900 dark:text-slate-100">
              {device.name}
            </h3>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            aria-label={`Toggle power for ${device.name}`}
            disabled={busy}
            onClick={() => runPatch({ power: !isActive })}
            className={`inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
              isActive
                ? 'border-teal-700 bg-teal-700 text-white hover:bg-teal-800'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            <Power className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Technical protocol & local endpoint metadata (unboxed zero-pill style) */}
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
          <span>{getProtocolLabel(device.protocol)}</span>
          <span aria-hidden="true">/</span>
          <span>
            {device.ip}:{device.port}
          </span>
          <span aria-hidden="true">/</span>
          <span>{device.latencyMs} ms</span>
        </div>

        <div className="my-4 border-t border-slate-100 dark:border-slate-800" />

        {/* Category-specific interactive hardware controls */}
        <div className="space-y-3.5">
          {device.category === 'lighting' && device.state.brightness !== undefined && (
            <div>
              <div className="flex items-center justify-between text-xs">
                <label
                  htmlFor={`brightness-${device.id}`}
                  className="font-medium text-slate-700 dark:text-slate-300"
                >
                  Brightness
                </label>
                <span className="font-mono font-medium text-slate-900 tabular-nums dark:text-slate-100">
                  {device.state.brightness}%
                </span>
              </div>
              <input
                id={`brightness-${device.id}`}
                type="range"
                min={0}
                max={100}
                step={5}
                value={device.state.brightness}
                onChange={(e) => runPatch({ brightness: Number(e.target.value) })}
                className="mt-2 h-2 w-full cursor-pointer accent-teal-700"
              />
            </div>
          )}

          {device.category === 'lighting' && device.state.colorTempK !== undefined && (
            <div>
              <div className="flex items-center justify-between text-xs">
                <label
                  htmlFor={`colortemp-${device.id}`}
                  className="font-medium text-slate-700 dark:text-slate-300"
                >
                  Color Temperature
                </label>
                <span className="font-mono font-medium text-slate-900 tabular-nums dark:text-slate-100">
                  {device.state.colorTempK} K
                </span>
              </div>
              <input
                id={`colortemp-${device.id}`}
                type="range"
                min={2700}
                max={6500}
                step={100}
                value={device.state.colorTempK}
                onChange={(e) => runPatch({ colorTempK: Number(e.target.value) })}
                className="mt-2 h-2 w-full cursor-pointer accent-teal-700"
              />
            </div>
          )}

          {device.category === 'climate' && device.state.targetTempC !== undefined && (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ambient {device.state.currentTempC?.toFixed(1)}°C · {device.state.humidityPct}% RH
                </p>
                <p className="mt-0.5 font-mono text-lg font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                  Target {device.state.targetTempC.toFixed(1)}°C
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label={`Decrease target temperature for ${device.name}`}
                  onClick={() =>
                    runPatch({
                      targetTempC: Math.max(16, Number(((device.state.targetTempC ?? 21) - 0.5).toFixed(1))),
                    })
                  }
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Increase target temperature for ${device.name}`}
                  onClick={() =>
                    runPatch({
                      targetTempC: Math.min(30, Number(((device.state.targetTempC ?? 21) + 0.5).toFixed(1))),
                    })
                  }
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {device.category === 'climate' && device.state.fanSpeed !== undefined && (
            <div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>
                  AQI <strong className="font-mono text-slate-900 tabular-nums dark:text-slate-100">{device.state.aqi ?? '—'}</strong> ·{' '}
                  {device.state.humidityPct ?? '—'}% RH
                </span>
                <span className="font-mono tabular-nums">{device.state.powerWatts?.toFixed(1) ?? '0.0'} W</span>
              </div>
              <div className="mt-2.5 grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                {(['auto', 'silent', 'medium', 'high'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => runPatch({ power: true, fanSpeed: mode })}
                    className={`min-h-[36px] rounded-md px-2 text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                      device.state.fanSpeed === mode
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          )}

          {device.category === 'power' && (
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Live Local Load</p>
                <p className="mt-0.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                  {(device.state.powerWatts ?? 0).toFixed(1)} W
                </p>
              </div>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {isActive ? 'Relay Closed' : 'Relay Cut'}
              </span>
            </div>
          )}

          {device.category === 'sensor' && (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {device.state.currentTempC !== undefined ? (
                    <span className="font-mono tabular-nums">
                      {device.state.currentTempC.toFixed(1)}°C
                      {device.state.humidityPct !== undefined ? ` · ${device.state.humidityPct}% RH` : ''}
                      {device.state.lux !== undefined ? ` · ${device.state.lux} lx` : ''}
                    </span>
                  ) : (
                    <>
                      Ambient Illuminance <span className="font-mono tabular-nums">{device.state.lux ?? 0} lx</span>
                    </>
                  )}
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                  {device.state.motionDetected ? 'Motion Detected' : 'Area Clear'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => runPatch({ motionDetected: !device.state.motionDetected })}
                className="min-h-[40px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                {device.state.motionDetected ? 'Clear Motion' : 'Test Motion Trigger'}
              </button>
            </div>
          )}

          {device.category === 'security' && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Deadbolt & Shutter</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {device.state.locked ? 'Locked Locally' : 'Unlocked'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => runPatch({ locked: !device.state.locked })}
                  className={`min-h-[40px] rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                    device.state.locked
                      ? 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
                      : 'bg-teal-700 text-white hover:bg-teal-800'
                  }`}
                >
                  {device.state.locked ? 'Unlock' : 'Lock Now'}
                </button>
              </div>
            </div>
          )}

          {/* Real-time Battery Percentage Indicator for Supported Battery-Powered IoT Sensors & Locks */}
          {batteryPct !== null && batteryStatus !== null && (
            <div
              className={`rounded-lg border p-3 ${
                batteryStatus === 'critical'
                  ? 'border-rose-200 bg-rose-50/70 dark:border-rose-900/60 dark:bg-rose-950/30'
                  : batteryStatus === 'low'
                    ? 'border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/30'
                    : 'border-slate-200/80 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/40'
              }`}
              data-testid={`battery-indicator-${device.id}`}
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex min-w-0 items-center gap-1.5">
                  {renderBatteryIcon(batteryPct, batteryStatus)}
                  <span
                    className={`font-medium ${
                      batteryStatus === 'critical'
                        ? 'text-rose-800 dark:text-rose-300'
                        : batteryStatus === 'low'
                          ? 'text-amber-900 dark:text-amber-300'
                          : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {batteryStatus === 'critical'
                      ? 'Critical Battery'
                      : batteryStatus === 'low'
                        ? 'Low Battery'
                        : 'Battery Healthy'}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 font-mono tabular-nums">
                  <span
                    className={`font-semibold ${
                      batteryStatus === 'critical'
                        ? 'text-rose-800 dark:text-rose-300'
                        : batteryStatus === 'low'
                          ? 'text-amber-900 dark:text-amber-300'
                          : 'text-slate-900 dark:text-slate-100'
                    }`}
                    data-testid={`battery-pct-${device.id}`}
                  >
                    {batteryPct}%
                  </span>
                  {device.state.batteryVoltageMv !== undefined && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      · {(device.state.batteryVoltageMv / 1000).toFixed(2)} V
                    </span>
                  )}
                </div>
              </div>

              <div
                role="progressbar"
                aria-label={`Battery level for ${device.name}`}
                aria-valuenow={batteryPct}
                aria-valuemin={0}
                aria-valuemax={100}
                className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/90 dark:bg-slate-700/80"
              >
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    batteryStatus === 'critical'
                      ? 'bg-rose-600 dark:bg-rose-500'
                      : batteryStatus === 'low'
                        ? 'bg-amber-600 dark:bg-amber-500'
                        : 'bg-teal-700 dark:bg-teal-500'
                  }`}
                  style={{ width: `${batteryPct}%` }}
                />
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px]">
                <button
                  type="button"
                  disabled={busy || batteryPct <= 0}
                  onClick={() => runPatch({ batteryPct: simulateBatteryChange(batteryPct, -15) })}
                  aria-label={`Simulate 15% battery drain for ${device.name}`}
                  className="rounded px-2 py-1 font-medium text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-slate-900 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-700/70 dark:hover:text-slate-100"
                >
                  Drain -15%
                </button>
                {batteryPct < 100 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => runPatch({ batteryPct: 100 })}
                    aria-label={`Mark battery replaced for ${device.name}`}
                    className="rounded px-2 py-1 font-medium text-teal-800 transition-colors hover:bg-teal-100/80 dark:text-teal-300 dark:hover:bg-teal-950/60"
                  >
                    Replace (100%)
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer metadata & unpair confirmation */}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <div className="flex min-w-0 items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-teal-700 dark:text-teal-400" aria-hidden="true" />
          <span className="truncate">
            Replaces {device.replacesApp} · {device.cloudBlocked ? 'Cloud Blocked' : 'Cloud Unfiltered'}
          </span>
        </div>

        {confirmUnpair ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => onRemove(device.id, device.name)}
              className="rounded px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setConfirmUnpair(false)}
              className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            aria-label={`Unpair ${device.name}`}
            onClick={() => setConfirmUnpair(true)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-rose-700 dark:hover:bg-slate-800 dark:hover:text-rose-400"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </article>
  );
};
