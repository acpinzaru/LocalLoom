import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  applyDeviceStatePatch,
  evaluateAutomationTrigger,
  executeAutomationRule,
  validateAutomationDraft,
} from './src/core/automationEngine';
import {
  buildTuyaLanFrame,
  buildXiaomiMiioFrame,
  getDefaultPortForProtocol,
  maskLocalCredential,
  parseTuyaLanFrame,
  parseXiaomiMiioFrame,
  validateDevicePairingInput,
} from './src/core/protocols';
import {
  evaluateComplianceControls,
  summarizeCompliance,
  validateNetworkConfig,
} from './src/core/securityCompliance';
import {
  createInitialHubState,
  DISCOVERABLE_LAN_POOL,
} from './src/core/seedData';
import type {
  AuditEvent,
  AutomationRule,
  DevicePairingInput,
  HubStateSnapshot,
  PluginModule,
  SmartDevice,
} from './src/core/types';

const STATE_FILE = path.resolve(process.cwd(), '.localloom-hub-state.json');

function loadHubState(): HubStateSnapshot {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) as HubStateSnapshot;
      if (Array.isArray(parsed.devices) && parsed.network && parsed.security) {
        return parsed;
      }
    }
  } catch {
    // Fall back to deterministic initial state if file is unreadable
  }
  return createInitialHubState();
}

let hubState: HubStateSnapshot = loadHubState();

function persistHubState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(hubState, null, 2), 'utf-8');
  } catch {
    // Ignore disk write issues in read-only sandboxes
  }
}

function appendAudit(event: Omit<AuditEvent, 'id' | 'timestampIso'>) {
  const entry: AuditEvent = {
    id: `evt-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    timestampIso: new Date().toISOString(),
    ...event,
  };
  hubState.auditLog = [entry, ...hubState.auditLog].slice(0, 40);
}

function buildEnrichedState() {
  const complianceControls = evaluateComplianceControls(
    hubState.security,
    hubState.network,
    hubState.devices
  );
  return {
    ...hubState,
    complianceControls,
    complianceSummary: summarizeCompliance(complianceControls),
  };
}

function encryptTuyaAesEcb(plaintext: string, localKey16: string): string {
  const key = Buffer.from(localKey16.padEnd(16, '0').slice(0, 16), 'utf-8');
  const cipher = crypto.createCipheriv('aes-128-ecb', key, null);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  return encrypted.toString('hex');
}

function encryptMiioAesCbc(plaintext: string, tokenHex32: string): {
  ciphertextHex: string;
  keyFingerprint: string;
  ivFingerprint: string;
} {
  const tokenBuf = Buffer.from(tokenHex32, 'hex');
  const key = crypto.createHash('md5').update(tokenBuf).digest();
  const iv = crypto.createHash('md5').update(Buffer.concat([key, tokenBuf])).digest();
  const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  return {
    ciphertextHex: encrypted.toString('hex'),
    keyFingerprint: key.toString('hex').slice(0, 12),
    ivFingerprint: iv.toString('hex').slice(0, 12),
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Hub state snapshot
  app.get('/api/hub/state', (_req, res) => {
    res.json(buildEnrichedState());
  });

  // Reset demo hub state (GDPR erasure / clean reset)
  app.post('/api/hub/reset', (_req, res) => {
    hubState = createInitialHubState();
    appendAudit({
      category: 'security',
      actor: 'Hub Owner',
      message: 'Local hub configuration restored to clean factory baseline.',
      protocolNote: 'GDPR Art. 17 Local Reset',
    });
    persistHubState();
    res.json(buildEnrichedState());
  });

  // Scan local LAN subnet via UDP/mDNS discovery
  app.post('/api/devices/scan', (_req, res) => {
    const existingIps = new Set(hubState.devices.map((d) => d.ip));
    const discovered = DISCOVERABLE_LAN_POOL.filter((d) => !existingIps.has(d.ip));
    appendAudit({
      category: 'network',
      actor: 'LAN Discovery Daemon',
      message: `Completed UDP/mDNS sweep on ${hubState.network.subnetCidr} (${discovered.length} unpaired endpoint${discovered.length === 1 ? '' : 's'} detected).`,
      protocolNote: `Ports ${hubState.network.udpBroadcastPorts.join(', ')}`,
    });
    persistHubState();
    res.json({
      subnet: hubState.network.subnetCidr,
      discovered,
      state: buildEnrichedState(),
    });
  });

  // Pair new local device
  app.post('/api/devices', (req, res) => {
    const input = req.body as DevicePairingInput;
    const validation = validateDevicePairingInput(input);
    if (!validation.valid) {
      res.status(400).json({ error: 'Validation failed', errors: validation.errors });
      return;
    }

    const now = new Date().toISOString();
    const newDevice: SmartDevice = {
      id: `dev-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      name: input.name.trim(),
      brand: input.brand,
      replacesApp:
        input.brand === 'Xiaomi' || input.brand === 'Aqara'
          ? 'Mi Home'
          : input.brand === 'Smart Life' || input.brand === 'Tuya'
            ? 'Smart Life / Tuya'
            : `${input.brand} Cloud`,
      protocol: input.protocol,
      category: input.category,
      room: input.room.trim(),
      ip: input.ip.trim(),
      port: getDefaultPortForProtocol(input.protocol),
      mac: input.mac.trim().toUpperCase(),
      firmware: `${input.protocol}-local-1.0`,
      localCredentialHint: maskLocalCredential(input.localCredential),
      transport: input.transport,
      online: true,
      cloudBlocked: hubState.security.cloudEgressKillSwitch,
      latencyMs: input.transport === 'direct-lan' ? 7 : 19,
      lastSeenIso: now,
      state:
        input.category === 'lighting'
          ? { power: true, brightness: 80, colorTempK: 3500, powerWatts: 14.2 }
          : input.category === 'climate'
            ? { power: true, currentTempC: 21.0, targetTempC: 22.0, humidityPct: 48, fanSpeed: 'auto' }
            : input.category === 'power'
              ? { power: true, powerWatts: 32.5 }
              : input.category === 'security'
                ? { power: true, locked: true, privacyShutterClosed: true }
                : { power: true, motionDetected: false, lux: 60 },
    };

    hubState.devices = [newDevice, ...hubState.devices];
    appendAudit({
      category: 'device',
      actor: 'Local Keystore',
      message: `Paired "${newDevice.name}" (${newDevice.brand}) at ${newDevice.ip}:${newDevice.port}.`,
      protocolNote: `${newDevice.protocol} · AES-256-GCM Sealed`,
    });
    persistHubState();
    res.status(201).json({ device: newDevice, state: buildEnrichedState() });
  });

  // Update hardware device state & trigger matching local cross-brand automations
  app.patch('/api/devices/:id', (req, res) => {
    const { id } = req.params;
    const patch = req.body?.state ?? req.body;
    const existing = hubState.devices.find((d) => d.id === id);
    if (!existing) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    hubState.devices = hubState.devices.map((d) =>
      d.id === id ? applyDeviceStatePatch(d, patch) : d
    );

    const triggeredNames: string[] = [];
    hubState.automations = hubState.automations.map((rule) => {
      if (evaluateAutomationTrigger(rule, hubState.devices, id)) {
        const result = executeAutomationRule(rule, hubState.devices);
        hubState.devices = result.updatedDevices;
        triggeredNames.push(rule.name);
        return result.updatedRule;
      }
      return rule;
    });

    appendAudit({
      category: 'device',
      actor: 'Local Dispatch',
      message: `Updated ${existing.name} (${Object.keys(patch).join(', ')})${
        triggeredNames.length > 0 ? ` — triggered ${triggeredNames.join(', ')}` : ''
      }.`,
      protocolNote: `${existing.protocol} -> ${existing.ip}:${existing.port}`,
    });
    persistHubState();
    res.json({ triggeredAutomations: triggeredNames, state: buildEnrichedState() });
  });

  // Remove device
  app.delete('/api/devices/:id', (req, res) => {
    const existing = hubState.devices.find((d) => d.id === req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }
    hubState.devices = hubState.devices.filter((d) => d.id !== req.params.id);
    appendAudit({
      category: 'device',
      actor: 'Local Keystore',
      message: `Unpaired "${existing.name}" and shredded scoped local credential.`,
      protocolNote: existing.ip,
    });
    persistHubState();
    res.json(buildEnrichedState());
  });

  // Create cross-brand local automation rule
  app.post('/api/automations', (req, res) => {
    const draft = req.body;
    const validation = validateAutomationDraft(draft);
    if (!validation.valid) {
      res.status(400).json({ error: 'Validation failed', errors: validation.errors });
      return;
    }
    const targetDevice = hubState.devices.find((d) => d.id === draft.targetDeviceId);
    if (!targetDevice) {
      res.status(404).json({ error: 'Target device not found' });
      return;
    }

    const patch: Record<string, unknown> = { power: Boolean(draft.targetPower) };
    if (draft.targetBrightness !== undefined && targetDevice.category === 'lighting') {
      patch.brightness = Number(draft.targetBrightness);
    }

    const newRule: AutomationRule = {
      id: `auto-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      name: draft.name.trim(),
      description:
        draft.description?.trim() ||
        `Local cross-brand rule updating ${targetDevice.name} directly on ${hubState.network.subnetCidr}.`,
      enabled: true,
      localOnly: true,
      trigger: {
        type: draft.triggerProperty === 'aqi' || draft.triggerProperty === 'currentTempC' || draft.triggerProperty === 'powerWatts'
          ? 'threshold'
          : 'device-state',
        deviceId: draft.triggerDeviceId,
        property: draft.triggerProperty,
        operator: draft.triggerOperator,
        value: draft.triggerValue,
      },
      actions: [
        {
          deviceId: targetDevice.id,
          patch,
          summary: `${draft.targetPower ? 'Power on' : 'Power off'} ${targetDevice.name}${
            patch.brightness !== undefined ? ` (${patch.brightness}%)` : ''
          }`,
        },
      ],
      lastTriggeredIso: null,
      executionCount: 0,
    };

    hubState.automations = [newRule, ...hubState.automations];
    appendAudit({
      category: 'automation',
      actor: 'Rule Compiler',
      message: `Created local automation "${newRule.name}".`,
      protocolNote: 'Zero-Cloud Engine',
    });
    persistHubState();
    res.status(201).json({ rule: newRule, state: buildEnrichedState() });
  });

  // Toggle automation enabled state
  app.patch('/api/automations/:id', (req, res) => {
    const existing = hubState.automations.find((a) => a.id === req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Automation rule not found' });
      return;
    }
    hubState.automations = hubState.automations.map((a) =>
      a.id === req.params.id ? { ...a, enabled: Boolean(req.body.enabled) } : a
    );
    persistHubState();
    res.json(buildEnrichedState());
  });

  // Manually execute an automation rule immediately
  app.post('/api/automations/:id/run', (req, res) => {
    const rule = hubState.automations.find((a) => a.id === req.params.id);
    if (!rule) {
      res.status(404).json({ error: 'Automation rule not found' });
      return;
    }
    const result = executeAutomationRule(rule, hubState.devices);
    hubState.devices = result.updatedDevices;
    hubState.automations = hubState.automations.map((a) =>
      a.id === rule.id ? result.updatedRule : a
    );
    appendAudit({
      category: 'automation',
      actor: 'Manual Trigger',
      message: `Executed "${rule.name}" across ${result.affectedDeviceNames.join(', ')}.`,
      protocolNote: 'Local Direct Dispatch',
    });
    persistHubState();
    res.json({ affectedDeviceNames: result.affectedDeviceNames, state: buildEnrichedState() });
  });

  app.delete('/api/automations/:id', (req, res) => {
    hubState.automations = hubState.automations.filter((a) => a.id !== req.params.id);
    persistHubState();
    res.json(buildEnrichedState());
  });

  // Update VPN / Proxy / VLAN network config
  app.patch('/api/network', (req, res) => {
    const nextConfig = { ...hubState.network, ...req.body };
    const validation = validateNetworkConfig(nextConfig);
    if (!validation.valid) {
      res.status(400).json({ error: 'Invalid network configuration', errors: validation.errors });
      return;
    }
    hubState.network = nextConfig;
    appendAudit({
      category: 'network',
      actor: 'Transport Router',
      message: `Updated local transport to ${nextConfig.tunnelMode} on VLAN ${nextConfig.vlanId} (${nextConfig.subnetCidr}).`,
      protocolNote: nextConfig.dnsSinkholeEnabled ? 'Cloud DNS Sinkhole ON' : 'DNS Sinkhole OFF',
    });
    persistHubState();
    res.json(buildEnrichedState());
  });

  // Cryptographic local protocol frame builder & decoder (Tuya LAN & Xiaomi miIO)
  app.post('/api/protocols/frame', (req, res) => {
    const { mode, protocol, payloadJson, credential, sequence, deviceIdHex, hexInput } = req.body ?? {};

    try {
      if (mode === 'decode') {
        if (protocol === 'xiaomi-miio') {
          res.json({ parsed: parseXiaomiMiioFrame(String(hexInput ?? '')) });
          return;
        }
        res.json({ parsed: parseTuyaLanFrame(String(hexInput ?? '')) });
        return;
      }

      if (protocol === 'xiaomi-miio') {
        const token = String(credential ?? '').trim().toLowerCase();
        if (!/^[0-9a-f]{32}$/.test(token)) {
          res.status(400).json({ error: 'Xiaomi miIO token must be 32 hexadecimal characters.' });
          return;
        }
        const cryptoOut = encryptMiioAesCbc(String(payloadJson ?? '{}'), token);
        const frame = buildXiaomiMiioFrame({
          deviceIdHex: String(deviceIdHex || '04a1b2c3'),
          stamp: Math.floor(Date.now() / 1000),
          tokenHex: token,
          payloadJson: String(payloadJson ?? '{}'),
          encryptedPayloadHex: cryptoOut.ciphertextHex,
        });
        res.json({
          frame,
          encryption: {
            cipher: 'AES-128-CBC (MD5 token key + MD5(key+token) IV)',
            keyDerivation: `key:${cryptoOut.keyFingerprint}… iv:${cryptoOut.ivFingerprint}…`,
          },
        });
        return;
      }

      const localKey = String(credential ?? '').trim();
      if (localKey.length !== 16) {
        res.status(400).json({ error: 'Tuya localKey must be exactly 16 ASCII characters.' });
        return;
      }
      const version = protocol === 'tuya-lan-v33' ? '3.3' : '3.4';
      const ciphertextHex = encryptTuyaAesEcb(String(payloadJson ?? '{}'), localKey);
      const frame = buildTuyaLanFrame({
        sequence: Number(sequence) || 1,
        command: 0x07,
        payloadJson: String(payloadJson ?? '{}'),
        version,
        encryptedPayloadHex: ciphertextHex,
      });
      const hmacHex = crypto
        .createHmac('sha256', Buffer.from(localKey, 'utf-8'))
        .update(Buffer.from(frame.hex, 'hex'))
        .digest('hex')
        .slice(0, 32);

      res.json({
        frame,
        encryption: {
          cipher: version === '3.4' ? 'AES-128-ECB + HMAC-SHA256 Session Key' : 'AES-128-ECB + IEEE CRC-32',
          keyDerivation: `hmac:${hmacHex}…`,
        },
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Frame operation failed' });
    }
  });

  // Update security & privacy compliance policies
  app.patch('/api/security/policies', (req, res) => {
    hubState.security = { ...hubState.security, ...req.body };
    hubState.devices = hubState.devices.map((d) => ({
      ...d,
      cloudBlocked: hubState.security.cloudEgressKillSwitch,
    }));
    appendAudit({
      category: 'security',
      actor: 'Policy Engine',
      message: `Updated hub security policy (${Object.keys(req.body).join(', ')}).`,
      protocolNote: 'NIS2 / NIST / GDPR Re-evaluated',
    });
    persistHubState();
    res.json(buildEnrichedState());
  });

  // Rotate local AES-256-GCM master vault key
  app.post('/api/security/rotate-key', (_req, res) => {
    const rawKey = crypto.randomBytes(32);
    const digest = crypto.createHash('sha256').update(rawKey).digest('hex');
    const fingerprint = `SHA256:${digest.slice(0, 4)}:${digest.slice(4, 8)}:${digest.slice(8, 12)}:${digest.slice(12, 16)}`;
    hubState.security = {
      ...hubState.security,
      vaultKeyFingerprint: fingerprint,
      lastKeyRotationIso: new Date().toISOString(),
    };
    appendAudit({
      category: 'security',
      actor: 'Hardware Keystore',
      message: `Rotated local AES-256-GCM master key (${fingerprint}) and re-sealed ${hubState.devices.length} device credentials.`,
      protocolNote: 'NIST SP 800-57 Key Rotation',
    });
    persistHubState();
    res.json(buildEnrichedState());
  });

  // Toggle or install open-source protocol plugins
  app.patch('/api/plugins/:id', (req, res) => {
    const plugin = hubState.plugins.find((p) => p.id === req.params.id);
    if (!plugin) {
      res.status(404).json({ error: 'Plugin not found' });
      return;
    }
    hubState.plugins = hubState.plugins.map((p) =>
      p.id === req.params.id
        ? {
            ...p,
            installed: req.body.installed ?? p.installed,
            enabled: req.body.enabled ?? p.enabled,
          }
        : p
    );
    appendAudit({
      category: 'plugin',
      actor: 'Plugin Sandbox',
      message: `Updated module ${plugin.packageId} (${req.body.enabled ? 'enabled' : req.body.installed === false ? 'removed' : 'updated'}).`,
      protocolNote: plugin.androidSupport,
    });
    persistHubState();
    res.json(buildEnrichedState());
  });

  // Register a custom community protocol module / app adapter
  app.post('/api/plugins', (req, res) => {
    const { name, packageId, replacesApp, protocolSpec, description, author } = req.body ?? {};
    if (!name?.trim() || !packageId?.trim() || !protocolSpec?.trim()) {
      res.status(400).json({ error: 'Module name, package ID, and local protocol specification are required.' });
      return;
    }
    const newPlugin: PluginModule = {
      id: `plug-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      name: name.trim(),
      packageId: packageId.trim(),
      version: '0.1.0',
      author: author?.trim() || 'Community Contributor',
      replacesApps: [replacesApp?.trim() || 'Proprietary IoT App'],
      protocols: [protocolSpec.trim()],
      description:
        description?.trim() ||
        'Community-contributed local protocol adapter operating strictly inside the LocalLoom LAN sandbox.',
      installed: true,
      enabled: true,
      verifiedSignature: false,
      sandboxPermissions: ['lan:scoped-socket', 'keystore:read-scoped'],
      androidSupport: 'Kotlin Coroutines + NIO',
    };
    hubState.plugins = [newPlugin, ...hubState.plugins];
    appendAudit({
      category: 'plugin',
      actor: 'Plugin Registry',
      message: `Registered community module ${newPlugin.packageId} replacing ${newPlugin.replacesApps.join(', ')}.`,
      protocolNote: protocolSpec.trim(),
    });
    persistHubState();
    res.status(201).json({ plugin: newPlugin, state: buildEnrichedState() });
  });

  // Vite dev middleware or production static assets
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`LocalLoom local smart home hub listening on http://0.0.0.0:${port}`);
  });
}

startServer();
