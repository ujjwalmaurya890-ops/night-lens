import { getBrowserApi } from '../adapters/browser';
import { handleCommand, handleInstalled, handleMessage, handleStartup, updateBadge } from './handlers';
import { isExportSettingsMessage, isGetStorageMessage } from '../shared/messages';
import { subscribeToSettings } from '../shared/storage';

const report = (error: unknown): void => {
  console.warn('[NightLens] Background task failed.', error);
};

/**
 * Background entry point.
 *
 * The same file runs as a Chromium MV3 service worker and as a Firefox/Safari non-persistent
 * event page. It therefore touches no DOM state, keeps no in-memory state that must survive, and
 * registers every listener synchronously at the top level (required for MV3 event delivery).
 */
export function startBackground(): void {
  const api = getBrowserApi();

  api.commands.onCommand((command) => {
    void handleCommand(command).catch(report);
  });
  api.runtime.onInstalled(() => {
    void handleInstalled().catch(report);
  });
  api.runtime.onStartup(() => {
    void handleStartup().catch(report);
  });
  subscribeToSettings((s) => {
    void updateBadge(s);
  });

  // Only the two request types the extension uses are answered; anything else is ignored so a
  // malformed or unexpected message can never trigger work in the background context.
  api.runtime.onMessage((message, sender, sendResponse) => {
    if (!isGetStorageMessage(message) && !isExportSettingsMessage(message)) return false;
    void handleMessage(message, sender).then(sendResponse).catch(report);
    return true;
  });
}

startBackground();
