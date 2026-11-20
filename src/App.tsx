import React, { useEffect, useState } from 'react';
import {
  Cpu,
  Moon,
  Network,
  Plus,
  Puzzle,
  ShieldCheck,
  Sun,
  WifiOff,
  Workflow,
  X,
} from 'lucide-react';
import { AutomationsView } from './components/AutomationsView';
import { DevicesView } from './components/DevicesView';
import { NetworkVpnView } from './components/NetworkVpnView';
import { PairDeviceModal } from './components/PairDeviceModal';
import { PluginsDocsView } from './components/PluginsDocsView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { SecurityPrivacyView } from './components/SecurityPrivacyView';
import { useHubState } from './hooks/useHubState';
import { useOnlineStatus } from './hooks/usePWAInstall';

type NavTab = 'devices' | 'automations' | 'network' | 'security' | 'plugins';

const NAV_ITEMS: {
  id: NavTab;
  label: string;
  mobileLabel: string;
  breadcrumb: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'devices', label: 'Devices', mobileLabel: 'Devices', breadcrumb: 'Unified Devices', icon: Cpu },
  { id: 'automations', label: 'Automations', mobileLabel: 'Rules', breadcrumb: 'Local Automations', icon: Workflow },
  { id: 'network', label: 'Network & VPN', mobileLabel: 'Network', breadcrumb: 'Network & VPN', icon: Network },
  { id: 'security', label: 'Security & Privacy', mobileLabel: 'Security', breadcrumb: 'Security & Privacy', icon: ShieldCheck },
  { id: 'plugins', label: 'Plugins & Docs', mobileLabel: 'Plugins', breadcrumb: 'Plugins & Open Source', icon: Puzzle },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('devices');
  const [pairModalOpen, setPairModalOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const isOnline = useOnlineStatus();
  const {
    hub,
    loading,
    error,
    statusMessage,
    clearStatus,
    refetch,
    updateDeviceState,
    scanLocalLan,
    pairDevice,
    removeDevice,
    createAutomation,
    toggleAutomation,
    runAutomation,
    deleteAutomation,
    updateNetwork,
    updateSecurityPolicies,
    rotateVaultKey,
    resetHubBaseline,
    updatePlugin,
    registerPlugin,
  } = useHubState();

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  const currentNav = NAV_ITEMS.find((item) => item.id === activeTab) ?? NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Desktop Left Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col justify-between border-r border-slate-200 bg-white lg:flex dark:border-slate-800 dark:bg-slate-900">
        <div>
          <div className="flex h-16 items-center border-b border-slate-200 px-6 dark:border-slate-800">
            <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap dark:text-slate-100">
              LocalLoom
            </span>
          </div>

          <nav aria-label="Primary hub navigation" className="space-y-1 p-3">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-teal-50 text-teal-900 dark:bg-teal-950/60 dark:text-teal-200'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isActive ? 'text-teal-700 dark:text-teal-400' : 'text-slate-400'
                    }`}
                    aria-hidden="true"
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3 border-t border-slate-200 p-4 dark:border-slate-800">
          <PWAInstallButton />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Zero-Cloud · Apache-2.0
            </span>
            <button
              type="button"
              onClick={() => setDarkMode((prev) => !prev)}
              aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="lg:pl-64">
        {/* Top Bar (Desktop breadcrumb + primary CTA / Mobile compact 56px bar) */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur-md sm:px-6 lg:h-16 lg:px-8 dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className="font-display font-bold tracking-tight text-slate-900 whitespace-nowrap lg:hidden dark:text-slate-100">
              LocalLoom
            </span>
            <span className="text-slate-300 lg:hidden dark:text-slate-700" aria-hidden="true">
              /
            </span>
            <h1 className="truncate font-display text-sm font-semibold text-slate-800 lg:text-base dark:text-slate-100">
              <span className="sm:hidden">{currentNav.mobileLabel}</span>
              <span className="hidden sm:inline">{currentNav.breadcrumb}</span>
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setDarkMode((prev) => !prev)}
              aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 lg:hidden dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={() => setPairModalOpen(true)}
              aria-label="Scan and pair local device"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-teal-800 whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span className="sm:hidden">Pair</span>
              <span className="hidden sm:inline">Scan &amp; Pair</span>
            </button>
          </div>
        </header>

        {/* Offline Banner (only rendered when browser loses connectivity) */}
        {!isOnline && (
          <div
            role="status"
            className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900 sm:px-6 lg:px-8 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-200"
          >
            <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Offline Mode — Local cached interface active. Reconnect to your LAN or WireGuard VPN to dispatch hardware packets.</span>
          </div>
        )}

        {/* Transient Hub Feedback Banner */}
        {statusMessage && (
          <div
            role="status"
            aria-live="polite"
            className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-lg border border-teal-200 bg-teal-50 px-4 py-2.5 text-xs font-medium text-teal-900 sm:mx-6 lg:mx-8 dark:border-teal-900/60 dark:bg-teal-950/50 dark:text-teal-200"
          >
            <span>{statusMessage}</span>
            <button
              type="button"
              onClick={clearStatus}
              aria-label="Dismiss status message"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded hover:bg-teal-100 dark:hover:bg-teal-900/60"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Main Viewport */}
        <main className="mx-auto max-w-7xl px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8 lg:pb-12">
          {loading ? (
            <div className="space-y-4" aria-busy="true" aria-label="Loading local smart home hub">
              <div className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
                <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
                <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
              </div>
            </div>
          ) : error || !hub ? (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-white p-8 text-center dark:border-rose-900/50 dark:bg-slate-900"
            >
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Local Hub Bridge Unavailable
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {error ?? 'Could not read local hub state.'}
              </p>
              <button
                type="button"
                onClick={refetch}
                className="mt-4 min-h-[42px] rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800"
              >
                Retry Connection
              </button>
            </div>
          ) : (
            <>
              {activeTab === 'devices' && (
                <DevicesView
                  hub={hub}
                  onUpdateDeviceState={updateDeviceState}
                  onRemoveDevice={removeDevice}
                  onOpenPairModal={() => setPairModalOpen(true)}
                />
              )}
              {activeTab === 'automations' && (
                <AutomationsView
                  hub={hub}
                  onCreate={createAutomation}
                  onToggle={toggleAutomation}
                  onRun={runAutomation}
                  onDelete={deleteAutomation}
                />
              )}
              {activeTab === 'network' && (
                <NetworkVpnView hub={hub} onUpdateNetwork={updateNetwork} />
              )}
              {activeTab === 'security' && (
                <SecurityPrivacyView
                  hub={hub}
                  onUpdatePolicies={updateSecurityPolicies}
                  onRotateKey={rotateVaultKey}
                  onResetBaseline={resetHubBaseline}
                />
              )}
              {activeTab === 'plugins' && (
                <PluginsDocsView
                  hub={hub}
                  onUpdatePlugin={updatePlugin}
                  onRegisterPlugin={registerPlugin}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Mobile Fixed Bottom Thumb Navigation (64px height -> combined 120px <= 14.2% of 844px) */}
      <nav
        aria-label="Mobile hub navigation"
        className="fixed right-0 bottom-0 left-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur-md pb-safe lg:hidden dark:border-slate-800 dark:bg-slate-900/95"
      >
        <div className="grid h-16 grid-cols-5 items-center">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-[44px] flex-col items-center justify-center gap-1 px-1 transition-colors ${
                  isActive
                    ? 'text-teal-700 dark:text-teal-400'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="text-[11px] font-medium leading-none">{item.mobileLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Pair & Discover Local Device Modal / Mobile Sheet */}
      <PairDeviceModal
        open={pairModalOpen}
        onClose={() => setPairModalOpen(false)}
        onScanLan={scanLocalLan}
        onPair={pairDevice}
      />
    </div>
  );
}
