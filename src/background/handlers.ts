import { getBrowserApi } from '../adapters/browser';
import { STORAGE_KEY } from '../shared/defaults';
import { isExportSettingsMessage, isGetStorageMessage } from '../shared/messages';
import { ensureSettings, exportSettings, loadSettings, updateSettings } from '../shared/storage';
import type { Settings } from '../shared/types';

export const TOGGLE_COMMAND = 'toggle-nightlens';
const BADGE_COLOR = '#5f6368';
const BADGE_ACTIVE_COLOR = '#7ab7ff';

/**
 * Repaints the toolbar button. Everything here is cosmetic and uses the safe action adapter, so a
 * browser without a toolbar badge (or with the button unpinned) sees no error.
 */
export async function updateBadge(settings: Settings): Promise<void> {
  const { action } = getBrowserApi();
  await action.setBadgeText(settings.enabled ? '' : 'OFF');
  await action.setBadgeBackgroundColor(settings.enabled ? BADGE_ACTIVE_COLOR : BADGE_COLOR);
  await action.setTitle(settings.enabled ? `NightLens is on (${settings.theme})` : 'NightLens is off');
}

export async function handleCommand(command: string): Promise<void> {
  if (command !== TOGGLE_COMMAND) return;
  const next = await updateSettings((s) => ({ ...s, enabled: !s.enabled }));
  await updateBadge(next);
}

export async function handleInstalled(): Promise<void> {
  // Read-then-write is atomic here: anything written by another surface in between is kept.
  await updateBadge(await ensureSettings());
}

export async function handleStartup(): Promise<void> {
  await updateBadge(await loadSettings());
}

/**
 * Only the two request types the extension actually uses are answered, and only for messages
 * that carry this extension's own id. Replies are sanitised settings, never raw storage, so a
 * corrupted or hand-edited value cannot be handed to a consumer unchecked.
 */
export async function handleMessage(
  message: unknown,
  sender: { id?: string },
): Promise<unknown> {
  const ownId = getBrowserApi().runtime.id();
  // Without a live extension id there is no trustworthy sender to compare against.
  if (ownId === null || sender?.id !== ownId) return null;
  if (isGetStorageMessage(message)) {
    return { [STORAGE_KEY]: await loadSettings() };
  }
  if (isExportSettingsMessage(message)) {
    return { data: exportSettings(await loadSettings()) };
  }
  return null;
}
