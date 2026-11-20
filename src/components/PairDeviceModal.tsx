import React, { useState } from 'react';
import { Radar, X } from 'lucide-react';
import { getProtocolLabel, validateDevicePairingInput } from '../core/protocols';
import type {
  DeviceBrand,
  DeviceCategory,
  DevicePairingInput,
  DeviceProtocol,
  DiscoveredLanDevice,
} from '../core/types';

interface PairDeviceModalProps {
  open: boolean;
  onClose: () => void;
  onScanLan: () => Promise<DiscoveredLanDevice[]>;
  onPair: (
    input: DevicePairingInput
  ) => Promise<{ ok: true } | { ok: false; errors?: Record<string, string>; error?: string }>;
}

const INITIAL_FORM: DevicePairingInput = {
  name: '',
  brand: 'Tuya',
  protocol: 'tuya-lan-v34',
  category: 'lighting',
  room: 'Living Room',
  ip: '',
  mac: '',
  localCredential: '',
  transport: 'direct-lan',
};

export const PairDeviceModal: React.FC<PairDeviceModalProps> = ({
  open,
  onClose,
  onScanLan,
  onPair,
}) => {
  const [form, setForm] = useState<DevicePairingInput>(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveredLanDevice[]>([]);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleScan = async () => {
    setScanning(true);
    try {
      const results = await onScanLan();
      setDiscovered(results);
    } finally {
      setScanning(false);
    }
  };

  const applyDiscovered = (item: DiscoveredLanDevice) => {
    setForm({
      name: item.suggestedName,
      brand: item.brand,
      protocol: item.protocol,
      category: item.category,
      room: 'Living Room',
      ip: item.ip,
      mac: item.mac,
      localCredential: item.sampleCredential,
      transport: 'direct-lan',
    });
    setErrors({});
    setSubmitError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const localValidation = validateDevicePairingInput(form);
    if (!localValidation.valid) {
      setErrors(localValidation.errors as Record<string, string>);
      setSubmitError('Please fix the highlighted local device fields before pairing.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await onPair(form);
      if (!res.ok) {
        setErrors(res.errors ?? {});
        setSubmitError(res.error ?? 'Check highlighted fields.');
        return;
      }
      setForm(INITIAL_FORM);
      setErrors({});
      setDiscovered([]);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pair-device-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-xs sm:items-center sm:p-4"
    >
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:rounded-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 sm:hidden dark:bg-slate-700" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="pair-device-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Pair Local Smart Home Device
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Bind hardware directly over LAN, WireGuard VPN, or local proxy with zero cloud login.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close pairing dialog"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Discovery sweep */}
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Local Subnet Broadcast Discovery
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Probes UDP 6666/6667 (Tuya), UDP 54321 (Xiaomi miIO), and mDNS.
              </p>
            </div>
            <button
              type="button"
              onClick={handleScan}
              disabled={scanning}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 whitespace-nowrap dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <Radar className="h-3.5 w-3.5" aria-hidden="true" />
              {scanning ? 'Scanning Subnet…' : 'Scan Local LAN'}
            </button>
          </div>

          {discovered.length > 0 && (
            <ul className="mt-3 divide-y divide-slate-200 border-t border-slate-200 pt-2 dark:divide-slate-800 dark:border-slate-800">
              {discovered.map((item) => (
                <li key={item.tempId} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {item.suggestedName}
                    </p>
                    <p className="font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
                      {item.brand} · {getProtocolLabel(item.protocol)} · {item.ip}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => applyDiscovered(item)}
                    className="min-h-[36px] shrink-0 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800 whitespace-nowrap"
                  >
                    Use Endpoint
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Manual / pre-filled pairing form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="pair-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Device Name
              </label>
              <input
                id="pair-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Office Smart Plug"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              {errors.name && <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">{errors.name}</p>}
            </div>

            <div>
              <label htmlFor="pair-room" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Room / Zone
              </label>
              <input
                id="pair-room"
                type="text"
                value={form.room}
                onChange={(e) => setForm({ ...form, room: e.target.value })}
                placeholder="Living Room"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              {errors.room && <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">{errors.room}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="pair-brand" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Brand
              </label>
              <select
                id="pair-brand"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value as DeviceBrand })}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="Tuya">Tuya</option>
                <option value="Smart Life">Smart Life</option>
                <option value="Xiaomi">Xiaomi</option>
                <option value="Aqara">Aqara</option>
                <option value="Shelly">Shelly</option>
                <option value="Matter">Matter</option>
              </select>
            </div>

            <div>
              <label htmlFor="pair-protocol" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Local Protocol
              </label>
              <select
                id="pair-protocol"
                value={form.protocol}
                onChange={(e) => setForm({ ...form, protocol: e.target.value as DeviceProtocol })}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="tuya-lan-v34">Tuya LAN v3.4 (TCP 6668)</option>
                <option value="tuya-lan-v33">Tuya LAN v3.3 (TCP 6668)</option>
                <option value="xiaomi-miio">Xiaomi miIO (UDP 54321)</option>
                <option value="shelly-rpc">Shelly Gen2 RPC (HTTP 80)</option>
                <option value="matter-local">Matter Local (UDP 5540)</option>
                <option value="esphome-api">ESPHome Noise (TCP 6053)</option>
              </select>
            </div>

            <div>
              <label htmlFor="pair-category" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Category
              </label>
              <select
                id="pair-category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as DeviceCategory })}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="lighting">Lighting</option>
                <option value="climate">Climate & Air</option>
                <option value="power">Power & Metering</option>
                <option value="sensor">Sensor</option>
                <option value="security">Security</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="pair-ip" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Local IPv4 Address
              </label>
              <input
                id="pair-ip"
                type="text"
                value={form.ip}
                onChange={(e) => setForm({ ...form, ip: e.target.value })}
                placeholder="192.168.10.95"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-teal-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              {errors.ip && <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">{errors.ip}</p>}
            </div>

            <div>
              <label htmlFor="pair-mac" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Hardware MAC Address
              </label>
              <input
                id="pair-mac"
                type="text"
                value={form.mac}
                onChange={(e) => setForm({ ...form, mac: e.target.value })}
                placeholder="A4:C1:38:99:12:4E"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-teal-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              {errors.mac && <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">{errors.mac}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="pair-cred" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {form.protocol === 'xiaomi-miio'
                  ? 'Xiaomi miIO Token (32 hex chars)'
                  : form.protocol.startsWith('tuya')
                    ? 'Tuya LocalKey (16 ASCII chars)'
                    : 'Local Pairing Secret / PSK'}
              </label>
              <input
                id="pair-cred"
                type="text"
                value={form.localCredential}
                onChange={(e) => setForm({ ...form, localCredential: e.target.value })}
                placeholder={
                  form.protocol === 'xiaomi-miio'
                    ? '4f8a21c90e7b63d12a5c8f901b3e7d44'
                    : 'tY9kP2mN7qR4vX8z'
                }
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-teal-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              {errors.localCredential && (
                <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">{errors.localCredential}</p>
              )}
            </div>

            <div>
              <label htmlFor="pair-transport" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Transport Route
              </label>
              <select
                id="pair-transport"
                value={form.transport}
                onChange={(e) =>
                  setForm({
                    ...form,
                    transport: e.target.value as DevicePairingInput['transport'],
                  })
                }
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="direct-lan">Direct Local VLAN</option>
                <option value="wireguard-vpn">WireGuard VPN Tunnel</option>
                <option value="socks5-proxy">SOCKS5 Local Proxy</option>
              </select>
            </div>
          </div>

          {submitError && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
              {submitError}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[44px] rounded-lg bg-teal-700 px-5 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
            >
              {submitting ? 'Sealing Key…' : 'Pair & Seal Locally'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
