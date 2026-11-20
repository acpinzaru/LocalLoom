import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { DeviceCard } from './DeviceCard';
import type { EnrichedHubState } from '../hooks/useHubState';
import type { SmartDeviceState } from '../core/types';

interface DevicesViewProps {
  hub: EnrichedHubState;
  onUpdateDeviceState: (deviceId: string, patch: Partial<SmartDeviceState>) => Promise<void>;
  onRemoveDevice: (deviceId: string, deviceName: string) => Promise<void>;
  onOpenPairModal: () => void;
}

export const DevicesView: React.FC<DevicesViewProps> = ({
  hub,
  onUpdateDeviceState,
  onRemoveDevice,
  onOpenPairModal,
}) => {
  const [selectedRoom, setSelectedRoom] = useState<string>('All');
  const [selectedBrand, setSelectedBrand] = useState<string>('All');
  const [query, setQuery] = useState('');

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
  }, [hub.devices, selectedRoom, selectedBrand, query]);

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
  const replacedAppsCount = new Set(hub.devices.map((d) => d.replacesApp)).size;

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
            {activeDevicesCount} powered on · {replacedAppsCount} vendor apps replaced
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
            Clear your room or search filter, or pair a new Tuya, Smart Life, Xiaomi, or Matter endpoint.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSelectedRoom('All');
                setSelectedBrand('All');
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
              onUpdateState={onUpdateDeviceState}
              onRemove={onRemoveDevice}
            />
          ))}
        </section>
      )}
    </div>
  );
};
