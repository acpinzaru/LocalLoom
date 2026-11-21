import type { DeviceBrand, DeviceCategory, DeviceProtocol, SmartDevice } from './types';

export type EnergyTimeframe = 'daily' | 'weekly' | 'monthly';

export const DEFAULT_TARIFF_PER_KWH = 0.24;

export interface EnergyTrendPoint {
  label: string;
  totalKwh: number;
  peakWatts: number;
  estimatedCost: number;
  byDevice: Record<string, number>;
}

export interface MeteredDeviceSummary {
  deviceId: string;
  name: string;
  brand: DeviceBrand;
  room: string;
  category: DeviceCategory;
  protocol: DeviceProtocol;
  isDedicatedMeter: boolean;
  powerOn: boolean;
  liveWatts: number;
  periodKwh: number;
  estimatedCost: number;
  sharePct: number;
  peakWatts: number;
  color: string;
}

export interface EnergyDashboardReport {
  timeframe: EnergyTimeframe;
  tariffPerKwh: number;
  totalKwh: number;
  previousPeriodKwh: number;
  deltaPct: number;
  totalEstimatedCost: number;
  currentLiveWatts: number;
  peakWatts: number;
  peakLabel: string;
  peakKwhLabel: string;
  averagePerBucketKwh: number;
  bucketUnitLabel: string;
  series: EnergyTrendPoint[];
  deviceBreakdown: MeteredDeviceSummary[];
}

const DEVICE_SERIES_COLORS = [
  '#0F766E', // Teal 700
  '#2563EB', // Blue 600
  '#D97706', // Amber 600
  '#4F46E5', // Indigo 600
  '#059669', // Emerald 600
  '#64748B', // Slate 500
];

// 24-hour normalized load curves by category (00:00 -> 23:00)
const HOURLY_PROFILE_BY_CATEGORY: Record<DeviceCategory, number[]> = {
  power: [
    0.22, 0.2, 0.19, 0.19, 0.2, 0.24, 0.36, 0.55, 0.82, 1.05, 1.12, 1.15,
    1.04, 1.14, 1.18, 1.16, 1.08, 0.96, 0.78, 0.68, 0.58, 0.45, 0.34, 0.26,
  ],
  climate: [
    0.62, 0.6, 0.58, 0.58, 0.6, 0.65, 0.76, 0.88, 0.94, 0.96, 0.98, 1.02,
    1.08, 1.12, 1.15, 1.1, 1.04, 1.0, 0.95, 0.9, 0.82, 0.74, 0.68, 0.64,
  ],
  lighting: [
    0.08, 0.05, 0.05, 0.05, 0.05, 0.12, 0.42, 0.72, 0.55, 0.28, 0.22, 0.2,
    0.22, 0.24, 0.28, 0.38, 0.62, 0.94, 1.18, 1.24, 1.15, 0.95, 0.58, 0.22,
  ],
  sensor: [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  ],
  security: [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  ],
};

// 7-day normalized multipliers (Mon -> Sun)
const WEEKLY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKLY_MULTIPLIERS: Record<DeviceCategory, number[]> = {
  power: [1.06, 1.12, 1.08, 1.15, 1.02, 0.76, 0.72],
  climate: [0.96, 1.0, 1.04, 1.02, 0.98, 1.08, 1.05],
  lighting: [0.92, 0.95, 0.94, 0.98, 1.04, 1.16, 1.12],
  sensor: [1, 1, 1, 1, 1, 1, 1],
  security: [1, 1, 1, 1, 1, 1, 1],
};

// 12-month normalized seasonal multipliers (Dec -> Nov)
const MONTHLY_LABELS = [
  'Dec',
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
];
const MONTHLY_DAYS = [31, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30];
const MONTHLY_MULTIPLIERS: Record<DeviceCategory, number[]> = {
  power: [1.05, 1.08, 1.04, 1.0, 0.96, 0.94, 0.92, 0.95, 1.01, 1.04, 1.06, 1.09],
  climate: [1.14, 1.18, 1.1, 0.98, 0.88, 0.94, 1.12, 1.16, 0.96, 0.92, 1.02, 1.08],
  lighting: [1.28, 1.24, 1.12, 0.98, 0.84, 0.76, 0.78, 0.85, 0.96, 1.08, 1.18, 1.22],
  sensor: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  security: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
};

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function deterministicDeviceOffset(deviceId: string, index: number): number {
  let hash = 0;
  for (let i = 0; i < deviceId.length; i += 1) {
    hash = (hash * 31 + deviceId.charCodeAt(i)) % 997;
  }
  const wave = Math.sin((hash + index * 17) * 0.43);
  return 1 + wave * 0.08;
}

export function clampTariffPerKwh(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TARIFF_PER_KWH;
  return roundTo(Math.max(0.01, Math.min(5, value)), 2);
}

export function isEnergyMeteredDevice(device: SmartDevice): boolean {
  return device.category === 'power' || typeof device.state.powerWatts === 'number';
}

export function isDedicatedPowerMeter(device: SmartDevice): boolean {
  return device.category === 'power' || device.protocol === 'shelly-rpc';
}

export function getEnergyMeteredDevices(devices: SmartDevice[]): SmartDevice[] {
  return devices.filter(isEnergyMeteredDevice);
}

/**
 * Nominal rated draw (W) used to derive deterministic historical energy curves
 * even if a device is momentarily switched off right now.
 */
function getBaselineWatts(device: SmartDevice): number {
  const reported = device.state.powerWatts ?? 0;
  if (reported > 1) return reported;
  if (device.category === 'power') return 45;
  if (device.category === 'climate') return 18;
  if (device.category === 'lighting') return 12;
  return Math.max(reported, 2);
}

export function buildEnergyDashboardReport(
  devices: SmartDevice[],
  timeframe: EnergyTimeframe,
  options?: {
    scope?: 'all' | 'dedicated' | string; // 'all', 'dedicated', or specific deviceId
    tariffPerKwh?: number;
  }
): EnergyDashboardReport {
  const tariffPerKwh = clampTariffPerKwh(options?.tariffPerKwh ?? DEFAULT_TARIFF_PER_KWH);
  const scope = options?.scope ?? 'all';

  const allMetered = getEnergyMeteredDevices(devices);
  const scopedDevices = allMetered.filter((device) => {
    if (scope === 'all') return true;
    if (scope === 'dedicated') return isDedicatedPowerMeter(device);
    return device.id === scope;
  });

  // Assign deterministic palette by baseline wattage rank so the primary plug gets Teal
  const rankedByBaseline = [...allMetered].sort(
    (a, b) => getBaselineWatts(b) - getBaselineWatts(a)
  );
  const colorMap = new Map<string, string>();
  rankedByBaseline.forEach((device, idx) => {
    colorMap.set(device.id, DEVICE_SERIES_COLORS[idx % DEVICE_SERIES_COLORS.length]);
  });

  const currentLiveWatts = roundTo(
    scopedDevices.reduce(
      (sum, d) => sum + (d.state.power && d.state.powerWatts ? d.state.powerWatts : 0),
      0
    ),
    1
  );

  // Build bucket labels and per-device kWh/W series
  const bucketLabels =
    timeframe === 'daily'
      ? Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')}:00`)
      : timeframe === 'weekly'
        ? WEEKLY_LABELS
        : MONTHLY_LABELS;

  const devicePeriodKwh = new Map<string, number>();
  const devicePeakWatts = new Map<string, number>();

  const series: EnergyTrendPoint[] = bucketLabels.map((label, bucketIdx) => {
    let bucketTotalKwh = 0;
    let bucketPeakWatts = 0;
    const byDevice: Record<string, number> = {};

    for (const device of scopedDevices) {
      const baseWatts = getBaselineWatts(device);
      const jitter = deterministicDeviceOffset(device.id, bucketIdx);
      const liveFactor =
        timeframe === 'daily' && bucketIdx === 16
          ? device.state.power
            ? 1
            : 0.05
          : device.state.power
            ? 1
            : 0.72;

      let kwh = 0;
      let peakW = 0;

      if (timeframe === 'daily') {
        const hourFactor = HOURLY_PROFILE_BY_CATEGORY[device.category][bucketIdx] ?? 0.6;
        const avgWatts = baseWatts * hourFactor * jitter * liveFactor;
        kwh = avgWatts / 1000;
        peakW = avgWatts * 1.18;
      } else if (timeframe === 'weekly') {
        const dayFactor = WEEKLY_MULTIPLIERS[device.category][bucketIdx] ?? 1;
        const dailyHourSum = HOURLY_PROFILE_BY_CATEGORY[device.category].reduce(
          (acc, v) => acc + v,
          0
        );
        kwh = ((baseWatts * dailyHourSum) / 1000) * dayFactor * jitter * liveFactor;
        peakW = baseWatts * 1.22 * dayFactor * jitter * liveFactor;
      } else {
        const monthFactor = MONTHLY_MULTIPLIERS[device.category][bucketIdx] ?? 1;
        const daysInMonth = MONTHLY_DAYS[bucketIdx] ?? 30;
        const dailyHourSum = HOURLY_PROFILE_BY_CATEGORY[device.category].reduce(
          (acc, v) => acc + v,
          0
        );
        kwh = ((baseWatts * dailyHourSum * daysInMonth) / 1000) * monthFactor * jitter * liveFactor;
        peakW = baseWatts * 1.26 * monthFactor * jitter * liveFactor;
      }

      const roundedKwh = roundTo(kwh, 3);
      byDevice[device.id] = roundedKwh;
      bucketTotalKwh += roundedKwh;
      bucketPeakWatts += peakW;

      devicePeriodKwh.set(device.id, (devicePeriodKwh.get(device.id) ?? 0) + roundedKwh);
      devicePeakWatts.set(
        device.id,
        Math.max(devicePeakWatts.get(device.id) ?? 0, roundTo(peakW, 1))
      );
    }

    const totalKwh = roundTo(bucketTotalKwh, 3);
    const peakWatts = roundTo(bucketPeakWatts, 1);

    return {
      label,
      totalKwh,
      peakWatts,
      estimatedCost: roundTo(totalKwh * tariffPerKwh, 2),
      byDevice,
    };
  });

  const totalKwh = roundTo(
    series.reduce((sum, pt) => sum + pt.totalKwh, 0),
    2
  );

  // Deterministic previous-period comparison ratio (-4.6% daily, +2.4% weekly, -3.1% monthly)
  const prevMultiplier =
    timeframe === 'daily' ? 1.048 : timeframe === 'weekly' ? 0.976 : 1.032;
  const previousPeriodKwh = roundTo(totalKwh * prevMultiplier, 2);
  const deltaPct =
    previousPeriodKwh > 0
      ? roundTo(((totalKwh - previousPeriodKwh) / previousPeriodKwh) * 100, 1)
      : 0;

  let peakWatts = 0;
  let peakLabel = bucketLabels[0] ?? '—';
  let peakKwh = -1;
  let peakKwhLabel = bucketLabels[0] ?? '—';
  for (const pt of series) {
    if (pt.peakWatts >= peakWatts) {
      peakWatts = pt.peakWatts;
      peakLabel = pt.label;
    }
    if (pt.totalKwh >= peakKwh) {
      peakKwh = pt.totalKwh;
      peakKwhLabel = pt.label;
    }
  }

  const deviceBreakdown: MeteredDeviceSummary[] = scopedDevices
    .map((device) => {
      const periodKwh = roundTo(devicePeriodKwh.get(device.id) ?? 0, 2);
      const liveWatts =
        device.state.power && device.state.powerWatts ? roundTo(device.state.powerWatts, 1) : 0;
      const sharePct = totalKwh > 0 ? roundTo((periodKwh / totalKwh) * 100, 1) : 0;
      return {
        deviceId: device.id,
        name: device.name,
        brand: device.brand,
        room: device.room,
        category: device.category,
        protocol: device.protocol,
        isDedicatedMeter: isDedicatedPowerMeter(device),
        powerOn: device.state.power,
        liveWatts,
        periodKwh,
        estimatedCost: roundTo(periodKwh * tariffPerKwh, 2),
        sharePct,
        peakWatts: roundTo(devicePeakWatts.get(device.id) ?? liveWatts, 1),
        color: colorMap.get(device.id) ?? DEVICE_SERIES_COLORS[0],
      };
    })
    .sort((a, b) => b.periodKwh - a.periodKwh);

  return {
    timeframe,
    tariffPerKwh,
    totalKwh,
    previousPeriodKwh,
    deltaPct,
    totalEstimatedCost: roundTo(totalKwh * tariffPerKwh, 2),
    currentLiveWatts,
    peakWatts: roundTo(peakWatts, 1),
    peakLabel,
    peakKwhLabel,
    averagePerBucketKwh:
      series.length > 0 ? roundTo(totalKwh / series.length, 2) : 0,
    bucketUnitLabel:
      timeframe === 'daily' ? 'hr' : timeframe === 'weekly' ? 'day' : 'mo',
    series,
    deviceBreakdown,
  };
}
