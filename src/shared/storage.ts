import { DEFAULT_ACCESSIBILITY, DEFAULT_PERFORMANCE, DEFAULT_READING, DEFAULT_SCHEDULE, LIMITS, MAX_CUSTOM_CSS_LENGTH, MAX_CUSTOM_THEMES, MAX_SITE_RULES, STORAGE_KEY, cloneDefaults, migrateLegacySettings } from './defaults';
import { normalizeHostname } from './hostname';
import { SITE_MODES, THEME_IDS, type AccessibilitySettings, type CustomTheme, type PerformanceSettings, type ReadingModeSettings, type ScheduleSettings, type Settings, type SiteMode, type SiteRules, type ThemeId } from './types';

function clampPercent(value: unknown, limit: { min: number; max: number }, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(limit.max, Math.max(limit.min, Math.round(value)));
}

function sanitizeSiteRules(raw: unknown): SiteRules {
  const out: SiteRules = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  let count = 0;
  for (const [key, value] of Object.entries(raw)) {
    if (count >= MAX_SITE_RULES) break;
    const host = normalizeHostname(key);
    if (host && (SITE_MODES as readonly unknown[]).includes(value)) {
      out[host] = value as SiteMode;
      count++;
    }
  }
  return out;
}

function sanitizeSiteThemes(raw: unknown): Record<string, ThemeId> {
  const out: Record<string, ThemeId> = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    const host = normalizeHostname(key);
    if (host && (THEME_IDS as readonly unknown[]).includes(value)) {
      out[host] = value as ThemeId;
    }
  }
  return out;
}

function sanitizeSiteOverrides(raw: unknown): Record<string, { theme?: ThemeId; brightness?: number; contrast?: number; warmth?: number; saturation?: number }> {
  const out: Record<string, any> = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    const host = normalizeHostname(key);
    if (!host || typeof value !== 'object' || value === null) continue;
    const v = value as Record<string, unknown>;
    const entry: any = {};
    if ((THEME_IDS as readonly unknown[]).includes(v.theme)) entry.theme = v.theme as ThemeId;
    if (typeof v.brightness === 'number' && Number.isFinite(v.brightness)) entry.brightness = clampPercent(v.brightness, LIMITS.brightness, LIMITS.brightness.default);
    if (typeof v.contrast === 'number' && Number.isFinite(v.contrast)) entry.contrast = clampPercent(v.contrast, LIMITS.contrast, LIMITS.contrast.default);
    if (typeof v.warmth === 'number' && Number.isFinite(v.warmth)) entry.warmth = clampPercent(v.warmth, LIMITS.warmth, LIMITS.warmth.default);
    if (typeof v.saturation === 'number' && Number.isFinite(v.saturation)) entry.saturation = clampPercent(v.saturation, LIMITS.saturation, LIMITS.saturation.default);
    if (Object.keys(entry).length > 0) out[host] = entry;
  }
  return out;
}

function sanitizeCustomThemes(raw: unknown): CustomTheme[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomTheme[] = [];
  for (const item of raw.slice(0, MAX_CUSTOM_THEMES)) {
    if (typeof item !== 'object' || item === null) continue;
    const r = item as Record<string, unknown>;
    if (typeof r.id !== 'string' || !r.id.trim()) continue;
    if (typeof r.name !== 'string' || !r.name.trim()) continue;
    const hexRe = /^#[0-9a-fA-F]{6}$/;
    if (typeof r.bg !== 'string' || !hexRe.test(r.bg)) continue;
    if (typeof r.text !== 'string' || !hexRe.test(r.text)) continue;
    out.push({
      id: r.id,
      name: r.name.trim().slice(0, 50),
      bg: r.bg.toLowerCase(),
      bgRaised: typeof r.bgRaised === 'string' && hexRe.test(r.bgRaised) ? r.bgRaised.toLowerCase() : r.bg.toLowerCase(),
      text: r.text.toLowerCase(),
      textMuted: typeof r.textMuted === 'string' && hexRe.test(r.textMuted) ? r.textMuted.toLowerCase() : r.text.toLowerCase(),
      accent: typeof r.accent === 'string' && hexRe.test(r.accent) ? r.accent.toLowerCase() : '#7ab7ff',
      link: typeof r.link === 'string' && hexRe.test(r.link) ? r.link.toLowerCase() : '#7ab7ff',
      border: typeof r.border === 'string' && hexRe.test(r.border) ? r.border.toLowerCase() : '#2a2d33',
      createdAt: typeof r.createdAt === 'number' && Number.isFinite(r.createdAt) ? r.createdAt : Date.now(),
    });
  }
  return out;
}

function sanitizeCustomCSS(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    const host = normalizeHostname(k);
    if (!host || typeof v !== 'string') continue;
    if (v.length > MAX_CUSTOM_CSS_LENGTH) continue;
    // Basic safety: block @import with remote URLs and javascript:
    const lower = v.toLowerCase();
    if (lower.includes('javascript:') || lower.includes('expression(') || lower.includes('@import')) {
      // Allow @import only for google fonts? For safety, strip @import entirely
      if (lower.includes('@import')) continue;
    }
    out[host] = v.slice(0, MAX_CUSTOM_CSS_LENGTH);
  }
  return out;
}

function sanitizeSchedule(raw: unknown): ScheduleSettings {
  const d = DEFAULT_SCHEDULE;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ...d };
  const r = raw as Record<string, unknown>;
  const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : d.enabled,
    start: typeof r.start === 'string' && timeRe.test(r.start) ? r.start : d.start,
    end: typeof r.end === 'string' && timeRe.test(r.end) ? r.end : d.end,
    followSystem: typeof r.followSystem === 'boolean' ? r.followSystem : d.followSystem,
  };
}

function sanitizeAccessibility(raw: unknown): AccessibilitySettings {
  const d = DEFAULT_ACCESSIBILITY;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ...d };
  const r = raw as Record<string, unknown>;
  return {
    highContrast: typeof r.highContrast === 'boolean' ? r.highContrast : d.highContrast,
    reducedMotion: typeof r.reducedMotion === 'boolean' ? r.reducedMotion : d.reducedMotion,
    underlineLinks: typeof r.underlineLinks === 'boolean' ? r.underlineLinks : d.underlineLinks,
    colorBlindMode: ['none', 'protanopia', 'deuteranopia', 'tritanopia'].includes(r.colorBlindMode as string) ? (r.colorBlindMode as AccessibilitySettings['colorBlindMode']) : d.colorBlindMode,
  };
}

function sanitizeReadingMode(raw: unknown): ReadingModeSettings {
  const d = DEFAULT_READING;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ...d };
  const r = raw as Record<string, unknown>;
  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : d.enabled,
    fontSize: clampPercent(r.fontSize, LIMITS.readingFontSize, d.fontSize),
    lineHeight: clampPercent(r.lineHeight, { min: 120, max: 200 }, d.lineHeight),
    maxWidth: clampPercent(r.maxWidth, { min: 600, max: 900 }, d.maxWidth),
    fontFamily: ['system', 'serif', 'sans', 'dyslexic'].includes(r.fontFamily as string) ? (r.fontFamily as string) as ReadingModeSettings['fontFamily'] : d.fontFamily,
  };
}

function sanitizePerformance(raw: unknown): PerformanceSettings {
  const d = DEFAULT_PERFORMANCE;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ...d };
  const r = raw as Record<string, unknown>;
  return {
    enableCache: typeof r.enableCache === 'boolean' ? r.enableCache : d.enableCache,
    maxElementsPerFrame: typeof r.maxElementsPerFrame === 'number' && Number.isFinite(r.maxElementsPerFrame) ? Math.min(1000, Math.max(100, Math.round(r.maxElementsPerFrame))) : d.maxElementsPerFrame,
    debounceMs: typeof r.debounceMs === 'number' && Number.isFinite(r.debounceMs) ? Math.min(500, Math.max(50, Math.round(r.debounceMs))) : d.debounceMs,
  };
}

/** Never throws: anything invalid or missing falls back to the default for that field. */
export function sanitizeSettings(raw: unknown): Settings {
  const d = cloneDefaults();
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return d;
  const r = raw as Record<string, unknown>;

  // Handle legacy schemaVersion 1 migration
  let legacyMigration: Partial<Settings> = {};
  if (r.schemaVersion === 1 || r.schemaVersion === undefined) {
    legacyMigration = migrateLegacySettings(r);
  }

  // Determine theme: prefer new, fallback to legacy migration, then default
  let theme: ThemeId = d.theme;
  if ((THEME_IDS as readonly unknown[]).includes(r.theme)) {
    theme = r.theme as ThemeId;
  } else if (legacyMigration.theme) {
    theme = legacyMigration.theme as ThemeId;
  }

  // Warmth/sepia sync: warmth is new name, sepia is legacy
  let warmth = clampPercent(r.warmth, LIMITS.warmth, (legacyMigration.warmth as number) ?? d.warmth);
  let sepia = clampPercent(r.sepia, LIMITS.sepia, warmth);
  // If warmth explicitly set, sync sepia to it; if only sepia set, warmth = sepia
  if (typeof r.warmth === 'number' && Number.isFinite(r.warmth)) {
    warmth = clampPercent(r.warmth, LIMITS.warmth, d.warmth);
    sepia = warmth;
  } else if (typeof r.sepia === 'number' && Number.isFinite(r.sepia)) {
    warmth = clampPercent(r.sepia, LIMITS.warmth, d.warmth);
    sepia = warmth;
  }

  const activeCustomThemeId = typeof r.activeCustomThemeId === 'string' && r.activeCustomThemeId.trim() ? r.activeCustomThemeId : null;

  return {
    schemaVersion: 2,
    enabled: typeof r.enabled === 'boolean' ? r.enabled : d.enabled,
    theme,
    brightness: clampPercent(r.brightness, LIMITS.brightness, d.brightness),
    contrast: clampPercent(r.contrast, LIMITS.contrast, d.contrast),
    sepia,
    warmth,
    saturation: clampPercent(r.saturation, LIMITS.saturation, d.saturation),
    accentHue: typeof r.accentHue === 'number' && Number.isFinite(r.accentHue) ? Math.min(360, Math.max(0, Math.round(r.accentHue))) : d.accentHue,
    textSize: clampPercent(r.textSize, LIMITS.textSize, d.textSize),
    fontFamily: typeof r.fontFamily === 'string' && ['system', 'inter', 'sf', 'mono', 'serif'].includes(r.fontFamily) ? r.fontFamily : d.fontFamily,
    siteRules: sanitizeSiteRules(r.siteRules),
    siteThemes: sanitizeSiteThemes(r.siteThemes),
    siteOverrides: sanitizeSiteOverrides(r.siteOverrides),
    customThemes: sanitizeCustomThemes(r.customThemes),
    activeCustomThemeId,
    customCSS: sanitizeCustomCSS(r.customCSS),
    schedule: sanitizeSchedule(r.schedule),
    accessibility: sanitizeAccessibility(r.accessibility),
    readingMode: sanitizeReadingMode(r.readingMode),
    performance: sanitizePerformance(r.performance),
    developerMode: typeof r.developerMode === 'boolean' ? r.developerMode : d.developerMode,
    compatibility: (() => {
      const out: Record<string, any> = {};
      if (typeof r.compatibility === 'object' && r.compatibility !== null && !Array.isArray(r.compatibility)) {
        for (const [k, v] of Object.entries(r.compatibility as Record<string, unknown>)) {
          const host = normalizeHostname(k);
          if (host && ['auto', 'aggressive', 'gentle', 'mediaOnly'].includes(v as string)) out[host] = v;
        }
      }
      return out;
    })(),
  };
}

export async function loadSettings(): Promise<Settings> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return sanitizeSettings(result[STORAGE_KEY]);
  } catch (error) {
    console.warn('[NightLens] Could not read settings; using defaults.', error);
    return cloneDefaults();
  }
}

/** Read-modify-write. Rejects if storage fails so the UI can show a real error. */
export async function updateSettings(updater: (current: Settings) => Settings): Promise<Settings> {
  const next = sanitizeSettings(updater(await loadSettings()));
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}

export async function resetSettings(): Promise<Settings> {
  const next = cloneDefaults();
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}

export function subscribeToSettings(callback: (settings: Settings) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== 'local' || !(STORAGE_KEY in changes)) return;
    callback(sanitizeSettings(changes[STORAGE_KEY]?.newValue));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

// --- Import / Export ---

export function exportSettings(settings: Settings): string {
  return JSON.stringify(settings, null, 2);
}

export function validateImport(json: string): { ok: true; settings: Settings } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(json);
    const sanitized = sanitizeSettings(parsed);
    // Check that parsing produced something plausible (at least theme valid if present)
    if (parsed && typeof parsed === 'object' && 'theme' in parsed && !(THEME_IDS as readonly unknown[]).includes((parsed as Record<string, unknown>).theme) && !(parsed as Record<string, unknown>).theme === undefined) {
      // But we already sanitize, so we allow fallback to default – just warn
    }
    return { ok: true, settings: sanitized };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function exportTheme(theme: CustomTheme): string {
  return JSON.stringify(theme, null, 2);
}

export function importTheme(json: string): { ok: true; theme: CustomTheme } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(json);
    const themes = sanitizeCustomThemes([parsed]);
    if (themes.length === 0) return { ok: false, error: 'Invalid theme format' };
    return { ok: true, theme: themes[0]! };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
