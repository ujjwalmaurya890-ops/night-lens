import { actionCapabilities } from './action.adapter';
import { hasApiPath, readPath } from './call';
import { permissionsAvailable } from './permissions.adapter';
import type { AdapterEnvironment, BrowserCapabilities } from './types';

/**
 * Capabilities are computed from what the namespace actually exposes, never from the browser
 * name, so a stripped-down engine or an unusual fork degrades predictably instead of crashing.
 */
export function buildCapabilities(env: AdapterEnvironment): BrowserCapabilities {
  const action = actionCapabilities(env);
  const permissionsApi = permissionsAvailable(env);
  return {
    runtime:
      readPath(env.root, 'runtime.id') !== undefined ||
      readPath(env.root, 'runtime.onMessage') !== undefined,
    storage:
      hasApiPath(env.root, 'storage.local.get') && hasApiPath(env.root, 'storage.local.set'),
    storageChangeEvents: hasApiPath(env.root, 'storage.onChanged.addListener'),
    tabs: hasApiPath(env.root, 'tabs.query'),
    tabMessaging: hasApiPath(env.root, 'tabs.sendMessage'),
    commands: readPath(env.root, 'commands.onCommand') !== undefined,
    action: action.action,
    actionBadge: action.actionBadge,
    actionTitle: action.actionTitle,
    openOptionsPage: hasApiPath(env.root, 'runtime.openOptionsPage'),
    manifest: hasApiPath(env.root, 'runtime.getManifest'),
    permissionsApi,
    // Only Firefox exposes revocable MV3 host grants through the permissions API. On Safari the
    // equivalent control lives in Safari settings, which an extension cannot query or prompt.
    hostAccessIsUserControlled: env.info.family === 'firefox' && permissionsApi,
  };
}
