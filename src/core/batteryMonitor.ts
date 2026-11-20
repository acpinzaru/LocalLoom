import type { SmartDevice } from './types';

export const DEFAULT_LOW_BATTERY_THRESHOLD = 20;
export const CRITICAL_BATTERY_THRESHOLD = 10;

export type BatteryHealthStatus = 'critical' | 'low' | 'normal';

export interface LowBatteryAlert {
  deviceId: string;
  deviceName: string;
  room: string;
  brand: string;
  batteryPct: number;
  batteryVoltageMv?: number;
  severity: 'critical' | 'low';
  message: string;
}

export function clampBatteryPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function getBatteryHealthStatus(
  batteryPct: number,
  lowThreshold: number = DEFAULT_LOW_BATTERY_THRESHOLD
): BatteryHealthStatus {
  const clamped = clampBatteryPct(batteryPct);
  const criticalCutoff = Math.min(CRITICAL_BATTERY_THRESHOLD, lowThreshold);
  if (clamped <= criticalCutoff) return 'critical';
  if (clamped <= lowThreshold) return 'low';
  return 'normal';
}

export function isBatteryPoweredDevice(device: SmartDevice): boolean {
  return typeof device.state.batteryPct === 'number';
}

export function getBatteryPoweredDevices(devices: SmartDevice[]): SmartDevice[] {
  return devices.filter(isBatteryPoweredDevice);
}

export function detectLowBatteryAlerts(
  devices: SmartDevice[],
  lowThreshold: number = DEFAULT_LOW_BATTERY_THRESHOLD
): LowBatteryAlert[] {
  return devices
    .filter((d) => typeof d.state.batteryPct === 'number' && d.state.batteryPct <= lowThreshold)
    .map((d) => {
      const pct = clampBatteryPct(d.state.batteryPct as number);
      const severity: 'critical' | 'low' =
        getBatteryHealthStatus(pct, lowThreshold) === 'critical' ? 'critical' : 'low';
      return {
        deviceId: d.id,
        deviceName: d.name,
        room: d.room,
        brand: d.brand,
        batteryPct: pct,
        batteryVoltageMv: d.state.batteryVoltageMv,
        severity,
        message:
          severity === 'critical'
            ? `${d.name} (${d.room}) battery is critically low at ${pct}%. Replace cell immediately to avoid losing local automation triggers.`
            : `${d.name} (${d.room}) battery is low at ${pct}%. Plan a battery replacement soon.`,
      };
    })
    .sort((a, b) => a.batteryPct - b.batteryPct);
}

export function simulateBatteryChange(currentPct: number, delta: number): number {
  return clampBatteryPct(currentPct + delta);
}
