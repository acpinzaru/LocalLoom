import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTuyaLanFrame,
  parseTuyaLanFrame,
  buildXiaomiMiioFrame,
  parseXiaomiMiioFrame,
  validateDevicePairingInput,
} from './protocols';
import {
  evaluateAutomationTrigger,
  executeAutomationRule,
  validateAutomationDraft,
} from './automationEngine';
import {
  evaluateComplianceControls,
  summarizeCompliance,
  validateNetworkConfig,
} from './securityCompliance';
import {
  detectLowBatteryAlerts,
  getBatteryHealthStatus,
  simulateBatteryChange,
} from './batteryMonitor';
import { createInitialHubState } from './seedData';

test('Tuya LAN v3.4 frame encodes and decodes with intact CRC32 checksum', () => {
  const payload = JSON.stringify({ devId: 'bf1234', dps: { '1': true, '2': 650 } });
  const built = buildTuyaLanFrame({
    sequence: 42,
    command: 0x07,
    payloadJson: payload,
    version: '3.4',
  });

  assert.equal(built.hex.startsWith('000055aa'), true);
  assert.equal(built.hex.endsWith('0000aa55'), true);

  const parsed = parseTuyaLanFrame(built.hex);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.crcValid, true);
  assert.equal(parsed.sequence, 42);
  assert.equal(parsed.command, 0x07);
  assert.match(parsed.payloadPreview ?? '', /bf1234/);
});

test('Tuya LAN frame parser rejects corrupted CRC bytes', () => {
  const built = buildTuyaLanFrame({
    sequence: 7,
    command: 0x0a,
    payloadJson: '{"dps":{"1":false}}',
    version: '3.3',
  });
  // Flip one hex character inside the checksum area
  const tampered =
    built.hex.slice(0, built.hex.length - 12) +
    (built.hex[built.hex.length - 12] === '0' ? '1' : '0') +
    built.hex.slice(built.hex.length - 11);

  const parsed = parseTuyaLanFrame(tampered);
  assert.equal(parsed.valid, false);
  assert.equal(parsed.crcValid, false);
});

test('Xiaomi miIO UDP frame encodes 32-byte header and decodes accurately', () => {
  const token = '0123456789abcdef0123456789abcdef';
  const built = buildXiaomiMiioFrame({
    deviceIdHex: '04a1b2c3',
    stamp: 1700000123,
    tokenHex: token,
    payloadJson: '{"id":1,"method":"set_power","params":["on"]}',
  });

  assert.equal(built.hex.startsWith('2131'), true);
  const parsed = parseXiaomiMiioFrame(built.hex);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.deviceIdHex, '04a1b2c3');
  assert.equal(parsed.stamp, 1700000123);
  assert.equal(parsed.checksumHex, token);
  assert.match(parsed.payloadPreview ?? '', /set_power/);
});

test('Device pairing validation enforces strict IPv4, MAC, and protocol credential lengths', () => {
  const badTuya = validateDevicePairingInput({
    name: 'Lamp',
    brand: 'Tuya',
    protocol: 'tuya-lan-v34',
    category: 'lighting',
    room: 'Office',
    ip: '999.168.1.5',
    mac: 'INVALID',
    localCredential: 'short',
    transport: 'direct-lan',
  });
  assert.equal(badTuya.valid, false);
  assert.ok(badTuya.errors.ip);
  assert.ok(badTuya.errors.mac);
  assert.ok(badTuya.errors.localCredential);

  const validXiaomi = validateDevicePairingInput({
    name: 'Xiaomi Desk Lamp',
    brand: 'Xiaomi',
    protocol: 'xiaomi-miio',
    category: 'lighting',
    room: 'Office',
    ip: '192.168.10.99',
    mac: '64:90:C1:88:4A:99',
    localCredential: '4f8a21c90e7b63d12a5c8f901b3e7d44',
    transport: 'wireguard-vpn',
  });
  assert.equal(validXiaomi.valid, true);
});

test('Cross-brand automation triggers on Xiaomi motion and updates Tuya dimmer state', () => {
  const state = createInitialHubState();
  const rule = state.automations.find((a) => a.id === 'auto-hall-motion-tuya')!;

  // Initially motionDetected is false -> should not trigger
  assert.equal(evaluateAutomationTrigger(rule, state.devices, 'dev-aqara-hall-motion'), false);

  // Flip Xiaomi/Aqara sensor motionDetected to true
  const devicesWithMotion = state.devices.map((d) =>
    d.id === 'dev-aqara-hall-motion'
      ? { ...d, state: { ...d.state, motionDetected: true } }
      : d
  );
  assert.equal(evaluateAutomationTrigger(rule, devicesWithMotion, 'dev-aqara-hall-motion'), true);

  const result = executeAutomationRule(rule, devicesWithMotion);
  const updatedDimmer = result.updatedDevices.find((d) => d.id === 'dev-tuya-living-dimmer')!;
  assert.equal(updatedDimmer.state.brightness, 65);
  assert.equal(result.updatedRule.executionCount, rule.executionCount + 1);
  assert.equal(result.affectedDeviceNames.length, 2);
});

test('Automation draft validation blocks self-referencing feedback loops', () => {
  const result = validateAutomationDraft({
    name: 'Loop test',
    description: '',
    triggerDeviceId: 'dev-1',
    triggerProperty: 'power',
    triggerOperator: 'eq',
    triggerValue: true,
    targetDeviceId: 'dev-1',
    targetPower: false,
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.targetDeviceId);
});

test('Security compliance engine reacts deterministically to policy toggles across NIS2, NIST, GDPR, and EN 303 645', () => {
  const state = createInitialHubState();
  const baseline = evaluateComplianceControls(state.security, state.network, state.devices);
  const baselineSummary = summarizeCompliance(baseline);
  assert.equal(baselineSummary.nonCompliant, 0);
  assert.equal(baselineSummary.compliant, baselineSummary.total);

  // Disable cloud egress kill switch and vault encryption
  const weakened = evaluateComplianceControls(
    {
      ...state.security,
      cloudEgressKillSwitch: false,
      aes256VaultEncryption: false,
    },
    state.network,
    state.devices
  );
  const weakenedSummary = summarizeCompliance(weakened);
  assert.ok(weakenedSummary.nonCompliant >= 4);
});

test('Network validator catches malformed CIDR and proxy ports', () => {
  const state = createInitialHubState();
  const invalid = validateNetworkConfig({
    ...state.network,
    subnetCidr: '192.168.10.0/99',
    tunnelMode: 'socks5-proxy',
    proxyPort: 70000,
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.subnetCidr);
  assert.ok(invalid.errors.proxyPort);
});

test('Battery monitor classifies health tiers and detects low-battery IoT sensor alerts sorted by severity', () => {
  assert.equal(getBatteryHealthStatus(8, 20), 'critical');
  assert.equal(getBatteryHealthStatus(16, 20), 'low');
  assert.equal(getBatteryHealthStatus(21, 20), 'normal');
  assert.equal(simulateBatteryChange(5, -20), 0);
  assert.equal(simulateBatteryChange(95, 20), 100);

  const state = createInitialHubState();
  const alerts = detectLowBatteryAlerts(state.devices, 20);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].deviceId, 'dev-aqara-hall-motion');
  assert.equal(alerts[0].batteryPct, 16);
  assert.equal(alerts[0].severity, 'low');

  // When a second sensor drops to 9%, it should sort ahead as critical
  const drainedDevices = state.devices.map((d) =>
    d.id === 'dev-xiaomi-balcony-sensor'
      ? { ...d, state: { ...d.state, batteryPct: 9 } }
      : d
  );
  const twoAlerts = detectLowBatteryAlerts(drainedDevices, 20);
  assert.equal(twoAlerts.length, 2);
  assert.equal(twoAlerts[0].deviceId, 'dev-xiaomi-balcony-sensor');
  assert.equal(twoAlerts[0].severity, 'critical');
  assert.equal(twoAlerts[1].deviceId, 'dev-aqara-hall-motion');
});

