import { addListener, callApi, hasApiPath } from './call';
import { readManifest } from './runtime.adapter';
import type { AdapterEnvironment, PermissionsApi } from './types';

/**
 * Host access differs by engine:
 *  - Chromium browsers grant the access implied by `content_scripts.matches` at install (unless the
 *    user switches the extension to "on click"); nothing is declared in `host_permissions`.
 *  - Firefox MV3 treats host permissions as revocable grants, so the content script may not be
 *    running until the user allows the site (or the whole web) in the extension's Permissions tab.
 *  - Safari lets users set per-site access in Safari settings and has no `permissions.request`.
 *
 * The adapter answers "is the access NightLens declared actually granted right now?" and, where the
 * engine supports it, asks for it from a user gesture.
 */
export function createPermissionsApi(env: AdapterEnvironment): PermissionsApi {
  const declaredOrigins = (): string[] => {
    const manifest = readManifest(env);
    const origins = manifest?.host_permissions;
    return Array.isArray(origins) ? origins.filter((o): o is string => typeof o === 'string') : [];
  };

  const contains = async (): Promise<boolean> => {
    const origins = declaredOrigins();
    if (origins.length === 0) return true;
    if (!hasApiPath(env.root, 'permissions.contains')) return true;
    try {
      const granted = await callApi<boolean>(env, 'permissions.contains', [{ origins }], true);
      return granted !== false;
    } catch {
      // A failure to answer is not evidence of a missing grant: do not nag the user.
      return true;
    }
  };

  return {
    containsHostAccess: contains,

    async requestHostAccess() {
      const origins = declaredOrigins();
      if (origins.length === 0) return true;
      if (!hasApiPath(env.root, 'permissions.request')) return false;
      try {
        const granted = await callApi<boolean>(env, 'permissions.request', [{ origins }], false);
        return granted === true;
      } catch {
        // Chrome throws if the call did not originate from a user gesture.
        return false;
      }
    },

    onHostAccessChanged(listener) {
      if (declaredOrigins().length === 0) return () => undefined;
      let disposed = false;
      const notify = (): void => {
        void contains().then((granted) => {
          if (!disposed) listener(granted);
        });
      };
      const offAdded = addListener(env.root, 'permissions.onAdded', notify);
      const offRemoved = addListener(env.root, 'permissions.onRemoved', notify);
      return () => {
        disposed = true;
        offAdded();
        offRemoved();
      };
    },
  };
}

export function permissionsAvailable(env: AdapterEnvironment): boolean {
  return hasApiPath(env.root, 'permissions.contains') || hasApiPath(env.root, 'permissions.request');
}
