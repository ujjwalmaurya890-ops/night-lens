import { addListener, callApi, hasApiPath } from './call';
import { BrowserApiError } from './errors';
import type { AdapterEnvironment, StorageApi, StorageChange, StorageChangeListener } from './types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * The local storage area is the only persistence NightLens uses. The synced area is never
 * touched: settings must not leave the device, and its quotas are far too small for site rules.
 */
export function createStorageApi(env: AdapterEnvironment): StorageApi {
  const requireStorage = (): void => {
    if (!hasApiPath(env.root, 'storage.local.get')) {
      throw new BrowserApiError(
        'unsupported',
        'storage.local',
        'This browser does not expose extension storage, so NightLens cannot save settings.',
      );
    }
  };

  return {
    async get(key) {
      requireStorage();
      const result = await callApi<Record<string, unknown>>(env, 'storage.local.get', [key], {});
      return isRecord(result) ? result : {};
    },

    async set(items) {
      requireStorage();
      await callApi(env, 'storage.local.set', [items]);
    },

    onChanged(listener) {
      return addListener(env.root, 'storage.onChanged', (...args: unknown[]) => {
        const [changes, areaName] = args as [Record<string, StorageChange>, string];
        listener(changes ?? {}, areaName ?? 'local');
      });
    },
  };
}

export type { StorageChangeListener };
