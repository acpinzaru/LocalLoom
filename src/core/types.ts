export type DeviceProtocol =
  | 'tuya-lan-v34'
  | 'tuya-lan-v33'
  | 'xiaomi-miio'
  | 'shelly-rpc'
  | 'matter-local'
  | 'esphome-api';

export type DeviceCategory =
  | 'lighting'
  | 'climate'
  | 'power'
  | 'sensor'
  | 'security';

export type DeviceBrand =
  | 'Tuya'
  | 'Smart Life'
  | 'Xiaomi'
  | 'Aqara'
  | 'Shelly'
  | 'Matter';

export interface SmartDeviceState {
  power: boolean;
  brightness?: number; // 0-100
  colorTempK?: number; // 2700-6500
  targetTempC?: number; // 16-30
  currentTempC?: number;
  humidityPct?: number;
  aqi?: number;
  fanSpeed?: 'auto' | 'silent' | 'medium' | 'high';
  powerWatts?: number;
  motionDetected?: boolean;
  lux?: number;
  locked?: boolean;
  privacyShutterClosed?: boolean;
}

export interface SmartDevice {
  id: string;
  name: string;
  brand: DeviceBrand;
  replacesApp: string;
  protocol: DeviceProtocol;
  category: DeviceCategory;
  room: string;
  ip: string;
  port: number;
  mac: string;
  firmware: string;
  localCredentialHint: string; // Masked localKey / miIO token fingerprint
  transport: 'direct-lan' | 'wireguard-vpn' | 'socks5-proxy';
  online: boolean;
  cloudBlocked: boolean;
  latencyMs: number;
  lastSeenIso: string;
  state: SmartDeviceState;
}

export interface DevicePairingInput {
  name: string;
  brand: DeviceBrand;
  protocol: DeviceProtocol;
  category: DeviceCategory;
  room: string;
  ip: string;
  mac: string;
  localCredential: string;
  transport: 'direct-lan' | 'wireguard-vpn' | 'socks5-proxy';
}

export interface DiscoveredLanDevice {
  tempId: string;
  suggestedName: string;
  brand: DeviceBrand;
  protocol: DeviceProtocol;
  category: DeviceCategory;
  ip: string;
  port: number;
  mac: string;
  broadcastMethod: string;
  sampleCredential: string;
}

export interface AutomationTrigger {
  type: 'device-state' | 'threshold' | 'schedule';
  deviceId?: string;
  property?: 'power' | 'motionDetected' | 'currentTempC' | 'aqi' | 'powerWatts';
  operator?: 'eq' | 'gt' | 'lt';
  value?: boolean | number;
  cronLabel?: string;
}

export interface AutomationAction {
  deviceId: string;
  patch: Partial<SmartDeviceState>;
  summary: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  localOnly: boolean;
  trigger: AutomationTrigger;
  actions: AutomationAction[];
  lastTriggeredIso: string | null;
  executionCount: number;
}

export interface NetworkConfig {
  subnetCidr: string;
  vlanId: number;
  dnsSinkholeEnabled: boolean;
  blockedCloudDomains: string[];
  tunnelMode: 'direct-lan' | 'wireguard-vpn' | 'socks5-proxy' | 'http-proxy';
  wireguardEndpoint: string;
  wireguardPublicKey: string;
  wireguardAllowedIps: string;
  proxyHost: string;
  proxyPort: number;
  proxyAuthEnabled: boolean;
  mdnsDiscoveryEnabled: boolean;
  udpBroadcastPorts: number[];
}

export interface SecurityPolicyState {
  cloudEgressKillSwitch: boolean;
  aes256VaultEncryption: boolean;
  perDeviceKeyIsolation: boolean;
  replayProtectionWindowSec: number;
  mutualTlsVpnBridge: boolean;
  zeroTelemetryStrict: boolean;
  localAuditLogSigned: boolean;
  autoKeyRotationDays: number;
  vaultKeyFingerprint: string;
  lastKeyRotationIso: string;
}

export type ComplianceFramework = 'NIS2' | 'NIST' | 'GDPR' | 'EN 303 645';

export interface ComplianceControl {
  id: string;
  framework: ComplianceFramework;
  article: string;
  title: string;
  requirement: string;
  status: 'compliant' | 'attention' | 'non-compliant';
  evidence: string;
}

export interface PluginModule {
  id: string;
  name: string;
  packageId: string;
  version: string;
  author: string;
  replacesApps: string[];
  protocols: string[];
  description: string;
  installed: boolean;
  enabled: boolean;
  verifiedSignature: boolean;
  sandboxPermissions: string[];
  androidSupport: 'Kotlin Coroutines + NIO' | 'Kotlin UDP + JNI' | 'Android NsdManager + CoAP';
}

export interface AuditEvent {
  id: string;
  timestampIso: string;
  category: 'device' | 'automation' | 'network' | 'security' | 'plugin';
  actor: string;
  message: string;
  protocolNote?: string;
}

export interface HubStateSnapshot {
  devices: SmartDevice[];
  automations: AutomationRule[];
  network: NetworkConfig;
  security: SecurityPolicyState;
  plugins: PluginModule[];
  auditLog: AuditEvent[];
}
