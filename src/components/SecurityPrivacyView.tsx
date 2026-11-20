import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  KeyRound,
  RotateCcw,
  ShieldX,
} from 'lucide-react';
import type { EnrichedHubState } from '../hooks/useHubState';
import type { ComplianceFramework, SecurityPolicyState } from '../core/types';

interface SecurityPrivacyViewProps {
  hub: EnrichedHubState;
  onUpdatePolicies: (patch: Partial<SecurityPolicyState>) => Promise<void>;
  onRotateKey: () => Promise<void>;
  onResetBaseline: () => Promise<void>;
}

export const SecurityPrivacyView: React.FC<SecurityPrivacyViewProps> = ({
  hub,
  onUpdatePolicies,
  onRotateKey,
  onResetBaseline,
}) => {
  const [frameworkFilter, setFrameworkFilter] = useState<'All' | ComplianceFramework>('All');
  const [rotating, setRotating] = useState(false);

  const controls = hub.complianceControls.filter(
    (c) => frameworkFilter === 'All' || c.framework === frameworkFilter
  );

  const handleRotate = async () => {
    setRotating(true);
    try {
      await onRotateKey();
    } finally {
      setRotating(false);
    }
  };

  const handleExportGdprReport = () => {
    const payload = {
      exportedAtIso: new Date().toISOString(),
      standard: 'GDPR Art. 20 Data Portability & NIS2 / NIST Compliance Report',
      hubSummary: hub.complianceSummary,
      securityPolicies: hub.security,
      networkRouting: {
        ...hub.network,
        wireguardPublicKey: '[REDACTED_PUBLIC_KEY]',
      },
      devices: hub.devices.map((d) => ({
        id: d.id,
        name: d.name,
        brand: d.brand,
        protocol: d.protocol,
        room: d.room,
        ip: d.ip,
        cloudBlocked: d.cloudBlocked,
      })),
      complianceControls: hub.complianceControls,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `localloom-compliance-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const policyItems: {
    key: keyof SecurityPolicyState;
    label: string;
    detail: string;
    standards: string;
  }[] = [
    {
      key: 'cloudEgressKillSwitch',
      label: 'Strict Cloud Egress Kill-Switch',
      detail: 'Blocks Tuya, Smart Life, and Xiaomi IoT endpoints from resolving or reaching external WAN servers.',
      standards: 'NIS2 Art. 21(2)(d) · GDPR Art. 25',
    },
    {
      key: 'aes256VaultEncryption',
      label: 'AES-256-GCM Local Keystore Vault',
      detail: 'Seals all device localKeys, miIO tokens, and WireGuard keys at rest using hardware-backed AES-256-GCM.',
      standards: 'NIS2 Art. 21(2)(h) · GDPR Art. 32',
    },
    {
      key: 'perDeviceKeyIsolation',
      label: 'Per-Device Scoped Credential Isolation',
      detail: 'Enforces unique per-endpoint credentials with zero shared factory keys across paired smart home devices.',
      standards: 'ETSI EN 303 645 5.1-1',
    },
    {
      key: 'mutualTlsVpnBridge',
      label: 'Authenticated mTLS / WireGuard Tunnel Verification',
      detail: 'Requires cryptographic peer identity verification before dispatching LAN commands over remote VPN or proxy.',
      standards: 'NIST CSF 2.0 PR.AA-03',
    },
    {
      key: 'zeroTelemetryStrict',
      label: 'Zero Outbound Telemetry & Analytics',
      detail: 'Disables crash reporting, usage metrics, and external update pings globally.',
      standards: 'GDPR Art. 25 Data Minimization',
    },
    {
      key: 'localAuditLogSigned',
      label: 'HMAC-Signed Append-Only Local Audit Log',
      detail: 'Signs every device pairing, policy edit, and cross-brand automation run locally on the hub.',
      standards: 'NIS2 Art. 21(2)(b)',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Security Policies & Global Privacy Compliance
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Enforce local cryptographic integrity and verify alignment with NIS2, NIST SP 800-213, GDPR, and ETSI EN 303 645.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2.5 sm:flex-nowrap">
          <button
            type="button"
            onClick={handleExportGdprReport}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Export GDPR JSON
          </button>

          <button
            type="button"
            onClick={handleRotate}
            disabled={rotating}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
          >
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
            {rotating ? 'Rotating Vault Key…' : 'Rotate Vault Master Key'}
          </button>
        </div>
      </div>

      {/* Vault & Policy Controls Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {policyItems.map((item) => {
            const checked = Boolean(hub.security[item.key]);
            return (
              <div key={item.key} className="flex items-start justify-between gap-4 p-4 sm:p-5">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{item.detail}</p>
                  <p className="mt-1.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">{item.standards}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={checked}
                  aria-label={item.label}
                  onClick={() => onUpdatePolicies({ [item.key]: !checked })}
                  className={`min-h-[38px] shrink-0 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    checked
                      ? 'bg-teal-700 text-white hover:bg-teal-800'
                      : 'border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {checked ? 'Enforced' : 'Disabled'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Keystore & Timing Parameters */}
        <aside className="self-start space-y-5 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Hardware Keystore Status
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Android StrongBox / Local Hub Master Key Fingerprint
              </p>
              <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800 break-all dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200" data-testid="vault-fingerprint">
                {hub.security.vaultKeyFingerprint}
              </p>
              <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500 dark:text-slate-400">Envelope Cipher</dt>
                  <dd className="font-mono text-slate-800 dark:text-slate-200">AES-256-GCM</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500 dark:text-slate-400">Last Rotation</dt>
                  <dd className="font-mono text-slate-800 tabular-nums dark:text-slate-200">
                    {hub.security.lastKeyRotationIso.slice(0, 10)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500 dark:text-slate-400">Sealed Endpoints</dt>
                  <dd className="font-mono text-slate-800 tabular-nums dark:text-slate-200">
                    {hub.devices.length} devices
                  </dd>
                </div>
              </dl>
            </div>

            <div>
              <label htmlFor="replay-window" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Replay Protection Window (NIST SP 800-213)
              </label>
              <select
                id="replay-window"
                value={hub.security.replayProtectionWindowSec}
                onChange={(e) => onUpdatePolicies({ replayProtectionWindowSec: Number(e.target.value) })}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value={10}>10 seconds (Strict)</option>
                <option value={15}>15 seconds (Recommended)</option>
                <option value={30}>30 seconds (Balanced)</option>
                <option value={60}>60 seconds (Relaxed — Warning)</option>
                <option value={0}>Disabled (Non-Compliant)</option>
              </select>
            </div>

            <div>
              <label htmlFor="key-rotation" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Automatic Vault Key Rotation Interval
              </label>
              <select
                id="key-rotation"
                value={hub.security.autoKeyRotationDays}
                onChange={(e) => onUpdatePolicies({ autoKeyRotationDays: Number(e.target.value) })}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value={30}>Every 30 days</option>
                <option value={60}>Every 60 days</option>
                <option value={90}>Every 90 days</option>
                <option value={180}>Every 180 days (Attention)</option>
              </select>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              GDPR Art. 17 Right to Erasure: wipe custom paired endpoints and restore clean baseline.
            </p>
            <button
              type="button"
              onClick={onResetBaseline}
              className="mt-3 inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Restore Clean Hub Baseline
            </button>
          </div>
        </aside>
      </div>

      {/* Live Standards Compliance Matrix */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Live Compliance Assessment
            </h3>
            <p className="mt-0.5 font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400" data-testid="compliance-summary">
              {hub.complianceSummary.compliant} Compliant · {hub.complianceSummary.attention} Attention · {hub.complianceSummary.nonCompliant} Non-Compliant
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {(['All', 'NIS2', 'NIST', 'GDPR', 'EN 303 645'] as const).map((fw) => (
              <button
                key={fw}
                type="button"
                onClick={() => setFrameworkFilter(fw)}
                className={`min-h-[34px] rounded-md px-3 text-xs font-medium whitespace-nowrap ${
                  frameworkFilter === fw
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {fw}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {controls.map((ctrl) => (
            <div key={ctrl.id} className="grid grid-cols-1 gap-3 p-5 md:grid-cols-12 md:items-start">
              <div className="md:col-span-3">
                <p className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {ctrl.framework} · {ctrl.article}
                </p>
                <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium">
                  {ctrl.status === 'compliant' && (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                      <span className="text-emerald-700 dark:text-emerald-400">Compliant</span>
                    </>
                  )}
                  {ctrl.status === 'attention' && (
                    <>
                      <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400" aria-hidden="true" />
                      <span className="text-amber-700 dark:text-amber-400">Attention Needed</span>
                    </>
                  )}
                  {ctrl.status === 'non-compliant' && (
                    <>
                      <ShieldX className="h-4 w-4 text-rose-700 dark:text-rose-400" aria-hidden="true" />
                      <span className="text-rose-700 dark:text-rose-400">Non-Compliant</span>
                    </>
                  )}
                </div>
              </div>

              <div className="md:col-span-5">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{ctrl.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{ctrl.requirement}</p>
              </div>

              <div className="md:col-span-4">
                <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">{ctrl.evidence}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Signed Local Audit Trail */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Local Hub Audit Trail
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Stored exclusively on-device; never uploaded to external telemetry collectors.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Timestamp (UTC)</th>
                <th className="px-5 py-3 font-medium">Source</th>
                <th className="px-5 py-3 font-medium">Event</th>
                <th className="px-5 py-3 font-medium">Protocol / Policy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {hub.auditLog.slice(0, 10).map((evt) => (
                <tr key={evt.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="px-5 py-3 font-mono text-slate-500 tabular-nums whitespace-nowrap dark:text-slate-400">
                    {evt.timestampIso.replace('T', ' ').slice(0, 19)}
                  </td>
                  <td className="px-5 py-3 font-medium text-slate-800 whitespace-nowrap dark:text-slate-200">
                    {evt.actor}
                  </td>
                  <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{evt.message}</td>
                  <td className="px-5 py-3 font-mono text-slate-500 whitespace-nowrap dark:text-slate-400">
                    {evt.protocolNote ?? 'Local'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
