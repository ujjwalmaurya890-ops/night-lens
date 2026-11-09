import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleMessage } from '../../src/background/handlers';
import { startContentScript } from '../../src/content/content';
import {
  DEBUG_INFO, GET_DEBUG, GET_STATUS, GET_STORAGE, EXPORT_SETTINGS, STATUS_CHANGED,
  isDebugInfoMessage, isExportSettingsMessage, isGetDebugMessage, isGetStorageMessage,
  isGetStatusMessage, isStatusChangedMessage,
} from '../../src/shared/messages';
import {
  MAX_COMPATIBILITY_ENTRIES, MAX_CUSTOM_CSS_SITES, MAX_CUSTOM_THEMES, MAX_SITE_OVERRIDES,
  MAX_SITE_THEMES, STORAGE_KEY, cloneDefaults,
} from '../../src/shared/defaults';
import {
  STALE_CONTEXT_ERROR, isExtensionContextValid, loadSettings, sanitizeSettings,
  subscribeToSettings, updateSettings,
} from '../../src/shared/storage';
import type { Settings } from '../../src/shared/types';
import { installChromeMock, type ChromeMock } from './chromeMock';

const asSender = (over: Partial<chrome.runtime.MessageSender> = {}): chrome.runtime.MessageSender =>
  ({ id: 'test-extension-id', ...over }) as chrome.runtime.MessageSender;

let mock: ChromeMock;
let dispose: (() => void) | undefined;

const media = () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('runtime message validation (contribution 16)', () => {
  it.each([
    [{ type: GET_STORAGE }, isGetStorageMessage, true],
    [{ type: GET_STORAGE, extra: 1 }, isGetStorageMessage, true],
    [{ type: 'nightlens/get-storage ' }, isGetStorageMessage, false],
    [{ type: GET_STATUS }, isGetStatusMessage, true],
    [null, isGetStorageMessage, false],
    ['nightlens/get-storage', isGetStorageMessage, false],
    [[{ type: GET_STORAGE }], isGetStorageMessage, false],
    [{ type: EXPORT_SETTINGS }, isExportSettingsMessage, true],
  ] as const)('validates %j', (message, guard, expected) => {
    expect(guard(message as unknown)).toBe(expected);
  });

  it('accepts only well-formed status payloads', () => {
    const good = { type: STATUS_CHANGED, hostname: 'example.com', status: 'active', siteMode: null };
    expect(isStatusChangedMessage(good)).toBe(true);
    expect(isStatusChangedMessage({ ...good, hostname: 'Example.com' })).toBe(false);
    expect(isStatusChangedMessage({ ...good, status: 'hacked' })).toBe(false);
    expect(isStatusChangedMessage({ ...good, siteMode: 'maybe' })).toBe(false);
    expect(isStatusChangedMessage({ ...good, type: 'nightlens/other' })).toBe(false);
  });

  it('accepts only well-formed debug payloads', () => {
    const info = { type: DEBUG_INFO, hostname: 'example.com', running: true, preset: 'midnight', processed: 1, rules: 2, duration: 3, cacheHit: 4 };
    expect(isDebugInfoMessage(info)).toBe(true);
    expect(isDebugInfoMessage({ ...info, processed: Number.NaN })).toBe(false);
    expect(isDebugInfoMessage({ ...info, running: 'yes' })).toBe(false);
    expect(isDebugInfoMessage({ ...info, hostname: 'not a host' })).toBe(false);
    expect(isGetDebugMessage({ type: GET_DEBUG })).toBe(true);
    expect(isGetDebugMessage({ type: GET_DEBUG, settings: {} })).toBe(true); // payload is ignored
  });
});

describe('service worker handler (contribution 16)', () => {
  it('ignores messages that do not come from this extension', async () => {
    mock = installChromeMock();
    mock.data[STORAGE_KEY] = cloneDefaults();
    await expect(handleMessage({ type: GET_STORAGE }, asSender({ id: 'other-extension' }))).resolves.toBeNull();
    await expect(handleMessage({ type: GET_STORAGE }, asSender({ id: undefined }))).resolves.toBeNull();
  });

  it('returns sanitised settings, not raw storage', async () => {
    mock = installChromeMock();
    mock.data[STORAGE_KEY] = { ...cloneDefaults(), brightness: 100000, theme: 'neon', siteRules: { __proto__: 'on', 'ok.com': 'off' } } as unknown as Settings;
    const reply = await handleMessage({ type: GET_STORAGE }, asSender()) as Record<string, unknown>;
    const settings = reply[STORAGE_KEY] as Record<string, unknown>;
    expect(settings.theme).toBe(cloneDefaults().theme);
    expect(settings.brightness).toBe(120);
    expect(settings.siteRules).toEqual({ 'ok.com': 'off' });
  });

  it('answers the export request with JSON and ignores unknown types', async () => {
    mock = installChromeMock();
    mock.data[STORAGE_KEY] = cloneDefaults();
    const reply = await handleMessage({ type: EXPORT_SETTINGS }, asSender()) as { data: string };
    expect(JSON.parse(reply.data)).toMatchObject({ schemaVersion: 2 });
    await expect(handleMessage({ type: 'nightlens/steal' }, asSender() as chrome.runtime.MessageSender)).resolves.toBeNull();
    await expect(handleMessage(null, asSender() as chrome.runtime.MessageSender)).resolves.toBeNull();
  });
});

describe('content script diagnostics do not leak settings (contribution 16)', () => {
  it('broadcasts counters only, never the settings or site rules', async () => {
    mock = installChromeMock();
    mock.data[STORAGE_KEY] = { ...cloneDefaults(), siteRules: { 'private.example': 'off' } };
    vi.stubGlobal('matchMedia', vi.fn(media));
    window.matchMedia = globalThis.matchMedia;
    document.body.innerHTML = `<div style="background-color:#ffffff;color:#000">x</div>`;
    dispose = startContentScript();
    await vi.waitFor(() => expect(document.querySelector('style[data-nl-owned]')).not.toBeNull());

    mock.runtime.sendMessage.mockClear();
    mock.onMessage.emit({ type: GET_DEBUG }, asSender() as chrome.runtime.MessageSender, () => undefined);

    await vi.waitFor(() => expect(mock.runtime.sendMessage).toHaveBeenCalled());
    const sent = mock.runtime.sendMessage.mock.calls.map((call) => call[0] as Record<string, unknown>);
    const debug = sent.find((m) => m.type === DEBUG_INFO)!;
    expect(debug).toBeTruthy();
    expect(debug).not.toHaveProperty('settings');
    expect(JSON.stringify(debug)).not.toContain('private.example');
    expect(isDebugInfoMessage(debug)).toBe(true);
    expect(debug.running).toBe(true);
  });
});

describe('US-15 — extension context invalidation', () => {
  const invalidate = () => {
    (globalThis as unknown as { chrome: { runtime: { id?: string } } }).chrome.runtime.id = undefined;
  };

  it('reports the context as invalid and refuses writes with a clear error', async () => {
    installChromeMock();
    expect(isExtensionContextValid()).toBe(true);
    invalidate();
    expect(isExtensionContextValid()).toBe(false);
    await expect(updateSettings((s) => s)).rejects.toThrow(STALE_CONTEXT_ERROR);
    expect(await loadSettings()).toEqual(cloneDefaults());
    expect(subscribeToSettings(() => undefined)).toBeTypeOf('function');
  });

  it('does not throw when chrome itself is missing', async () => {
    vi.stubGlobal('chrome', undefined);
    expect(isExtensionContextValid()).toBe(false);
    expect(await loadSettings()).toEqual(cloneDefaults());
    expect(subscribeToSettings(() => undefined)).toBeTypeOf('function');
  });

  it('restores the page and detaches listeners when the extension goes away', async () => {
    mock = installChromeMock();
    mock.data[STORAGE_KEY] = cloneDefaults();
    vi.stubGlobal('matchMedia', vi.fn(media));
    window.matchMedia = globalThis.matchMedia;
    document.body.innerHTML = `<div style="background-color:#ffffff;color:#000">x</div>`;
    dispose = startContentScript();
    await vi.waitFor(() => expect(document.querySelector('style[data-nl-owned]')).not.toBeNull());
    expect(mock.onMessage.count()).toBe(1);

    invalidate();
    // The content script re-checks the context on its next apply() trigger (visibility or a
    // storage notification) and disposes itself.
    document.dispatchEvent(new Event('visibilitychange'));
    await mock.onChanged.emit({ [STORAGE_KEY]: { newValue: cloneDefaults() } }, 'local');

    await vi.waitFor(() => expect(document.querySelector('style[data-nl-owned]')).toBeNull());
    expect(mock.onMessage.count()).toBe(0);
    dispose = undefined;
  });

  it('survives a throwing settings subscriber', async () => {
    mock = installChromeMock();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const second = vi.fn();
    subscribeToSettings(() => { throw new Error('boom'); });
    subscribeToSettings(second);
    await mock.onChanged.emit({ [STORAGE_KEY]: { newValue: cloneDefaults() } }, 'local');
    expect(second).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();
  });
});

describe('settings validation limits (contribution 15)', () => {
  const many = (n: number, make: (i: number) => [string, unknown]) =>
    Object.fromEntries(Array.from({ length: n }, (_, i) => make(i)));

  it('caps every per-site map', () => {
    const settings = sanitizeSettings({
      siteThemes: many(MAX_SITE_THEMES + 50, (i) => [`site${i}.com`, 'nord']),
      siteOverrides: many(MAX_SITE_OVERRIDES + 50, (i) => [`ov${i}.com`, { brightness: 80 }]),
      customCSS: many(MAX_CUSTOM_CSS_SITES + 50, (i) => [`css${i}.com`, 'a{color:red}']),
      compatibility: many(MAX_COMPATIBILITY_ENTRIES + 50, (i) => [`compat${i}.com`, 'gentle']),
    });
    expect(Object.keys(settings.siteThemes).length).toBe(MAX_SITE_THEMES);
    expect(Object.keys(settings.siteOverrides).length).toBe(MAX_SITE_OVERRIDES);
    expect(Object.keys(settings.customCSS).length).toBe(MAX_CUSTOM_CSS_SITES);
    expect(Object.keys(settings.compatibility).length).toBe(MAX_COMPATIBILITY_ENTRIES);
  });

  it('de-duplicates custom theme ids and caps the array', () => {
    const dupes = Array.from({ length: MAX_CUSTOM_THEMES + 10 }, (_, i) => ({
      id: i < 10 ? 'same' : `id-${i}`, name: `T${i}`, bg: '#101010', text: '#ffffff', createdAt: i,
    }));
    const settings = sanitizeSettings({ customThemes: dupes });
    expect(settings.customThemes.filter((t) => t.id === 'same')).toHaveLength(1);
    expect(settings.customThemes.length).toBeLessThanOrEqual(MAX_CUSTOM_THEMES);
  });

  it('normalises a dangling custom-theme pointer instead of leaving a fake palette', () => {
    const noThemes = sanitizeSettings({ theme: 'custom', activeCustomThemeId: 'missing' });
    expect(noThemes.theme).toBe(cloneDefaults().theme);
    expect(noThemes.activeCustomThemeId).toBeNull();

    const withTheme = sanitizeSettings({
      theme: 'custom',
      customThemes: [{ id: 'real', name: 'Real', bg: '#101010', text: '#ffffff' }],
    });
    expect(withTheme.theme).toBe('custom');
    expect(withTheme.activeCustomThemeId).toBe('real');

    const wrongPointer = sanitizeSettings({
      theme: 'custom',
      activeCustomThemeId: 'nope',
      customThemes: [{ id: 'real', name: 'Real', bg: '#101010', text: '#ffffff' }],
    });
    expect(wrongPointer.activeCustomThemeId).toBe('real');
  });

  it('drops entries whose values are unusable rather than inventing them', () => {
    const settings = sanitizeSettings({
      siteOverrides: { 'a.com': { theme: 'unknown-theme', brightness: 'bright' }, 'b.com': [] , 'c.com': { contrast: 120 } },
      compatibility: { 'a.com': 'sledgehammer' },
      siteThemes: { 'a.com': 'ultraviolet' },
    });
    expect(settings.siteOverrides).toEqual({ 'c.com': { contrast: 120 } });
    expect(settings.compatibility).toEqual({});
    expect(settings.siteThemes).toEqual({});
  });
});
