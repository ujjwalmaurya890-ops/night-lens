import { describe, expect, it, vi } from 'vitest';
import { LIMITS, STORAGE_KEY, cloneDefaults } from '../../src/shared/defaults';
import { decide, getEffectiveSettings, isWithinSchedule } from '../../src/shared/decision';
import { getSiteEntryHost, getSiteMode, hostnameFromUserInput, normalizeHostname } from '../../src/shared/hostname';
import { isGetStatusMessage, isStatusChangedMessage, isStatusPayload } from '../../src/shared/messages';
import { loadSettings, resetSettings, sanitizeSettings, subscribeToSettings, updateSettings, validateImport } from '../../src/shared/storage';
import { installChromeMock } from './chromeMock';

describe('hostname matching (nearest parent domain wins)', () => {
  it.each([
    ['Example.COM', 'example.com'], ['example.com.', 'example.com'], ['  a.b-c.org ', 'a.b-c.org'], ['localhost', 'localhost'], ['127.0.0.1', '127.0.0.1'], ['[::1]', '[::1]'],
  ])('normalizes %j', (i, o) => expect(normalizeHostname(i)).toBe(o));
  it.each(['', ' ', '-a.com', 'a..com', 'exa mple.com', '__proto__', 'a_b.com', 'http://x.com', null, 42, undefined])('rejects %j', (i) => expect(normalizeHostname(i)).toBeNull());
  it('extracts hostnames from URLs and bare input', () => {
    expect(hostnameFromUserInput('https://Docs.Example.com:8080/a/b?q=1#x')).toBe('docs.example.com');
    expect(hostnameFromUserInput('example.com/path')).toBe('example.com');
    expect(hostnameFromUserInput('not a host')).toBeNull();
    expect(hostnameFromUserInput('')).toBeNull();
  });
  it('inherits parent rules, prefers the closest host, and never matches suffix lookalikes or Object.prototype', () => {
    const rules = { 'example.com': 'off' as const, 'docs.example.com': 'on' as const };
    expect(getSiteMode(rules, 'example.com')).toBe('off');
    expect(getSiteMode(rules, 'www.example.com')).toBe('off');
    expect(getSiteMode(rules, 'sub.example.com')).toBe('off');
    expect(getSiteMode(rules, 'docs.example.com')).toBe('on');
    expect(getSiteMode(rules, 'v1.docs.example.com')).toBe('on');
    expect(getSiteMode(rules, 'notexample.com')).toBeUndefined();
    expect(getSiteMode(rules, 'constructor')).toBeUndefined();
    expect(getSiteMode(rules, null)).toBeUndefined();
    expect(getSiteEntryHost(rules, 'v1.docs.example.com')).toBe('docs.example.com');
  });
  it('does not inherit IP-address or single-label hostname rules', () => {
    expect(getSiteMode({ '127.0.0.1': 'off' }, '1127.0.0.1')).toBeUndefined();
    expect(getSiteMode({ localhost: 'off' }, 'sub.localhost')).toBeUndefined();
  });
});

describe('sanitizeSettings (invalid or missing settings)', () => {
  it.each([null, undefined, 5, 'x', [], true])('returns defaults for %j', (raw) => expect(sanitizeSettings(raw)).toEqual(cloneDefaults()));
  it('repairs each bad field independently', () => {
    const s = sanitizeSettings({ enabled: 'yes', theme: 'neon', brightness: NaN, contrast: 9999, sepia: -5, siteRules: { 'ok.com': 'off', 'bad host': 'off', 'x.com': 'maybe', __proto__: 'on' } });
    expect(s).toEqual({ ...cloneDefaults(), contrast: LIMITS.contrast.max, sepia: LIMITS.sepia.min, siteRules: { 'ok.com': 'off' } });
  });
  it('drops unknown keys and keeps valid values', () => {
    const s = sanitizeSettings({ enabled: false, theme: 'dim', brightness: 80, evil: 1 });
    expect(s).toMatchObject({ enabled: false, theme: 'dim', brightness: 80 });
    expect(s).not.toHaveProperty('evil');
  });
  it('does not pollute prototypes via a JSON __proto__ key', () => {
    sanitizeSettings(JSON.parse('{"siteRules":{"__proto__":"off","constructor":"off"}}'));
    expect(({} as Record<string, unknown>).off).toBeUndefined();
  });
});

describe('storage persistence', () => {
  it('returns defaults when nothing is stored and when storage throws', async () => {
    const mock = installChromeMock();
    expect(await loadSettings()).toEqual(cloneDefaults());
    mock.failStorage.get = true;
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await loadSettings()).toEqual(cloneDefaults());
  });
  it('persists updates between "sessions" and sanitizes what it writes', async () => {
    const mock = installChromeMock();
    await updateSettings((s) => ({ ...s, theme: 'dim', brightness: 9999, siteRules: { 'a.com': 'off' } }));
    expect(mock.data[STORAGE_KEY]).toMatchObject({ theme: 'dim', brightness: LIMITS.brightness.max, siteRules: { 'a.com': 'off' } });
    expect((await loadSettings()).theme).toBe('dim');
  });
  it('serializes rapid updates so independent fields are not lost', async () => {
    installChromeMock();
    await Promise.all([
      updateSettings((s) => ({ ...s, brightness: 80 })),
      updateSettings((s) => ({ ...s, contrast: 120 })),
      updateSettings((s) => ({ ...s, theme: 'nord' })),
    ]);
    expect(await loadSettings()).toMatchObject({ brightness: 80, contrast: 120, theme: 'nord' });
  });
  it('surfaces write failures instead of pretending success', async () => {
    const mock = installChromeMock();
    mock.failStorage.set = true;
    await expect(updateSettings((s) => s)).rejects.toThrow('quota exceeded');
  });
  it('resets to defaults', async () => {
    await updateSettings((s) => ({ ...s, enabled: false }));
    expect(await resetSettings()).toEqual(cloneDefaults());
    expect((await loadSettings()).enabled).toBe(true);
  });
  it('notifies subscribers only for local-area changes to the settings key, and can unsubscribe', async () => {
    const mock = installChromeMock();
    const cb = vi.fn();
    const off = subscribeToSettings(cb);
    mock.onChanged.emit({ other: { newValue: 1 } }, 'local');
    mock.onChanged.emit({ [STORAGE_KEY]: { newValue: { enabled: false } } }, 'sync');
    expect(cb).not.toHaveBeenCalled();
    await updateSettings((s) => ({ ...s, enabled: false }));
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0]![0].enabled).toBe(false);
    off();
    await updateSettings((s) => ({ ...s, enabled: true }));
    expect(cb).toHaveBeenCalledTimes(1);
    expect(mock.onChanged.count()).toBe(0);
  });
});

describe('settings import', () => {
  it('accepts objects and sanitizes their values', () => {
    const result = validateImport('{"theme":"nord","brightness":80}');
    expect(result).toMatchObject({ ok: true, settings: { theme: 'nord', brightness: 80 } });
  });
  it.each(['null', '[]', '"settings"', 'not-json'])('rejects invalid backup %s', (json) => {
    expect(validateImport(json).ok).toBe(false);
  });
});

describe('effective per-site settings', () => {
  it('applies inherited theme assignments and gives exact overrides priority', () => {
    const settings = {
      ...cloneDefaults(),
      siteThemes: { 'example.com': 'nord' as const },
      siteOverrides: { 'docs.example.com': { theme: 'amoled' as const, brightness: 85, warmth: 20 } },
    };
    expect(getEffectiveSettings(settings, 'www.example.com')).toMatchObject({ theme: 'nord' });
    expect(getEffectiveSettings(settings, 'v1.docs.example.com')).toMatchObject({ theme: 'amoled', brightness: 85, warmth: 20, sepia: 20 });
  });
});

describe('decide()', () => {
  const base = cloneDefaults();
  it('is off globally', () => expect(decide({ ...base, enabled: false }, 'a.com', true)).toMatchObject({ active: false, status: 'globally-off' }));
  it('respects exclusions', () => expect(decide({ ...base, siteRules: { 'a.com': 'off' } }, 'a.com', true)).toMatchObject({ active: false, status: 'excluded', siteMode: 'off' }));
  it('does not exclude other hosts', () => expect(decide({ ...base, siteRules: { 'a.com': 'off' } }, 'b.com', true)).toMatchObject({ active: true }));
  it('forces on', () => expect(decide({ ...base, siteRules: { 'a.com': 'on' } }, 'a.com', false)).toMatchObject({ active: true, forceNative: true }));
  it('follows system appearance', () => {
    const s = { ...base, theme: 'system' as const };
    expect(decide(s, 'a.com', false)).toMatchObject({ active: false, status: 'waiting-for-system' });
    expect(decide(s, 'a.com', true)).toMatchObject({ active: true });
    expect(decide({ ...s, siteRules: { 'a.com': 'on' } }, 'a.com', false)).toMatchObject({ active: true, forceNative: true });
  });
  it('global off beats a forced-on site rule', () => expect(decide({ ...base, enabled: false, siteRules: { 'a.com': 'on' } }, 'a.com', true).active).toBe(false));
  it('reports scheduled-off when outside the schedule window (content script passes this through to the popup)', () => {
    const s = { ...base, schedule: { ...base.schedule, enabled: true, start: '22:00', end: '07:00' } };
    const noon = new Date(2026, 10, 2, 12, 0);
    expect(decide(s, 'a.com', true, noon)).toMatchObject({ active: false, status: 'scheduled-off', siteMode: null });
    const night = new Date(2026, 10, 2, 23, 30);
    expect(decide(s, 'a.com', true, night)).toMatchObject({ active: true });
    // forced-on sites ignore the schedule
    expect(decide({ ...s, siteRules: { 'a.com': 'on' } }, 'a.com', true, noon)).toMatchObject({ active: true, forceNative: true });
  });
  it('isWithinSchedule handles overnight windows and 00:00-00:00', () => {
    const sch = { enabled: true, start: '22:00', end: '07:00', followSystem: false };
    expect(isWithinSchedule(sch, new Date(2026, 0, 1, 23, 0))).toBe(true);
    expect(isWithinSchedule(sch, new Date(2026, 0, 1, 6, 59))).toBe(true);
    expect(isWithinSchedule(sch, new Date(2026, 0, 1, 12, 0))).toBe(false);
    expect(isWithinSchedule({ ...sch, start: '00:00', end: '00:00' }, new Date(2026, 0, 1, 12, 0))).toBe(true);
    expect(isWithinSchedule({ ...sch, enabled: false }, new Date(2026, 0, 1, 12, 0))).toBe(true);
  });
});

describe('message validation', () => {
  it('accepts only well-formed messages', () => {
    expect(isGetStatusMessage({ type: 'nightlens/get-status' })).toBe(true);
    expect(isGetStatusMessage({ type: 'other' })).toBe(false);
    expect(isGetStatusMessage(null)).toBe(false);
    expect(isStatusPayload({ hostname: 'a.com', status: 'active', siteMode: null })).toBe(true);
    expect(isStatusPayload({ hostname: 'A.com', status: 'active', siteMode: null })).toBe(false);
    expect(isStatusPayload({ hostname: 'a.com', status: 'hacked', siteMode: null })).toBe(false);
    expect(isStatusPayload({ hostname: 'a.com', status: 'active', siteMode: 'maybe' })).toBe(false);
    expect(isStatusChangedMessage({ type: 'nightlens/status-changed', hostname: null, status: 'excluded', siteMode: 'off' })).toBe(true);
    expect(isStatusChangedMessage({ type: 'nightlens/get-status', hostname: null, status: 'excluded', siteMode: 'off' })).toBe(false);
  });
});
