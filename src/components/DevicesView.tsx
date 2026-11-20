import React, { useEffect, useMemo, useState } from 'react';
import { BatteryWarning, Search, X } from 'lucide-react';
import { DeviceCard } from './DeviceCard';
import {
  DEFAULT_LOW_BATTERY_THRESHOLD,
  detectLowBatteryAlerts,
  getBatteryPoweredDevices,
  isBatteryPoweredDevice,
} from '../core/batteryMonitor';
import type { EnrichedHubState } from '../hooks/useHubState';
import type { SmartDeviceState } from '../core/types';

interface DevicesViewProps {
  hub: EnrichedHubState;
  onUpdateDeviceState: (deviceId: string, patch: Partial<SmartDeviceState>) => Promise<void>;
  onRemoveDevice: (deviceId: string, deviceName: string) => Promise<void>;
  onOpenPairModal: () => void;
  onRefresh?: () => Promise<void>;
}

export const DevicesView: React.FC<DevicesViewProps> = ({
  hub,
  onUpdateDeviceState,
  onRemoveDevice,
  onOpenPairModal,
  onRefresh,
}) => {
  const [selectedRoom, setSelectedRoom] = useState<string>('All');
  const [selectedBrand, setSelectedBrand] = useState<string>('All');
  const [powerFilter, setPowerFilter] = useState<'all' | 'battery' | 'low'>('all');
  const [lowBatteryThreshold, setLowBatteryThreshold] = useState<number>(
    DEFAULT_LOW_BATTERY_THRESHOLD
  );
  const [dismissedAlerts, setDismissedAlerts] = useState<Record<string, number>>({});
  const [query, setQuery] = useState('');

  // Keep real-time sensor telemetry synchronized with the local hub bridge
  useEffect(() => {
    if (!onRefresh) return;
    const intervalId = window.setInterval(() => {
      void onRefresh();
    }, 15000);
    return () => window.clearInterval(intervalId);
  }, [onRefresh]);

  const batteryDevices = useMemo(
    () => getBatteryPoweredDevices(hub.devices),
    [hub.devices]
  );

  const allLowBatteryAlerts = useMemo(
    () => detectLowBatteryAlerts(hub.devices, lowBatteryThreshold),
    [hub.devices, lowBatteryThreshold]
  );

  // Clear stale dismissal entries once a battery is replaced above threshold
  useEffect(() => {
    setDismissedAlerts((prev) => {
      let changed = false;
      const next: Record<string, number> = { ...prev };
      for (const deviceId of Object.keys(next)) {
        const device = hub.devices.find((d) => d.id === deviceId);
        const pct = device?.state.batteryPct;
        if (pct === undefined || pct > lowBatteryThreshold) {
          delete next[deviceId];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [hub.devices, lowBatteryThreshold]);

  // Show alert unless dismissed at the same or higher battery level (re-triggers if it drops further)
  const activeLowBatteryAlerts = useMemo(
    () =>
      allLowBatteryAlerts.filter((alert) => {
        const dismissedAt = dismissedAlerts[alert.deviceId];
        if (dismissedAt === undefined) return true;
        return alert.batteryPct < dismissedAt;
      }),
    [allLowBatteryAlerts, dismissedAlerts]
  );

  const hasCriticalBatteryAlert = activeLowBatteryAlerts.some(
    (alert) => alert.severity === 'critical'
  );

  const rooms = useMemo(() => {
    const unique = Array.from(new Set(hub.devices.map((d) => d.room)));
    return ['All', ...unique];
  }, [hub.devices]);

  const brands = useMemo(() => {
    const unique = Array.from(new Set(hub.devices.map((d) => d.brand)));
    return ['All', ...unique];
  }, [hub.devices]);

  const filteredDevices = useMemo(() => {
    const q = query.trim().toLowerCase();
    return hub.devices.filter((d) => {
      if (selectedRoom !== 'All' && d.room !== selectedRoom) return false;
      if (selectedBrand !== 'All' && d.brand !== selectedBrand) return false;
      if (powerFilter === 'battery' && !isBatteryPoweredDevice(d)) return false;
      if (
        powerFilter === 'low' &&
        (!isBatteryPoweredDevice(d) || (d.state.batteryPct as number) > lowBatteryThreshold)
      ) {
        return false;
      }
      if (q) {
        return (
          d.name.toLowerCase().includes(q) ||
          d.brand.toLowerCase().includes(q) ||
          d.room.toLowerCase().includes(q) ||
          d.ip.includes(q) ||
          d.replacesApp.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [hub.devices, selectedRoom, selectedBrand, powerFilter, lowBatteryThreshold, query]);

  const totalWatts = useMemo(
    () =>
      hub.devices.reduce(
        (sum, d) => sum + (d.state.power && d.state.powerWatts ? d.state.powerWatts : 0),
        0
      ),
    [hub.devices]
  );

  const activeDevicesCount = hub.devices.filter((d) => d.state.power).length;
  const cloudBlockedCount = hub.devices.filter((d) => d.cloudBlocked).length;

  return (
    <div className="space-y-6">
      {/* Summary Strip — flat single-elevation hairline metrics */}
      <section
        aria-label="Local hub overview"
        className="grid grid-cols-2 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="p-4 sm:p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Local Devices</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums dark:text-slate-100" data-testid="device-total-count">
            {hub.devices.length}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums dark:text-slate-400">
            {activeDevicesCount} powered on · {batteryDevices.length} battery sensors
          </p>
        </div>

        <div className="p-4 sm:p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Live Local Load</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums dark:text-slate-100">
            {totalWatts.toFixed(1)} W
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Metered directly on {hub.network.subnetCidr}
          </p>
        </div>

        <div className="p-4 sm:p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Cloud Isolation</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums dark:text-slate-100">
            {cloudBlockedCount}/{hub.devices.length}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {hub.security.cloudEgressKillSwitch
              ? `${hub.network.blockedCloudDomains.length} vendor domains sinkholed`
              : 'Kill-switch paused'}
          </p>
        </div>

        <div className="p-4 sm:p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Security Controls</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums dark:text-slate-100">
            {hub.complianceSummary.compliant}/{hub.complianceSummary.total}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            NIS2 · NIST · GDPR · EN 303 645
          </p>
        </div>
      </section>

      {/* Low-Battery Notifications Panel */}
      {activeLowBatteryAlerts.length > 0 && (
        <section
          role="alert"
          aria-live="assertive"
          data-testid="low-battery-notifications"
          className={`rounded-xl border p-4 sm:p-5 ${
            hasCriticalBatteryAlert
              ? 'border-rose-200 bg-rose-50/75 dark:border-rose-900/60 dark:bg-rose-950/30'
              : 'border-amber-200 bg-amber-50/75 dark:border-amber-900/60 dark:bg-amber-950/30'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BatteryWarning
                className={`h-4 w-4 shrink-0 ${
                  hasCriticalBatteryAlert
                    ? 'text-rose-700 dark:text-rose-400'
                    : 'text-amber-700 dark:text-amber-400'
                }`}
                aria-hidden="true"
              />
              <h2
                className={`text-sm font-semibold ${
                  hasCriticalBatteryAlert
                    ? 'text-rose-950 dark:text-rose-100'
                    : 'text-amber-950 dark:text-amber-100'
                }`}
              >
                {activeLowBatteryAlerts.length === 1
                  ? 'Low-Battery Sensor Notification'
                  : `Low-Battery Sensor Notifications (${activeLowBatteryAlerts.length})`}
              </h2>
            </div>
            <span className="font-mono text-xs text-slate-600 tabular-nums dark:text-slate-300">
              Alert threshold ≤ {lowBatteryThreshold}%
            </span>
          </div>

          <ul className="mt-3 divide-y divide-amber-200/70 dark:divide-amber-900/40">
            {activeLowBatteryAlerts.map((alert) => (
              <li
                key={alert.deviceId}
                data-testid={`low-battery-alert-${alert.deviceId}`}
                className="flex flex-col gap-3 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                    <span
                      className={`font-semibold ${
                        alert.severity === 'critical'
                          ? 'text-rose-800 dark:text-rose-300'
                          : 'text-amber-900 dark:text-amber-300'
                      }`}
                    >
                      {alert.severity === 'critical' ? 'Critical Battery' : 'Low Battery'}
                    </span>
                    <span aria-hidden="true" className="text-slate-400">·</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {alert.deviceName}
                    </span>
                    <span aria-hidden="true" className="text-slate-400">·</span>
                    <span className="text-slate-600 dark:text-slate-300">{alert.room}</span>
                    <span aria-hidden="true" className="text-slate-400">·</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                      {alert.batteryPct}%
                      {alert.batteryVoltageMv !== undefined
                        ? ` (${(alert.batteryVoltageMv / 1000).toFixed(2)} V)`
                        : ''}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-700 dark:text-slate-300">
                    {alert.message}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void onUpdateDeviceState(alert.deviceId, { batteryPct: 100 })}
                    className="min-h-[36px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 transition-colors hover:bg-slate-50 whitespace-nowrap dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    Mark Replaced
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRoom('All');
                      setSelectedBrand('All');
                      setPowerFilter('all');
                      setQuery(alert.deviceName);
                    }}
                    className="min-h-[36px] rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-black/5 whitespace-nowrap dark:text-slate-300 dark:hover:bg-white/10"
                  >
                    Focus Sensor
                  </button>
                  <button
                    type="button"
                    aria-label={`Dismiss low battery notification for ${alert.deviceName}`}
                    onClick={() =>
                      setDismissedAlerts((prev) => ({
                        ...prev,
                        [alert.deviceId]: alert.batteryPct,
                      }))
                    }
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-black/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-100"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Filter & Search Toolbar */}
      <section className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Filter devices by room"
            className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-200/70 p-1 dark:bg-slate-800/80"
          >
            {rooms.map((room) => (
              <button
                key={room}
                type="button"
                role="tab"
                aria-selected={selectedRoom === room}
                onClick={() => setSelectedRoom(room)}
                className={`min-h-[36px] rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  selectedRoom === room
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {room}
              </button>
            ))}
          </div>

          <label className="sr-only" htmlFor="brand-filter">
            Filter by brand
          </label>
          <select
            id="brand-filter"
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            {brands.map((brand) => (
              <option key={brand} value={brand}>
                {brand === 'All' ? 'All Brands' : brand}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="power-source-filter">
            Filter by battery status
          </label>
          <select
            id="power-source-filter"
            value={powerFilter}
            onChange={(e) => setPowerFilter(e.target.value as 'all' | 'battery' | 'low')}
            className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value="all">All Power Sources</option>
            <option value="battery">Battery Sensors ({batteryDevices.length})</option>
            <option value="low">Low Battery ({allLowBatteryAlerts.length})</option>
          </select>

          <label className="sr-only" htmlFor="battery-threshold-select">
            Low battery alert threshold
          </label>
          <select
            id="battery-threshold-select"
            value={lowBatteryThreshold}
            onChange={(e) => setLowBatteryThreshold(Number(e.target.value))}
            className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value={15}>Alert ≤ 15%</option>
            <option value={20}>Alert ≤ 20%</option>
            <option value={25}>Alert ≤ 25%</option>
            <option value={30}>Alert ≤ 30%</option>
          </select>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-64 sm:flex-none">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <label htmlFor="device-search" className="sr-only">
              Search local devices
            </label>
            <input
              id="device-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search device, IP, or brand…"
              className="min-h-[40px] w-full rounded-lg border border-slate-200 bg-white py-2 pr-3 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
        </div>
      </section>

      {/* Device Grid */}
      {filteredDevices.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            No matching local hardware found
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Clear your room, battery, or search filter, or pair a new Tuya, Smart Life, Xiaomi, or Matter endpoint.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSelectedRoom('All');
                setSelectedBrand('All');
                setPowerFilter('all');
                setQuery('');
              }}
              className="min-h-[40px] rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Reset Filters
            </button>
            <button
              type="button"
              onClick={onOpenPairModal}
              className="min-h-[40px] rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800"
            >
              Pair Device
            </button>
          </div>
        </div>
      ) : (
        <section
          aria-label="Connected local smart home devices"
          className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {filteredDevices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              lowBatteryThreshold={lowBatteryThreshold}
              onUpdateState={onUpdateDeviceState}
              onRemove={onRemoveDevice}
            />
          ))}
        </section>
      )}
    </div>
  );
};
