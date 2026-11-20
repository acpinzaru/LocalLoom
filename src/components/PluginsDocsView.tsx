import React, { useState } from 'react';
import { BookOpen, Check, Copy, Plus, Puzzle } from 'lucide-react';
import type { EnrichedHubState } from '../hooks/useHubState';

interface PluginsDocsViewProps {
  hub: EnrichedHubState;
  onUpdatePlugin: (pluginId: string, patch: { installed?: boolean; enabled?: boolean }) => Promise<void>;
  onRegisterPlugin: (payload: {
    name: string;
    packageId: string;
    replacesApp: string;
    protocolSpec: string;
    description: string;
    author: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
}

const DOC_SECTIONS = {
  android: {
    title: 'Android Kotlin Local Socket & WireGuard Architecture',
    summary:
      'Reference Kotlin Coroutines implementation for direct LAN/VPN sockets and Android StrongBox keystore protection without Play Services or vendor cloud SDKs.',
    code: `// LocalLoom Android Core — Direct Tuya TCP:6668 & Xiaomi UDP:54321 Transport
class LocalDeviceTransport(
    private val keyStore: AndroidHardwareVault,
    private val connectivityManager: ConnectivityManager
) {
    suspend fun sendTuyaCommand(
        host: InetAddress,
        deviceId: String,
        dpsPayload: ByteArray
    ): ByteArray = withContext(Dispatchers.IO) {
        // Bind strictly to active Wi-Fi LAN or WireGuard VpnService network
        val localNetwork = connectivityManager.activeNetwork
            ?: throw IOException("No local LAN or WireGuard VPN route available")

        val localKey = keyStore.unwrapDeviceKey(deviceId) // AES-256-GCM StrongBox
        val frame = TuyaLanCodec.encodeV34(dpsPayload, localKey, seq = nextSeq())

        localNetwork.socketFactory.createSocket(host, 6668).use { socket ->
            socket.soTimeout = 2500
            socket.getOutputStream().write(frame)
            socket.getInputStream().readBytes()
        }
    }
}`,
  },
  pluginSdk: {
    title: 'Open-Source Plugin SDK Specification',
    summary:
      'Every third-party brand module implements LocalLoomAdapter inside a capability-restricted LAN sandbox with zero WAN internet permission.',
    code: `import type { LocalLoomAdapter, LocalSocketCapability } from '@localloom/sdk';

export const tapoKlapAdapter: LocalLoomAdapter = {
  packageId: '@localloom/adapter-tapo-klap',
  replacesApps: ['TP-Link Tapo', 'Kasa Smart'],
  sandboxPermissions: ['lan:http:80', 'keystore:read-scoped'],

  async discover(lan: LocalSocketCapability) {
    return lan.mdnsBrowse('_tapo._tcp.local');
  },

  async dispatch(endpoint, secret, command) {
    // 1. Complete local KLAP v2 SHA-256 handshake on port 80
    // 2. Encrypt JSON command with session AES-128-CBC key + sequence salt
    return lan.postLocalJson(endpoint.ip, 80, '/request', { command, secret });
  },
};`,
  },
  reverseEng: {
    title: 'Reverse-Engineering Local IoT Protocols Checklist',
    summary:
      'How contributors document and verify cloud-free operation for any global IoT hardware brand before opening a GitHub pull request.',
    code: `# 1. Isolate test device on dedicated IoT VLAN (e.g. VLAN 10 / 192.168.10.0/24)
# 2. Block all outbound WAN DNS & TCP/UDP egress on router firewall
# 3. Capture local broadcast & control packets via tcpdump:
sudo tcpdump -i eth0.10 -w capture.pcap '(udp port 6666 or udp port 6667 or tcp port 6668 or udp port 54321)'

# 4. Verify local frame structure & unit-test pure codec:
npx tsx --test src/core/core.test.ts

# 5. Confirm NIS2 / NIST / GDPR invariants:
#    - Zero hardcoded cloud domains (tuyaeu.com, tuyaus.com, io.mi.com)
#    - Bounded replay window (<= 30s monotonic stamp or sequence counter)
#    - Unique per-device localKey / 128-bit miIO token stored in AES-256-GCM vault`,
  },
  contributing: {
    title: 'GitHub Open-Source Governance & Contribution Flow',
    summary:
      'Designed for global community maintenance under Apache-2.0 so households across every continent share one unified, vendor-neutral hub.',
    code: `# Repository Layout for GitHub Contributors
├── src/core/
│   ├── protocols.ts          # Pure Tuya v3.3/v3.4 & Xiaomi miIO binary codecs
│   ├── automationEngine.ts   # Cross-brand local rule compiler & executor
│   ├── securityCompliance.ts # NIS2, NIST SP 800-213, GDPR & EN 303 645 checks
│   └── core.test.ts          # Deterministic node:test verification suite
├── docs/
│   └── PROTOCOLS.md          # Wire-format specs & Android NIO/Keystore guide
├── server.ts                 # Local hub bridge, AES/HMAC framing & REST API
└── CONTRIBUTING.md           # PR requirements & security audit checklist`,
  },
} as const;

type DocTab = keyof typeof DOC_SECTIONS;

export const PluginsDocsView: React.FC<PluginsDocsViewProps> = ({
  hub,
  onUpdatePlugin,
  onRegisterPlugin,
}) => {
  const [showRegister, setShowRegister] = useState(false);
  const [name, setName] = useState('');
  const [packageId, setPackageId] = useState('');
  const [replacesApp, setReplacesApp] = useState('');
  const [protocolSpec, setProtocolSpec] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [activeDoc, setActiveDoc] = useState<DocTab>('android');
  const [copiedCode, setCopiedCode] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const res = await onRegisterPlugin({
      name,
      packageId,
      replacesApp,
      protocolSpec,
      author,
      description,
    });
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    setName('');
    setPackageId('');
    setReplacesApp('');
    setProtocolSpec('');
    setAuthor('');
    setDescription('');
    setShowRegister(false);
  };

  const copyDocCode = async () => {
    try {
      await navigator.clipboard.writeText(DOC_SECTIONS[activeDoc].code);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      // Clipboard unavailable in headless mode
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Modular Protocol Plugins & Open-Source Docs
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Replace separate proprietary vendor apps with sandboxed local protocol modules contributed on GitHub.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowRegister((prev) => !prev)}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {showRegister ? 'Close Form' : 'Register Custom Plugin'}
        </button>
      </div>

      {/* Community Plugin Registration Form */}
      {showRegister && (
        <form
          onSubmit={handleRegister}
          noValidate
          className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
        >
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Register Local Protocol Module
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Append a custom brand driver or automation plugin directly into your hub sandbox.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="plug-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Module Name
              </label>
              <input
                id="plug-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Meross Local MQTT Bridge"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label htmlFor="plug-pkg" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                GitHub Package ID
              </label>
              <input
                id="plug-pkg"
                type="text"
                value={packageId}
                onChange={(e) => setPackageId(e.target.value)}
                placeholder="@community/adapter-meross-lan"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label htmlFor="plug-app" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Replaces Proprietary App
              </label>
              <input
                id="plug-app"
                type="text"
                value={replacesApp}
                onChange={(e) => setReplacesApp(e.target.value)}
                placeholder="Meross App"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label htmlFor="plug-proto" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Local Protocol & Port
              </label>
              <input
                id="plug-proto"
                type="text"
                value={protocolSpec}
                onChange={(e) => setProtocolSpec(e.target.value)}
                placeholder="HTTP Local Port 80 / MD5 Signed JSON"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label htmlFor="plug-author" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Maintainer / Handle
              </label>
              <input
                id="plug-author"
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="github.com/open-home-dev"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label htmlFor="plug-desc" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Description
              </label>
              <input
                id="plug-desc"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Direct LAN control with zero cloud polling"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </div>

          {formError && (
            <p role="alert" className="mt-3 text-xs font-medium text-rose-700 dark:text-rose-400">
              {formError}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowRegister(false)}
              className="min-h-[40px] rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[40px] rounded-lg bg-teal-700 px-5 py-2 text-xs font-medium text-white hover:bg-teal-800"
            >
              Install Module
            </button>
          </div>
        </form>
      )}

      {/* Plugin Cards */}
      <section aria-label="Protocol plugin registry" className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {hub.plugins.map((plugin) => (
          <article
            key={plugin.id}
            className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Puzzle className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" aria-hidden="true" />
                    <span className="font-mono">{plugin.packageId}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">v{plugin.version}</span>
                  </div>
                  <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
                    {plugin.name}
                  </h3>
                </div>

                {plugin.installed ? (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={plugin.enabled}
                    aria-label={`Toggle plugin ${plugin.name}`}
                    onClick={() => onUpdatePlugin(plugin.id, { enabled: !plugin.enabled })}
                    className={`min-h-[38px] shrink-0 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      plugin.enabled
                        ? 'bg-teal-700 text-white hover:bg-teal-800'
                        : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {plugin.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onUpdatePlugin(plugin.id, { installed: true, enabled: true })}
                    className="min-h-[38px] shrink-0 rounded-lg border border-teal-700 px-3.5 py-1.5 text-xs font-medium text-teal-800 hover:bg-teal-50 whitespace-nowrap dark:border-teal-500 dark:text-teal-300 dark:hover:bg-teal-950/50"
                  >
                    Install Module
                  </button>
                )}
              </div>

              <p className="mt-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {plugin.description}
              </p>
            </div>

            <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <p>
                <span className="font-medium text-slate-700 dark:text-slate-300">Replaces:</span>{' '}
                {plugin.replacesApps.join(', ')}
              </p>
              <p className="font-mono text-[11px]">
                {plugin.protocols.join(' · ')} · {plugin.androidSupport}
              </p>
              <p className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
                Sandbox: {plugin.sandboxPermissions.join(', ')} ·{' '}
                {plugin.verifiedSignature ? 'Signed Core' : 'Community Unverified'}
              </p>
            </div>
          </article>
        ))}
      </section>

      {/* Open-Source Developer Documentation Hub */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <BookOpen className="h-5 w-5 text-teal-700 dark:text-teal-400" aria-hidden="true" />
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Open-Source GitHub Developer Documentation
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Apache-2.0 architecture blueprints for Android Kotlin, local reverse-engineering, and third-party modules.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {(
              [
                { id: 'android', label: 'Android Kotlin' },
                { id: 'pluginSdk', label: 'Plugin SDK' },
                { id: 'reverseEng', label: 'Protocol Spec' },
                { id: 'contributing', label: 'GitHub Repo' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveDoc(tab.id)}
                className={`min-h-[34px] rounded-md px-3 text-xs font-medium whitespace-nowrap ${
                  activeDoc === tab.id
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {DOC_SECTIONS[activeDoc].title}
              </h4>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {DOC_SECTIONS[activeDoc].summary}
              </p>
            </div>

            <button
              type="button"
              onClick={copyDocCode}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {copiedCode ? <Check className="h-3.5 w-3.5 text-teal-700" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedCode ? 'Copied' : 'Copy Snippet'}
            </button>
          </div>

          <pre className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100 dark:border-slate-800">
            <code>{DOC_SECTIONS[activeDoc].code}</code>
          </pre>
        </div>
      </section>
    </div>
  );
};
