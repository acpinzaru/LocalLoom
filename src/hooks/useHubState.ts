import { useCallback, useEffect, useState } from 'react';
import type {
  ComplianceControl,
  DevicePairingInput,
  DiscoveredLanDevice,
  HubStateSnapshot,
  NetworkConfig,
  SecurityPolicyState,
  SmartDeviceState,
} from '../core/types';
import type { AutomationDraftInput } from '../core/automationEngine';

export interface EnrichedHubState extends HubStateSnapshot {
  complianceControls: ComplianceControl[];
  complianceSummary: {
    total: number;
    compliant: number;
    attention: number;
    nonCompliant: number;
  };
}

export function useHubState() {
  const [hub, setHub] = useState<EnrichedHubState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const notify = useCallback((msg: string) => {
    setStatusMessage(msg);
  }, []);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = window.setTimeout(() => setStatusMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [statusMessage]);

  const fetchState = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/hub/state');
      if (!res.ok) throw new Error(`Hub API returned ${res.status}`);
      const data = (await res.json()) as EnrichedHubState;
      setHub(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach LocalLoom local hub API.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const updateDeviceState = useCallback(
    async (deviceId: string, patch: Partial<SmartDeviceState>) => {
      const res = await fetch(`/api/devices/${deviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: patch }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to dispatch local device command');
      }
      const data = await res.json();
      setHub(data.state);
      if (data.triggeredAutomations?.length > 0) {
        notify(`Triggered local automation: ${data.triggeredAutomations.join(', ')}`);
      }
    },
    [notify]
  );

  const scanLocalLan = useCallback(async (): Promise<DiscoveredLanDevice[]> => {
    const res = await fetch('/api/devices/scan', { method: 'POST' });
    if (!res.ok) throw new Error('Local LAN scan failed');
    const data = await res.json();
    setHub(data.state);
    notify(`Scanned ${data.subnet}: found ${data.discovered.length} unpaired device(s).`);
    return data.discovered as DiscoveredLanDevice[];
  }, [notify]);

  const pairDevice = useCallback(
    async (input: DevicePairingInput) => {
      const res = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false as const, errors: data.errors as Record<string, string> | undefined, error: data.error as string };
      }
      setHub(data.state);
      notify(`Paired ${data.device.name} on ${data.device.ip}:${data.device.port}.`);
      return { ok: true as const };
    },
    [notify]
  );

  const removeDevice = useCallback(
    async (deviceId: string, deviceName: string) => {
      const res = await fetch(`/api/devices/${deviceId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Unable to unpair device');
      const data = (await res.json()) as EnrichedHubState;
      setHub(data);
      notify(`Unpaired ${deviceName} and cleared local key.`);
    },
    [notify]
  );

  const createAutomation = useCallback(
    async (draft: AutomationDraftInput) => {
      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false as const, errors: data.errors as Record<string, string> | undefined, error: data.error as string };
      }
      setHub(data.state);
      notify(`Saved local rule "${data.rule.name}".`);
      return { ok: true as const };
    },
    [notify]
  );

  const toggleAutomation = useCallback(async (ruleId: string, enabled: boolean) => {
    const res = await fetch(`/api/automations/${ruleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) throw new Error('Unable to update rule');
    setHub(await res.json());
  }, []);

  const runAutomation = useCallback(
    async (ruleId: string, ruleName: string) => {
      const res = await fetch(`/api/automations/${ruleId}/run`, { method: 'POST' });
      if (!res.ok) throw new Error('Unable to execute automation');
      const data = await res.json();
      setHub(data.state);
      notify(`Executed "${ruleName}" (${data.affectedDeviceNames.join(', ')}).`);
    },
    [notify]
  );

  const deleteAutomation = useCallback(
    async (ruleId: string, ruleName: string) => {
      const res = await fetch(`/api/automations/${ruleId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Unable to delete automation');
      setHub(await res.json());
      notify(`Deleted rule "${ruleName}".`);
    },
    [notify]
  );

  const updateNetwork = useCallback(
    async (patch: Partial<NetworkConfig>) => {
      const res = await fetch('/api/network', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false as const, errors: data.errors as Record<string, string> | undefined, error: data.error as string };
      }
      setHub(data);
      notify('Saved local network and tunnel configuration.');
      return { ok: true as const };
    },
    [notify]
  );

  const updateSecurityPolicies = useCallback(
    async (patch: Partial<SecurityPolicyState>) => {
      const res = await fetch('/api/security/policies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('Unable to update security policy');
      setHub(await res.json());
    },
    []
  );

  const rotateVaultKey = useCallback(async () => {
    const res = await fetch('/api/security/rotate-key', { method: 'POST' });
    if (!res.ok) throw new Error('Key rotation failed');
    const data = (await res.json()) as EnrichedHubState;
    setHub(data);
    notify(`Rotated AES-256-GCM vault key to ${data.security.vaultKeyFingerprint}.`);
  }, [notify]);

  const resetHubBaseline = useCallback(async () => {
    const res = await fetch('/api/hub/reset', { method: 'POST' });
    if (!res.ok) throw new Error('Hub reset failed');
    setHub(await res.json());
    notify('Restored LocalLoom hub to clean baseline.');
  }, [notify]);

  const updatePlugin = useCallback(
    async (pluginId: string, patch: { installed?: boolean; enabled?: boolean }) => {
      const res = await fetch(`/api/plugins/${pluginId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('Unable to update plugin');
      setHub(await res.json());
    },
    []
  );

  const registerPlugin = useCallback(
    async (payload: {
      name: string;
      packageId: string;
      replacesApp: string;
      protocolSpec: string;
      description: string;
      author: string;
    }) => {
      const res = await fetch('/api/plugins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false as const, error: data.error as string };
      }
      setHub(data.state);
      notify(`Registered community module ${data.plugin.packageId}.`);
      return { ok: true as const };
    },
    [notify]
  );

  return {
    hub,
    loading,
    error,
    statusMessage,
    clearStatus: () => setStatusMessage(null),
    refetch: fetchState,
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
  };
}
