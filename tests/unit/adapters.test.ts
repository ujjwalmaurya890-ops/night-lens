import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BrowserApiError,
  createAdapterFor,
  detectBrowser,
  familyOf,
  getBrowserApi,
  resetBrowserApi,
} from '../../src/adapters/browser';
import type { BrowserInfo } from '../../src/adapters/browser';
import { installChromeMock, installFirefoxMock } from './chromeMock';

const FIREFOX_INFO: BrowserInfo = {
  family: 'firefox', name: 'firefox', label: 'Firefox', namespace: 'browser', manifestVersion: '3' as unknown as number,
};

afterEach(() => { resetBrowserApi(); });

describe('browser detection', () => {
  it.each([
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', 'chrome', '141.0.0.0'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0', 'edge', '141.0.0.0'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 OPR/120.0.0.0', 'opera', '120.0.0.0'],
    ['Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0', 'firefox', '141.0'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15', 'safari', '18.4'],
  ] as const)('identifies %s', (ua, name, version) => {
    expect(detectBrowser(ua)).toEqual({ name, version });
  });

  it('does not claim to know the product when the user agent says nothing', () => {
    expect(detectBrowser('CustomBrowser/1.0')).toEqual({ name: 'unknown', version: null });
  });

  it('maps products to rendering-engine families', () => {
    expect(familyOf('chrome')).toBe('chromium');
    expect(familyOf('edge')).toBe('chromium');
    expect(familyOf('brave')).toBe('chromium');
    expect(familyOf('opera')).toBe('chromium');
    expect(familyOf('vivaldi')).toBe('chromium');
    expect(familyOf('firefox')).toBe('firefox');
    expect(familyOf('safari')).toBe('safari');
    expect(familyOf('unknown')).toBe('unknown');
  });
});

describe('adapter caching and context lifetime', () => {
  it('returns one adapter per namespace and a new one after a namespace swap', () => {
    const first = getBrowserApi();
    expect(getBrowserApi()).toBe(first);
    installChromeMock();
    expect(getBrowserApi()).not.toBe(first);
  });

  it('reports a stale extension context without throwing', () => {
    installChromeMock();
    const api = getBrowserApi();
    expect(api.runtime.isAvailable()).toBe(true);
    (globalThis as unknown as { chrome: { runtime: { id?: string } } }).chrome.runtime.id = '';
    expect(api.runtime.isAvailable()).toBe(false);
    expect(api.runtime.id()).toBeNull();
  });

  it('degrades to a usable, non-throwing adapter when no extension namespace exists', async () => {
    vi.stubGlobal('chrome', undefined);
    vi.stubGlobal('browser', undefined);
    resetBrowserApi();
    const api = getBrowserApi();
    expect(api.capabilities.storage).toBe(false);
    expect(api.capabilities.runtime).toBe(false);
    expect(api.runtime.getManifest()).toBeNull();
    await expect(api.storage.get('key')).rejects.toBeInstanceOf(BrowserApiError);
    await expect(api.tabs.queryActiveTab()).resolves.toEqual({ id: null });
    await expect(api.action.setBadgeText('x')).resolves.toBeUndefined();
    await expect(api.options.open()).resolves.toBe(false);
    expect(api.runtime.onMessage(() => undefined)).toBeTypeOf('function');
  });
});

describe('callback-style (legacy Chromium) namespace', () => {
  function callbackNamespace(overrides: Record<string, unknown> = {}) {
    let lastError: { message: string } | undefined;
    const namespace = {
      runtime: {
        id: 'legacy-id',
        lastError: undefined as unknown,
        getManifest: () => ({ manifest_version: 3, version: '1.0.0', host_permissions: [] }),
        onMessage: { addListener: () => undefined, removeListener: () => undefined },
        sendMessage: (_message: unknown, callback?: (value?: unknown) => void) => {
          lastError = { message: 'Could not establish connection.' };
          (namespace.runtime as { lastError?: unknown }).lastError = lastError;
          callback?.(undefined);
          (namespace.runtime as { lastError?: unknown }).lastError = undefined;
        },
      },
      storage: {
        local: {
          get: (_key: string, callback: (value: Record<string, unknown>) => void) => {
            callback({ 'nightlens:settings': { theme: 'nord' } });
          },
          set: (_items: unknown, callback: () => void) => { callback(); },
        },
        onChanged: { addListener: () => undefined, removeListener: () => undefined },
      },
      ...overrides,
    };
    return namespace;
  }

  it('resolves values delivered through the trailing callback', async () => {
    resetBrowserApi();
    vi.stubGlobal('browser', undefined);
    vi.stubGlobal('chrome', callbackNamespace());
    const api = getBrowserApi();
    expect(api.info.family).toBe('unknown');
    await expect(api.storage.get('nightlens:settings')).resolves.toEqual({
      'nightlens:settings': { theme: 'nord' },
    });
  });

  it('turns chrome.runtime.lastError into a typed messaging error', async () => {
    resetBrowserApi();
    vi.stubGlobal('browser', undefined);
    vi.stubGlobal('chrome', callbackNamespace());
    const api = getBrowserApi();
    await expect(api.runtime.sendMessage({ type: 'x' })).rejects.toMatchObject({
      name: 'BrowserApiError',
      api: 'runtime.sendMessage',
    });
  });
});

describe('promise-style (Firefox/Safari) namespace', () => {
  it('never appends a callback argument', async () => {
    const calls: unknown[][] = [];
    const namespace = {
      runtime: {
        id: 'ff-id',
        getManifest: () => ({ manifest_version: 3, version: '1.0.0', host_permissions: [] }),
        onMessage: { addListener: () => undefined, removeListener: () => undefined },
        sendMessage: async (...args: unknown[]) => { calls.push(args); return { ok: true }; },
      },
      storage: {
        local: {
          get: async (...args: unknown[]) => { calls.push(args); return { k: 1 }; },
          set: async () => undefined,
        },
        onChanged: { addListener: () => undefined, removeListener: () => undefined },
      },
    };
    const api = createAdapterFor(namespace, FIREFOX_INFO);
    await api.runtime.sendMessage({ type: 'x' });
    await api.storage.get('k');
    expect(calls).toEqual([[{ type: 'x' }], ['k']]);
    expect(api.info.family).toBe('firefox');
  });
});

describe('toolbar, commands, tabs', () => {
  it('never throws when the action API is missing', async () => {
    resetBrowserApi();
    vi.stubGlobal('browser', undefined);
    vi.stubGlobal('chrome', { runtime: { id: 'x' } });
    const api = getBrowserApi();
    expect(api.capabilities.action).toBe(false);
    await expect(api.action.setBadgeText('OFF')).resolves.toBeUndefined();
    await expect(api.action.setTitle('NightLens')).resolves.toBeUndefined();
  });

  it('lists commands and unsubscribes command listeners', async () => {
    const mock = installChromeMock();
    const api = getBrowserApi();
    await expect(api.commands.getAll()).resolves.toEqual(['toggle-nightlens']);
    const seen: string[] = [];
    const off = api.commands.onCommand((command) => seen.push(command));
    mock.onCommand.emit('toggle-nightlens');
    off();
    mock.onCommand.emit('toggle-nightlens');
    expect(seen).toEqual(['toggle-nightlens']);
  });

  it('queries the active tab and forwards frame options', async () => {
    const mock = installChromeMock();
    const api = getBrowserApi();
    await expect(api.tabs.queryActiveTab()).resolves.toEqual({ id: 5 });
    await api.tabs.sendMessageToTab(5, { type: 'ping' }, { frameId: 0 });
    const call = mock.tabs.sendMessage.mock.calls[0]!;
    expect(call.slice(0, 3)).toEqual([5, { type: 'ping' }, { frameId: 0 }]);
  });

  it('wraps tab messaging failures with the API name', async () => {
    const mock = installChromeMock();
    mock.tabs.sendMessage.mockRejectedValueOnce(new Error('Receiving end does not exist.'));
    const api = getBrowserApi();
    await expect(api.tabs.sendMessageToTab(5, {})).rejects.toMatchObject({
      kind: 'context-invalidated',
      api: 'tabs.sendMessage',
    });
  });

  it('reports storage failures instead of swallowing them', async () => {
    const mock = installChromeMock();
    mock.failStorage.set = true;
    const api = getBrowserApi();
    await expect(api.storage.set({ a: 1 })).rejects.toThrow('quota exceeded');
  });
});

describe('firefox host access', () => {
  beforeEach(() => { resetBrowserApi(); });

  it('is user-controlled and starts ungranted until requested', async () => {
    const mock = installFirefoxMock();
    const api = getBrowserApi();
    expect(api.info.family).toBe('firefox');
    expect(api.capabilities.hostAccessIsUserControlled).toBe(true);
    await expect(api.permissions.containsHostAccess()).resolves.toBe(false);
    await expect(api.permissions.requestHostAccess()).resolves.toBe(true);
    expect(mock.permissions.request).toHaveBeenCalledWith({ origins: ['http://*/*', 'https://*/*'] });
  });

  it('notifies listeners when the grant changes in about:addons', async () => {
    const mock = installFirefoxMock();
    const api = getBrowserApi();
    const seen: boolean[] = [];
    const off = api.permissions.onHostAccessChanged((granted) => seen.push(granted));
    mock.permissions.contains.mockResolvedValue(true);
    mock.onPermissionAdded.emit();
    await vi.waitFor(() => expect(seen).toEqual([true]));
    off();
    mock.permissions.contains.mockResolvedValue(false);
    mock.onPermissionRemoved.emit();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(seen).toEqual([true]);
  });

  it('treats Chromium, which declares no host permissions, as always granted', async () => {
    installChromeMock();
    const api = getBrowserApi();
    expect(api.capabilities.hostAccessIsUserControlled).toBe(false);
    await expect(api.permissions.containsHostAccess()).resolves.toBe(true);
  });
});
