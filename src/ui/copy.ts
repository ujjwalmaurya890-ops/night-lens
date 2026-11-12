import { getBrowserApi } from '../adapters/browser';
import type { BrowserName } from '../adapters/browser';

/**
 * Browser-specific wording. Keep this file the only place in the UI that knows a browser's name:
 * anything else would hardcode one product's settings URL into copy shown by another product.
 */
export interface BrowserCopy {
  readonly label: string;
  /** Where the user rebinds the keyboard shortcut. */
  readonly shortcutsLocation: string;
  /** Where settings are physically stored, as the API namespace reads to a user. */
  readonly storageNamespace: string;
  /** How the extension-store page is described in "cannot run here" copy. */
  readonly storeName: string;
}

const COPY: Record<BrowserName, Omit<BrowserCopy, 'label'>> = {
  chrome: {
    shortcutsLocation: 'chrome://extensions/shortcuts',
    storageNamespace: 'chrome.storage.local',
    storeName: 'Chrome Web Store',
  },
  edge: {
    shortcutsLocation: 'edge://extensions/shortcuts',
    storageNamespace: 'chrome.storage.local',
    storeName: 'Microsoft Edge Add-ons',
  },
  brave: {
    shortcutsLocation: 'brave://extensions/shortcuts',
    storageNamespace: 'chrome.storage.local',
    storeName: 'Chrome Web Store',
  },
  opera: {
    shortcutsLocation: 'opera://extensions/shortcuts',
    storageNamespace: 'chrome.storage.local',
    storeName: 'Opera Add-ons',
  },
  vivaldi: {
    shortcutsLocation: 'vivaldi://extensions/shortcuts',
    storageNamespace: 'chrome.storage.local',
    storeName: 'Chrome Web Store',
  },
  firefox: {
    shortcutsLocation: 'about:addons → gear menu → Manage Extension Shortcuts',
    storageNamespace: 'browser.storage.local',
    storeName: 'Firefox Add-ons site',
  },
  safari: {
    shortcutsLocation: 'Safari Settings → Extensions (Safari does not expose shortcut rebinding)',
    storageNamespace: 'browser.storage.local',
    storeName: 'App Store',
  },
  unknown: {
    shortcutsLocation: 'your browser’s extension shortcuts page',
    storageNamespace: 'extension local storage',
    storeName: 'extension store',
  },
};

export function browserCopy(): BrowserCopy {
  const { info } = getBrowserApi();
  return { label: info.label, ...COPY[info.name] };
}
