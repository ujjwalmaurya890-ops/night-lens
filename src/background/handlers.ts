import { STORAGE_KEY } from '../shared/defaults';
import { loadSettings, resetSettings, updateSettings } from '../shared/storage';
import type { Settings } from '../shared/types';

export const TOGGLE_COMMAND = 'toggle-nightlens';
const BADGE_COLOR = '#5f6368';
const BADGE_ACTIVE_COLOR = '#7ab7ff';

export async function updateBadge(settings: Settings): Promise<void> {
  try {
    await chrome.action.setBadgeText({ text: settings.enabled ? '' : 'OFF' });
    await chrome.action.setBadgeBackgroundColor({ color: settings.enabled ? BADGE_ACTIVE_COLOR : BADGE_COLOR });
    // Update title for accessibility
    await chrome.action.setTitle({ title: settings.enabled ? `NightLens is on (${settings.theme})` : 'NightLens is off' });
  } catch { /* ignore if no active tab */ }
}

export async function handleCommand(command: string): Promise<void> {
  if (command !== TOGGLE_COMMAND) return;
  const next = await updateSettings((s) => ({ ...s, enabled: !s.enabled }));
  await updateBadge(next);
}

export async function handleInstalled(): Promise<void> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const settings = stored[STORAGE_KEY] === undefined ? await resetSettings() : await loadSettings();
  await updateBadge(settings);
  // Set up alarm for schedule checking
  try {
    await chrome.alarms.create('nightlens-schedule', { periodInMinutes: 1 });
  } catch { /* alarms may not be available in test */ }
}

export async function handleStartup(): Promise<void> {
  await updateBadge(await loadSettings());
  try {
    await chrome.alarms.create('nightlens-schedule', { periodInMinutes: 1 });
  } catch { /* ignore */ }
}

export async function handleAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
  if (alarm.name !== 'nightlens-schedule') return;
  // Badge update based on schedule – if scheduled off, show indicator
  const settings = await loadSettings();
  if (settings.schedule.enabled) {
    await updateBadge(settings);
  }
}

export async function handleMessage(message: unknown, _sender: chrome.runtime.MessageSender): Promise<unknown> {
  if (typeof message !== 'object' || message === null) return null;
  const m = message as Record<string, unknown>;
  if (m.type === 'nightlens/get-storage') {
    return await chrome.storage.local.get(STORAGE_KEY);
  }
  if (m.type === 'nightlens/export-settings') {
    const settings = await loadSettings();
    return { data: JSON.stringify(settings, null, 2) };
  }
  return null;
}
