import { handleCommand, handleInstalled, handleMessage, handleStartup, updateBadge } from './handlers';
import { subscribeToSettings } from '../shared/storage';

const report = (error: unknown): void => {
  console.warn('[NightLens] Background task failed.', error);
};
chrome.commands.onCommand.addListener((command) => { void handleCommand(command).catch(report); });
chrome.runtime.onInstalled.addListener(() => { void handleInstalled().catch(report); });
chrome.runtime.onStartup.addListener(() => { void handleStartup().catch(report); });
subscribeToSettings((s) => { void updateBadge(s); });

// Message handling for popup/options
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (typeof message === 'object' && message !== null) {
    const m = message as Record<string, unknown>;
    if (m.type === 'nightlens/get-storage' || m.type === 'nightlens/export-settings') {
      void handleMessage(message, sender).then(sendResponse).catch(report);
      return true;
    }
  }
  return false;
});
