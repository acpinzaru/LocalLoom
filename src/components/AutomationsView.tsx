import React, { useState } from 'react';
import { ArrowRight, Play, Plus, Trash2 } from 'lucide-react';
import type { EnrichedHubState } from '../hooks/useHubState';
import { validateAutomationDraft, type AutomationDraftInput } from '../core/automationEngine';

interface AutomationsViewProps {
  hub: EnrichedHubState;
  onCreate: (
    draft: AutomationDraftInput
  ) => Promise<{ ok: true } | { ok: false; errors?: Record<string, string>; error?: string }>;
  onToggle: (ruleId: string, enabled: boolean) => Promise<void>;
  onRun: (ruleId: string, ruleName: string) => Promise<void>;
  onDelete: (ruleId: string, ruleName: string) => Promise<void>;
}

export const AutomationsView: React.FC<AutomationsViewProps> = ({
  hub,
  onCreate,
  onToggle,
  onRun,
  onDelete,
}) => {
  const [showBuilder, setShowBuilder] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerDeviceId, setTriggerDeviceId] = useState(hub.devices[3]?.id ?? hub.devices[0]?.id ?? '');
  const [triggerProperty, setTriggerProperty] = useState<AutomationDraftInput['triggerProperty']>('motionDetected');
  const [triggerOperator, setTriggerOperator] = useState<AutomationDraftInput['triggerOperator']>('eq');
  const [triggerValue, setTriggerValue] = useState<string>('true');
  const [targetDeviceId, setTargetDeviceId] = useState(hub.devices[0]?.id ?? '');
  const [targetPower, setTargetPower] = useState(true);
  const [targetBrightness, setTargetBrightness] = useState(75);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [runningId, setRunningId] = useState<string | null>(null);

  const deviceById = new Map(hub.devices.map((d) => [d.id, d]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedVal: boolean | number =
      triggerProperty === 'power' || triggerProperty === 'motionDetected'
        ? triggerValue === 'true'
        : Number(triggerValue);

    const targetDev = deviceById.get(targetDeviceId);
    const payload: AutomationDraftInput = {
      name,
      description,
      triggerDeviceId,
      triggerProperty,
      triggerOperator,
      triggerValue: parsedVal,
      targetDeviceId,
      targetPower,
      targetBrightness: targetDev?.category === 'lighting' ? targetBrightness : undefined,
    };

    const localValidation = validateAutomationDraft(payload);
    if (!localValidation.valid) {
      setErrors(localValidation.errors);
      return;
    }

    const res = await onCreate(payload);

    if (!res.ok) {
      setErrors(res.errors ?? { name: res.error ?? 'Check rule configuration.' });
      return;
    }

    setName('');
    setDescription('');
    setErrors({});
    setShowBuilder(false);
  };

  const handleRun = async (id: string, ruleName: string) => {
    setRunningId(id);
    try {
      await onRun(id, ruleName);
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Cross-Brand Local Automations
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Execute triggers between Xiaomi, Tuya, Smart Life, Shelly, and Matter directly on your local network.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowBuilder((prev) => !prev)}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {showBuilder ? 'Close Rule Builder' : 'New Local Rule'}
        </button>
      </div>

      {showBuilder && (
        <form
          onSubmit={handleSubmit}
          noValidate
          className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
        >
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Create Cross-Brand Rule
          </h3>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="rule-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Rule Name
              </label>
              <input
                id="rule-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Studio Plug Off -> Xiaomi Lamp Off"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              {errors.name && <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">{errors.name}</p>}
            </div>

            <div>
              <label htmlFor="rule-desc" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Notes (Optional)
              </label>
              <input
                id="rule-desc"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Runs offline on VLAN 10 without vendor servers"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 md:grid-cols-2 dark:border-slate-800">
            {/* Trigger Column */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">When (Source Device)</p>
              <div>
                <label htmlFor="trigger-device" className="block text-xs text-slate-500 dark:text-slate-400">
                  Source Hardware
                </label>
                <select
                  id="trigger-device"
                  value={triggerDeviceId}
                  onChange={(e) => setTriggerDeviceId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  {hub.devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.brand})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label htmlFor="trigger-prop" className="block text-xs text-slate-500 dark:text-slate-400">
                    Signal
                  </label>
                  <select
                    id="trigger-prop"
                    value={triggerProperty}
                    onChange={(e) => {
                      const next = e.target.value as AutomationDraftInput['triggerProperty'];
                      setTriggerProperty(next);
                      setTriggerValue(next === 'power' || next === 'motionDetected' ? 'true' : '30');
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="motionDetected">Motion</option>
                    <option value="power">Power</option>
                    <option value="aqi">AQI</option>
                    <option value="currentTempC">Temp °C</option>
                    <option value="powerWatts">Watts</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="trigger-op" className="block text-xs text-slate-500 dark:text-slate-400">
                    Condition
                  </label>
                  <select
                    id="trigger-op"
                    value={triggerOperator}
                    onChange={(e) => setTriggerOperator(e.target.value as AutomationDraftInput['triggerOperator'])}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="eq">Equals</option>
                    <option value="gt">Greater than</option>
                    <option value="lt">Less than</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="trigger-val" className="block text-xs text-slate-500 dark:text-slate-400">
                    Value
                  </label>
                  {triggerProperty === 'power' || triggerProperty === 'motionDetected' ? (
                    <select
                      id="trigger-val"
                      value={triggerValue}
                      onChange={(e) => setTriggerValue(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    >
                      <option value="true">Active / On</option>
                      <option value="false">Clear / Off</option>
                    </select>
                  ) : (
                    <input
                      id="trigger-val"
                      type="number"
                      value={triggerValue}
                      onChange={(e) => setTriggerValue(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Action Column */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Then (Target Action)</p>
              <div>
                <label htmlFor="target-device" className="block text-xs text-slate-500 dark:text-slate-400">
                  Target Hardware
                </label>
                <select
                  id="target-device"
                  value={targetDeviceId}
                  onChange={(e) => setTargetDeviceId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  {hub.devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.brand})
                    </option>
                  ))}
                </select>
                {errors.targetDeviceId && (
                  <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">{errors.targetDeviceId}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="target-power" className="block text-xs text-slate-500 dark:text-slate-400">
                    Power Command
                  </label>
                  <select
                    id="target-power"
                    value={targetPower ? 'on' : 'off'}
                    onChange={(e) => setTargetPower(e.target.value === 'on')}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="on">Turn On</option>
                    <option value="off">Turn Off</option>
                  </select>
                </div>

                {deviceById.get(targetDeviceId)?.category === 'lighting' && targetPower && (
                  <div>
                    <label htmlFor="target-bright" className="block text-xs text-slate-500 dark:text-slate-400">
                      Brightness ({targetBrightness}%)
                    </label>
                    <input
                      id="target-bright"
                      type="range"
                      min={10}
                      max={100}
                      step={5}
                      value={targetBrightness}
                      onChange={(e) => setTargetBrightness(Number(e.target.value))}
                      className="mt-3 w-full accent-teal-700"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowBuilder(false)}
              className="min-h-[40px] rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[40px] rounded-lg bg-teal-700 px-5 py-2 text-xs font-medium text-white hover:bg-teal-800"
            >
              Save Local Automation
            </button>
          </div>
        </form>
      )}

      {/* Automation Rule List */}
      <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {hub.automations.map((rule) => {
          const sourceDevice = rule.trigger.deviceId ? deviceById.get(rule.trigger.deviceId) : undefined;
          return (
            <div key={rule.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className={rule.enabled ? 'font-medium text-emerald-700 dark:text-emerald-400' : 'font-medium text-slate-500'}>
                    {rule.enabled ? 'Enabled' : 'Paused'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Local Hub Execution</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{rule.executionCount} runs</span>
                </div>

                <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
                  {rule.name}
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{rule.description}</p>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <span className="font-medium">
                    {rule.trigger.type === 'schedule'
                      ? rule.trigger.cronLabel
                      : `${sourceDevice?.name ?? 'Sensor'} (${rule.trigger.property} ${rule.trigger.operator} ${String(rule.trigger.value)})`}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                  <span>{rule.actions.map((a) => a.summary).join(' · ')}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleRun(rule.id, rule.name)}
                  disabled={runningId === rule.id}
                  aria-label={`Run automation ${rule.name} now`}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                >
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  {runningId === rule.id ? 'Dispatching…' : 'Run Now'}
                </button>

                <button
                  type="button"
                  role="switch"
                  aria-checked={rule.enabled}
                  aria-label={`Toggle automation ${rule.name}`}
                  onClick={() => onToggle(rule.id, !rule.enabled)}
                  className={`min-h-[40px] rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                    rule.enabled
                      ? 'bg-teal-700 text-white hover:bg-teal-800'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                  }`}
                >
                  {rule.enabled ? 'Active' : 'Enable'}
                </button>

                <button
                  type="button"
                  aria-label={`Delete automation ${rule.name}`}
                  onClick={() => onDelete(rule.id, rule.name)}
                  className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:border-slate-700 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
