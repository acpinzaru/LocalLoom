import type { AutomationRule, SmartDevice, SmartDeviceState } from './types';

export function evaluateAutomationTrigger(
  rule: AutomationRule,
  devices: SmartDevice[],
  changedDeviceId?: string
): boolean {
  if (!rule.enabled) return false;
  const { trigger } = rule;

  if (trigger.type === 'schedule') {
    return false;
  }

  if (!trigger.deviceId || !trigger.property) return false;
  if (changedDeviceId && trigger.deviceId !== changedDeviceId) return false;

  const sourceDevice = devices.find((d) => d.id === trigger.deviceId);
  if (!sourceDevice || !sourceDevice.online) return false;

  const actualValue = sourceDevice.state[trigger.property];
  if (actualValue === undefined) return false;

  switch (trigger.operator) {
    case 'eq':
      return actualValue === trigger.value;
    case 'gt':
      return typeof actualValue === 'number' && typeof trigger.value === 'number' && actualValue > trigger.value;
    case 'lt':
      return typeof actualValue === 'number' && typeof trigger.value === 'number' && actualValue < trigger.value;
    default:
      return false;
  }
}

export interface AutomationExecutionResult {
  updatedDevices: SmartDevice[];
  updatedRule: AutomationRule;
  affectedDeviceNames: string[];
}

export function applyDeviceStatePatch(
  device: SmartDevice,
  patch: Partial<SmartDeviceState>
): SmartDevice {
  const nextState: SmartDeviceState = { ...device.state, ...patch };

  // Keep realistic power wattage aligned with power & brightness states
  if (patch.power === false && nextState.powerWatts !== undefined) {
    nextState.powerWatts = Number((0.4).toFixed(1));
  } else if (patch.power === true && nextState.powerWatts !== undefined && nextState.powerWatts < 1) {
    nextState.powerWatts = device.category === 'lighting' ? 12.6 : 48.0;
  }
  if (patch.brightness !== undefined && device.category === 'lighting') {
    nextState.power = patch.brightness > 0;
    if (nextState.powerWatts !== undefined) {
      nextState.powerWatts = Number((0.4 + (patch.brightness / 100) * 18.0).toFixed(1));
    }
  }

  return {
    ...device,
    lastSeenIso: new Date().toISOString(),
    state: nextState,
  };
}

export function executeAutomationRule(
  rule: AutomationRule,
  devices: SmartDevice[],
  nowIso: string = new Date().toISOString()
): AutomationExecutionResult {
  const affectedDeviceNames: string[] = [];
  const updatedDevices = devices.map((device) => {
    const matchingActions = rule.actions.filter((action) => action.deviceId === device.id);
    if (matchingActions.length === 0) return device;

    affectedDeviceNames.push(device.name);
    let next = device;
    for (const action of matchingActions) {
      next = applyDeviceStatePatch(next, action.patch);
    }
    return next;
  });

  const updatedRule: AutomationRule = {
    ...rule,
    lastTriggeredIso: nowIso,
    executionCount: rule.executionCount + 1,
  };

  return {
    updatedDevices,
    updatedRule,
    affectedDeviceNames,
  };
}

export interface AutomationDraftInput {
  name: string;
  description: string;
  triggerDeviceId: string;
  triggerProperty: 'power' | 'motionDetected' | 'currentTempC' | 'aqi' | 'powerWatts';
  triggerOperator: 'eq' | 'gt' | 'lt';
  triggerValue: boolean | number;
  targetDeviceId: string;
  targetPower: boolean;
  targetBrightness?: number;
}

export function validateAutomationDraft(draft: AutomationDraftInput): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};
  if (!draft.name.trim() || draft.name.trim().length < 3) {
    errors.name = 'Rule name must be at least 3 characters.';
  }
  if (!draft.triggerDeviceId) {
    errors.triggerDeviceId = 'Select a source trigger device.';
  }
  if (!draft.targetDeviceId) {
    errors.targetDeviceId = 'Select a target device to control.';
  }
  if (draft.triggerDeviceId && draft.triggerDeviceId === draft.targetDeviceId) {
    errors.targetDeviceId = 'Select a different target device to avoid local feedback loops.';
  }
  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
