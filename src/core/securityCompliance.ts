import type {
  ComplianceControl,
  NetworkConfig,
  SecurityPolicyState,
  SmartDevice,
} from './types';

export function evaluateComplianceControls(
  policies: SecurityPolicyState,
  network: NetworkConfig,
  devices: SmartDevice[]
): ComplianceControl[] {
  const allDevicesCloudBlocked =
    devices.length === 0 || devices.every((d) => d.cloudBlocked);
  const usingRemoteTunnel = network.tunnelMode !== 'direct-lan';
  const tunnelSecured = !usingRemoteTunnel || policies.mutualTlsVpnBridge || network.tunnelMode === 'wireguard-vpn';

  return [
    {
      id: 'nis2-21-2-h',
      framework: 'NIS2',
      article: 'Art. 21(2)(h)',
      title: 'Cryptographic Local Transport & Vault',
      requirement:
        'Policies and procedures regarding the use of cryptography and end-to-end encryption for local device credentials and command payloads.',
      status: policies.aes256VaultEncryption && policies.perDeviceKeyIsolation ? 'compliant' : 'non-compliant',
      evidence: policies.aes256VaultEncryption
        ? `AES-256-GCM local vault active (key ${policies.vaultKeyFingerprint}); per-device key isolation ${
            policies.perDeviceKeyIsolation ? 'enforced' : 'disabled'
          }.`
        : 'Local credential vault encryption is disabled.',
    },
    {
      id: 'nis2-21-2-d',
      framework: 'NIS2',
      article: 'Art. 21(2)(d)',
      title: 'Supply-Chain Cloud Dependency Elimination',
      requirement:
        'Eliminate third-party cloud vendor attack surfaces and foreign control-plane dependencies across connected IoT endpoints.',
      status:
        policies.cloudEgressKillSwitch && network.dnsSinkholeEnabled && allDevicesCloudBlocked
          ? 'compliant'
          : policies.cloudEgressKillSwitch
            ? 'attention'
            : 'non-compliant',
      evidence: policies.cloudEgressKillSwitch
        ? `Cloud egress kill-switch blocking ${network.blockedCloudDomains.length} vendor domains on VLAN ${network.vlanId}.`
        : 'Vendor cloud egress domains are not blocked at local gateway.',
    },
    {
      id: 'nis2-21-2-b',
      framework: 'NIS2',
      article: 'Art. 21(2)(b)',
      title: 'Tamper-Evident Local Incident Logging',
      requirement:
        'Maintain signed, locally stored audit trails for configuration changes, pairing events, and automated executions.',
      status: policies.localAuditLogSigned ? 'compliant' : 'attention',
      evidence: policies.localAuditLogSigned
        ? 'HMAC-signed append-only local event log active on hub.'
        : 'Local audit events are recorded unsigned.',
    },
    {
      id: 'nist-800-213-dp',
      framework: 'NIST',
      article: 'SP 800-213 / PR.DS',
      title: 'Data Protection & Replay Mitigation',
      requirement:
        'Protect local LAN command frames against packet replay attacks with bounded timestamp/sequence windows.',
      status:
        policies.replayProtectionWindowSec > 0 && policies.replayProtectionWindowSec <= 30
          ? 'compliant'
          : policies.replayProtectionWindowSec > 30
            ? 'attention'
            : 'non-compliant',
      evidence:
        policies.replayProtectionWindowSec > 0
          ? `Strict sequence/timestamp replay window set to ${policies.replayProtectionWindowSec}s across Tuya & miIO adapters.`
          : 'Replay protection window disabled.',
    },
    {
      id: 'nist-csf-pr-aa',
      framework: 'NIST',
      article: 'CSF 2.0 PR.AA-03',
      title: 'Authenticated VPN / Proxy Remote Access',
      requirement:
        'Remote access to local IoT VLANs must traverse authenticated encrypted tunnels rather than exposed UPnP or vendor cloud relays.',
      status: tunnelSecured ? 'compliant' : 'non-compliant',
      evidence:
        network.tunnelMode === 'direct-lan'
          ? `Direct local VLAN ${network.vlanId} (${network.subnetCidr}) with zero external ports exposed.`
          : `${network.tunnelMode.toUpperCase()} active with ${
              policies.mutualTlsVpnBridge ? 'mTLS / WireGuard key verification' : 'unverified proxy bridge'
            }.`,
    },
    {
      id: 'nist-key-lifecycle',
      framework: 'NIST',
      article: 'SP 800-57 Part 1',
      title: 'Local Master Key Rotation Hygiene',
      requirement:
        'Rotate local Android Keystore / Hub master encryption keys on a defined periodic interval (<= 90 days).',
      status: policies.autoKeyRotationDays > 0 && policies.autoKeyRotationDays <= 90 ? 'compliant' : 'attention',
      evidence: `Automatic vault re-keying scheduled every ${policies.autoKeyRotationDays} days.`,
    },
    {
      id: 'gdpr-art-25',
      framework: 'GDPR',
      article: 'Art. 25',
      title: 'Data Protection by Design & Default',
      requirement:
        'Ensure zero personal occupancy, telemetry, or device usage data leaves the household boundary by default.',
      status:
        policies.zeroTelemetryStrict && policies.cloudEgressKillSwitch
          ? 'compliant'
          : 'non-compliant',
      evidence: policies.zeroTelemetryStrict
        ? 'Zero outbound analytics, crash dumps, or vendor telemetry packets permitted.'
        : 'Strict zero-telemetry enforcement is turned off.',
    },
    {
      id: 'gdpr-art-32',
      framework: 'GDPR',
      article: 'Art. 32',
      title: 'Security of Local Processing',
      requirement:
        'Encrypt sensitive device tokens, automation schedules, and sensor histories at rest and in local transit.',
      status: policies.aes256VaultEncryption ? 'compliant' : 'non-compliant',
      evidence: policies.aes256VaultEncryption
        ? 'All Tuya localKeys and Xiaomi miIO tokens sealed inside AES-256-GCM hardware-backed keystore.'
        : 'Device secrets stored without AES-256-GCM envelope encryption.',
    },
    {
      id: 'gdpr-art-20',
      framework: 'GDPR',
      article: 'Art. 20',
      title: 'Right to Data Portability & Erasure',
      requirement:
        'Users can export all local hub configuration and device schemas in open JSON or wipe local storage instantaneously.',
      status: 'compliant',
      evidence: 'Open JSON export and instant local vault purge controls available in Hub Security.',
    },
    {
      id: 'etsi-5-1',
      framework: 'EN 303 645',
      article: 'Provision 5.1-1',
      title: 'No Universal Default Passwords',
      requirement:
        'Each paired IoT device uses a unique per-device local key or 128-bit miIO token isolated per endpoint.',
      status: policies.perDeviceKeyIsolation ? 'compliant' : 'non-compliant',
      evidence: policies.perDeviceKeyIsolation
        ? `${devices.length} active endpoints bound to distinct per-device local credentials.`
        : 'Per-device credential isolation policy disabled.',
    },
  ];
}

export function summarizeCompliance(controls: ComplianceControl[]) {
  const compliant = controls.filter((c) => c.status === 'compliant').length;
  const attention = controls.filter((c) => c.status === 'attention').length;
  const nonCompliant = controls.filter((c) => c.status === 'non-compliant').length;
  return {
    total: controls.length,
    compliant,
    attention,
    nonCompliant,
  };
}

export function validateNetworkConfig(config: NetworkConfig): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};
  if (!/^(\d{1,3}\.){3}\d{1,3}\/(\d|[1-2]\d|3[0-2])$/.test(config.subnetCidr.trim())) {
    errors.subnetCidr = 'Enter a valid IPv4 CIDR block (for example, 192.168.10.0/24).';
  }
  if (!Number.isInteger(config.vlanId) || config.vlanId < 1 || config.vlanId > 4094) {
    errors.vlanId = 'VLAN ID must be an integer between 1 and 4094.';
  }
  if (config.tunnelMode === 'wireguard-vpn') {
    if (!config.wireguardEndpoint.trim() || !config.wireguardEndpoint.includes(':')) {
      errors.wireguardEndpoint = 'Enter a valid WireGuard host:port endpoint (for example, vpn.home.lan:51820).';
    }
    if (config.wireguardPublicKey.trim().length < 32) {
      errors.wireguardPublicKey = 'Enter a valid base64 WireGuard peer public key.';
    }
  }
  if (config.tunnelMode === 'socks5-proxy' || config.tunnelMode === 'http-proxy') {
    if (!config.proxyHost.trim()) {
      errors.proxyHost = 'Enter the local proxy host or IP address.';
    }
    if (!Number.isInteger(config.proxyPort) || config.proxyPort < 1 || config.proxyPort > 65535) {
      errors.proxyPort = 'Proxy port must be between 1 and 65535.';
    }
  }
  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
