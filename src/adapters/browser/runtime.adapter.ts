import { addListener, callApi, hasApiPath, readPath } from './call';
import type {
  AdapterEnvironment,
  ExtensionManifest,
  MessageHandler,
  RuntimeApi,
} from './types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export function readManifest(env: AdapterEnvironment): ExtensionManifest | null {
  const path = 'runtime.getManifest';
  const value = readPath(env.root, path);
  if (typeof value !== 'function') return null;
  try {
    const manifest = (value as () => unknown).call(readPath(env.root, 'runtime'));
    return isRecord(manifest) ? (manifest as unknown as ExtensionManifest) : null;
  } catch {
    return null;
  }
}

export function createRuntimeApi(env: AdapterEnvironment): RuntimeApi {
  const id = (): string | null => {
    const value = readPath(env.root, 'runtime.id');
    return typeof value === 'string' && value !== '' ? value : null;
  };

  return {
    id,
    isAvailable: () => id() !== null,

    getURL(path) {
      const fn = readPath(env.root, 'runtime.getURL');
      if (typeof fn !== 'function') return path;
      try {
        const url = (fn as (p: string) => unknown).call(readPath(env.root, 'runtime'), path);
        return typeof url === 'string' ? url : path;
      } catch {
        return path;
      }
    },

    getManifest: () => readManifest(env),

    async sendMessage(message) {
      return callApi<unknown>(env, 'runtime.sendMessage', [message]);
    },

    onMessage(handler) {
      return addListener(env.root, 'runtime.onMessage', (...args: unknown[]) => {
        const [message, sender, sendResponse] = args as [
          unknown,
          Parameters<MessageHandler>[1],
          Parameters<MessageHandler>[2],
        ];
        return handler(message, sender ?? {}, sendResponse ?? (() => undefined));
      });
    },

    onInstalled(listener) {
      if (!hasApiPath(env.root, 'runtime.onInstalled')) return () => undefined;
      return addListener(env.root, 'runtime.onInstalled', () => listener());
    },

    onStartup(listener) {
      // Safari has no onStartup; the badge is refreshed on install and on every settings change,
      // so the only loss is one cosmetic repaint after a browser restart.
      if (!hasApiPath(env.root, 'runtime.onStartup')) return () => undefined;
      return addListener(env.root, 'runtime.onStartup', () => listener());
    },

    async openOptionsPage() {
      if (!hasApiPath(env.root, 'runtime.openOptionsPage')) return false;
      try {
        await callApi(env, 'runtime.openOptionsPage');
        return true;
      } catch {
        return false;
      }
    },
  };
}
