import { hasApiPath, notifyApi, resolveApiPath } from './call';
import type { ActionApi, AdapterEnvironment, OptionsPageApi } from './types';

/**
 * The toolbar button. Badge text is cosmetic: if an engine lacks `action` (or the user pinned the
 * button away), the failure is swallowed so it can never interrupt a settings change.
 */
export function createActionApi(env: AdapterEnvironment): ActionApi {
  return {
    async setBadgeText(text) {
      notifyApi(env, 'action.setBadgeText', [{ text }]);
    },
    async setBadgeBackgroundColor(color) {
      notifyApi(env, 'action.setBadgeBackgroundColor', [{ color }]);
    },
    async setTitle(title) {
      notifyApi(env, 'action.setTitle', [{ title }]);
    },
  };
}

export function actionCapabilities(env: AdapterEnvironment): {
  action: boolean;
  actionBadge: boolean;
  actionTitle: boolean;
} {
  const action = hasApiPath(env.root, 'action.setBadgeText') || hasApiPath(env.root, 'action.setTitle');
  return {
    action,
    actionBadge:
      hasApiPath(env.root, 'action.setBadgeText') &&
      hasApiPath(env.root, 'action.setBadgeBackgroundColor'),
    actionTitle: hasApiPath(env.root, 'action.setTitle'),
  };
}

/** Options page management: opening it is the only operation NightLens performs. */
export function createOptionsPageApi(env: AdapterEnvironment): OptionsPageApi {
  return {
    async open() {
      const resolved = resolveApiPath(env.root, 'runtime.openOptionsPage');
      if (!resolved) return false;
      try {
        // Called without a callback: the browser either opens the page or throws, and both
        // Chromium and Firefox accept the no-argument form.
        const result = resolved.fn.apply(resolved.owner, []);
        if (result && typeof (result as Promise<unknown>).then === 'function') {
          await (result as Promise<unknown>).catch(() => undefined);
        }
        return true;
      } catch {
        return false;
      }
    },
  };
}
