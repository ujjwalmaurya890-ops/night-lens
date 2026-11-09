import { handleCommand, handleInstalled, handleMessage, handleStartup, updateBadge } from './handlers';
import { isExportSettingsMessage, isGetStorageMessage } from '../shared/messages';
import { subscribeToSettings } from '../shared/storage';

const report = (error: unknown): void => {
  console.warn('[NightLens] Background task failed.', error);
};
chrome.commands.onCommand.addListener((command) => { void handleCommand(command).catch(report); });
chrome.runtime.onInstalled.addListener(() => { void handleInstalled().catch(report); });
chrome.runtime.onStartup.addListener(() => { void handleStartup().catch(report); });
subscribeToSettings((s) => { void updateBadge(s); });

// Only the two request types the extension uses are answered; anything else is ignored so a
// malformed or unexpected message can never trigger work in the service worker.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isGetStorageMessage(message) && !isExportSettingsMessage(message)) return false;
  void handleMessage(message, sender).then(sendResponse).catch(report);
  return true;
});
