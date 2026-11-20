import React, { useEffect, useState } from 'react';
import { Copy, Check, ShieldAlert, Terminal } from 'lucide-react';
import { validateNetworkConfig } from '../core/securityCompliance';
import type { EnrichedHubState } from '../hooks/useHubState';
import type { NetworkConfig } from '../core/types';

interface NetworkVpnViewProps {
  hub: EnrichedHubState;
  onUpdateNetwork: (
    patch: Partial<NetworkConfig>
  ) => Promise<{ ok: true } | { ok: false; errors?: Record<string, string>; error?: string }>;
}

export const NetworkVpnView: React.FC<NetworkVpnViewProps> = ({ hub, onUpdateNetwork }) => {
  const [draft, setDraft] = useState<NetworkConfig>(hub.network);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Local Protocol Packet Lab state
  const [labMode, setLabMode] = useState<'encode' | 'decode'>('encode');
  const [labProtocol, setLabProtocol] = useState<'tuya-lan-v34' | 'tuya-lan-v33' | 'xiaomi-miio'>('tuya-lan-v34');
  const [labCredential, setLabCredential] = useState('k8fP2mN7qR4vX9qP');
  const [labPayload, setLabPayload] = useState('{"devId":"bf92e1a4","dps":{"1":true,"2":720}}');
  const [labHexInput, setLabHexInput] = useState('');
  const [labResult, setLabResult] = useState<Record<string, unknown> | null>(null);
  const [labError, setLabError] = useState<string | null>(null);
  const [copiedHex, setCopiedHex] = useState(false);

  useEffect(() => {
    setDraft(hub.network);
  }, [hub.network]);

  const handleSaveNetwork = async (e: React.FormEvent) => {
    e.preventDefault();
    const localValidation = validateNetworkConfig(draft);
    if (!localValidation.valid) {
      setErrors(localValidation.errors);
      return;
    }
    setSaving(true);
    try {
      const res = await onUpdateNetwork(draft);
      if (!res.ok) {
        setErrors(res.errors ?? { subnetCidr: res.error ?? 'Check network settings.' });
      } else {
        setErrors({});
      }
    } finally {
      setSaving(false);
    }
  };

  const handleProtocolSwitch = (next: 'tuya-lan-v34' | 'tuya-lan-v33' | 'xiaomi-miio') => {
    setLabProtocol(next);
    setLabResult(null);
    setLabError(null);
    if (next === 'xiaomi-miio') {
      setLabCredential('4f8a21c90e7b63d12a5c8f901b3e7d44');
      setLabPayload('{"id":42,"method":"set_mode","params":["auto"]}');
    } else {
      setLabCredential('k8fP2mN7qR4vX9qP');
      setLabPayload('{"devId":"bf92e1a4","dps":{"1":true,"2":720}}');
    }
  };

  const runPacketLab = async (e: React.FormEvent) => {
    e.preventDefault();
    setLabError(null);
    try {
      const res = await fetch('/api/protocols/frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: labMode,
          protocol: labProtocol,
          payloadJson: labPayload,
          credential: labCredential,
          sequence: 14,
          deviceIdHex: '04a1b2c3',
          hexInput: labHexInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLabError(data.error || 'Unable to process packet frame.');
        setLabResult(null);
        return;
      }
      setLabResult(data);
      if (labMode === 'encode' && data.frame?.hex) {
        setLabHexInput(data.frame.hex);
      }
    } catch {
      setLabError('Unable to reach local frame codec endpoint.');
    }
  };

  const copyFrameHex = async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopiedHex(true);
      window.setTimeout(() => setCopiedHex(false), 1800);
    } catch {
      // Clipboard unavailable in headless mode
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Local Network, VPN & Proxy Transport
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Route Android and desktop commands directly into your isolated IoT VLAN via Direct LAN, WireGuard VPN, or SOCKS5/HTTP proxy.
        </p>
      </div>

      {/* Transport & Tunnel Form */}
      <form
        onSubmit={handleSaveNetwork}
        noValidate
        className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Active Transport Mode
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Works identically on any continent without vendor regional servers.
            </p>
          </div>

          <div
            role="radiogroup"
            aria-label="Transport tunnel mode"
            className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 sm:flex dark:bg-slate-800"
          >
            {(
              [
                { id: 'direct-lan', label: 'Direct LAN' },
                { id: 'wireguard-vpn', label: 'WireGuard VPN' },
                { id: 'socks5-proxy', label: 'SOCKS5 Proxy' },
                { id: 'http-proxy', label: 'HTTP Proxy' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={draft.tunnelMode === opt.id}
                onClick={() => setDraft({ ...draft, tunnelMode: opt.id })}
                className={`min-h-[36px] rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  draft.tunnelMode === opt.id
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="net-cidr" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  IoT Subnet CIDR
                </label>
                <input
                  id="net-cidr"
                  type="text"
                  value={draft.subnetCidr}
                  onChange={(e) => setDraft({ ...draft, subnetCidr: e.target.value })}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                {errors.subnetCidr && (
                  <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">{errors.subnetCidr}</p>
                )}
              </div>

              <div>
                <label htmlFor="net-vlan" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Isolated VLAN ID
                </label>
                <input
                  id="net-vlan"
                  type="number"
                  value={draft.vlanId}
                  onChange={(e) => setDraft({ ...draft, vlanId: Number(e.target.value) })}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 tabular-nums dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                {errors.vlanId && (
                  <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">{errors.vlanId}</p>
                )}
              </div>
            </div>

            {draft.tunnelMode === 'wireguard-vpn' && (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  WireGuard Peer Configuration
                </p>
                <div>
                  <label htmlFor="wg-endpoint" className="block text-xs text-slate-600 dark:text-slate-400">
                    Endpoint Host & Port
                  </label>
                  <input
                    id="wg-endpoint"
                    type="text"
                    value={draft.wireguardEndpoint}
                    onChange={(e) => setDraft({ ...draft, wireguardEndpoint: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  {errors.wireguardEndpoint && (
                    <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">{errors.wireguardEndpoint}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="wg-pubkey" className="block text-xs text-slate-600 dark:text-slate-400">
                    Router Public Key (Curve25519)
                  </label>
                  <input
                    id="wg-pubkey"
                    type="text"
                    value={draft.wireguardPublicKey}
                    onChange={(e) => setDraft({ ...draft, wireguardPublicKey: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  {errors.wireguardPublicKey && (
                    <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">{errors.wireguardPublicKey}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="wg-ips" className="block text-xs text-slate-600 dark:text-slate-400">
                    Allowed Subnets
                  </label>
                  <input
                    id="wg-ips"
                    type="text"
                    value={draft.wireguardAllowedIps}
                    onChange={(e) => setDraft({ ...draft, wireguardAllowedIps: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            )}

            {(draft.tunnelMode === 'socks5-proxy' || draft.tunnelMode === 'http-proxy') && (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {draft.tunnelMode === 'socks5-proxy' ? 'SOCKS5 Local Tunnel Proxy' : 'HTTP CONNECT Local Proxy'}
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label htmlFor="proxy-host" className="block text-xs text-slate-600 dark:text-slate-400">
                      Proxy Host
                    </label>
                    <input
                      id="proxy-host"
                      type="text"
                      value={draft.proxyHost}
                      onChange={(e) => setDraft({ ...draft, proxyHost: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                    {errors.proxyHost && (
                      <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">{errors.proxyHost}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="proxy-port" className="block text-xs text-slate-600 dark:text-slate-400">
                      Port
                    </label>
                    <input
                      id="proxy-port"
                      type="number"
                      value={draft.proxyPort}
                      onChange={(e) => setDraft({ ...draft, proxyPort: Number(e.target.value) })}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 tabular-nums dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                    {errors.proxyPort && (
                      <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">{errors.proxyPort}</p>
                    )}
                  </div>
                </div>
                <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={draft.proxyAuthEnabled}
                    onChange={(e) => setDraft({ ...draft, proxyAuthEnabled: e.target.checked })}
                    className="h-4 w-4 rounded accent-teal-700"
                  />
                  Require authenticated proxy credentials over TLS
                </label>
              </div>
            )}
          </div>

          {/* DNS Sinkhole & Blocked Vendor Domains */}
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Vendor Cloud DNS Sinkhole
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Null-routes Tuya, Smart Life, and Xiaomi cloud call-home endpoints at your local DNS resolver so hardware remains strictly LAN-bound.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={draft.dnsSinkholeEnabled}
                aria-label="Toggle vendor cloud DNS sinkhole"
                onClick={() => setDraft({ ...draft, dnsSinkholeEnabled: !draft.dnsSinkholeEnabled })}
                className={`min-h-[36px] shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  draft.dnsSinkholeEnabled
                    ? 'bg-teal-700 text-white'
                    : 'border border-slate-300 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                }`}
              >
                {draft.dnsSinkholeEnabled ? 'Blocking' : 'Bypassed'}
              </button>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Sinkholed Cloud Endpoints ({draft.blockedCloudDomains.length})
              </p>
              <div className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-slate-50 font-mono text-xs text-slate-600 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                {draft.blockedCloudDomains.map((domain) => (
                  <div key={domain} className="flex items-center justify-between px-3 py-2">
                    <span>{domain}</span>
                    <span className="text-[11px] text-slate-400">0.0.0.0</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4 border-t border-slate-100 pt-4 dark:border-slate-800">
          <p className="font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
            Discovery UDP Ports: {draft.udpBroadcastPorts.join(', ')} · mDNS {draft.mdnsDiscoveryEnabled ? 'Enabled' : 'Disabled'}
          </p>
          <button
            type="submit"
            disabled={saving}
            className="min-h-[42px] rounded-lg bg-teal-700 px-5 py-2 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-60 whitespace-nowrap"
          >
            {saving ? 'Applying Route…' : 'Save Transport Settings'}
          </button>
        </div>
      </form>

      {/* Local Protocol Packet Lab */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Terminal className="h-5 w-5 text-teal-700 dark:text-teal-400" aria-hidden="true" />
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Local Protocol Packet Lab
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Inspect and verify reverse-engineered Tuya LAN (0x000055AA) and Xiaomi miIO (0x2131) encrypted frames.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => {
                setLabMode('encode');
                setLabResult(null);
              }}
              className={`min-h-[34px] rounded-md px-3 text-xs font-medium whitespace-nowrap ${
                labMode === 'encode'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Encode Frame
            </button>
            <button
              type="button"
              onClick={() => {
                setLabMode('decode');
                setLabResult(null);
              }}
              className={`min-h-[34px] rounded-md px-3 text-xs font-medium whitespace-nowrap ${
                labMode === 'decode'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Decode & Verify
            </button>
          </div>
        </div>

        <form onSubmit={runPacketLab} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="lab-proto" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Target Local Protocol
              </label>
              <select
                id="lab-proto"
                value={labProtocol}
                onChange={(e) =>
                  handleProtocolSwitch(e.target.value as 'tuya-lan-v34' | 'tuya-lan-v33' | 'xiaomi-miio')
                }
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="tuya-lan-v34">Tuya / Smart Life LAN v3.4 (TCP:6668)</option>
                <option value="tuya-lan-v33">Tuya / Smart Life LAN v3.3 (TCP:6668)</option>
                <option value="xiaomi-miio">Xiaomi miIO Local (UDP:54321)</option>
              </select>
            </div>

            {labMode === 'encode' && (
              <div>
                <label htmlFor="lab-cred" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {labProtocol === 'xiaomi-miio' ? 'miIO 128-bit Token (32 hex)' : 'Tuya localKey (16 ASCII bytes)'}
                </label>
                <input
                  id="lab-cred"
                  type="text"
                  value={labCredential}
                  onChange={(e) => setLabCredential(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            )}
          </div>

          {labMode === 'encode' ? (
            <div>
              <label htmlFor="lab-json" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Local Command Payload (JSON)
              </label>
              <textarea
                id="lab-json"
                rows={2}
                value={labPayload}
                onChange={(e) => setLabPayload(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          ) : (
            <div>
              <label htmlFor="lab-hex" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Raw Hex Frame to Inspect & Verify CRC / Header
              </label>
              <textarea
                id="lab-hex"
                rows={3}
                value={labHexInput}
                onChange={(e) => setLabHexInput(e.target.value)}
                placeholder="Paste a 000055aa...0000aa55 or 2131... hex packet"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          )}

          {labError && (
            <div role="alert" className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
              <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{labError}</span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              className="min-h-[42px] rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 dark:bg-teal-700 dark:hover:bg-teal-800"
            >
              {labMode === 'encode' ? 'Encode Encrypted Frame' : 'Verify & Decode Frame'}
            </button>
          </div>
        </form>

        {labResult && (
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70" data-testid="packet-lab-output">
            {Boolean(labResult.frame) ? (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {(labResult.frame as { headerSummary: string }).headerSummary}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyFrameHex((labResult.frame as { hex: string }).hex)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline dark:text-teal-400"
                  >
                    {copiedHex ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedHex ? 'Copied Hex' : 'Copy Frame Hex'}
                  </button>
                </div>
                <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  Cipher: {(labResult.encryption as { cipher: string }).cipher} · {(labResult.encryption as { keyDerivation: string }).keyDerivation}
                </p>
                <pre className="overflow-x-auto rounded-md border border-slate-200 bg-white p-3 font-mono text-xs break-all whitespace-pre-wrap text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                  {(labResult.frame as { hex: string }).hex}
                </pre>
              </div>
            ) : (
              <pre className="overflow-x-auto font-mono text-xs text-slate-800 dark:text-slate-200">
                {JSON.stringify(labResult.parsed, null, 2)}
              </pre>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
