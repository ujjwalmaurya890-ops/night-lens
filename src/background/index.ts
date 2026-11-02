import { handleAlarm, handleCommand, handleInstalled, handleStartup, updateBadge } from './handlers';
import { subscribeToSettings } from '../shared/storage';

chrome.commands.onCommand.addListener((command) => { void handleCommand(command); });
chrome.runtime.onInstalled.addListener(() => { void handleInstalled(); });
chrome.runtime.onStartup.addListener(() => { void handleStartup(); });
subscribeToSettings((s) => { void updateBadge(s); });

// Alarm for schedule
if (chrome.alarms) {
  chrome.alarms.onAlarm.addListener((alarm) => { void handleAlarm(alarm); });
}

// Message handling for popup/options
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (typeof message === 'object' && message !== null) {
    const m = message as Record<string, unknown>;
    if (m.type === 'nightlens/get-storage' || m.type === 'nightlens/export-settings') {
      import('./handlers').then(({ handleMessage }) => {
        void handleMessage(message, sender).then(sendResponse);
      });
      return true;
    }
  }
  return false;
});
