import type { AccessibilitySettings, PerformanceSettings, ReadingModeSettings, ScheduleSettings, Settings } from './types';

export const STORAGE_KEY = 'nightlens:settings';
export const MAX_SITE_RULES = 2000;
export const MAX_CUSTOM_THEMES = 50;
export const MAX_CUSTOM_CSS_LENGTH = 20000;

export const LIMITS = {
  brightness: { min: 60, max: 120, step: 5, default: 100 },
  contrast: { min: 70, max: 140, step: 5, default: 100 },
  sepia: { min: 0, max: 60, step: 5, default: 0 },
  warmth: { min: 0, max: 60, step: 5, default: 0 },
  saturation: { min: 0, max: 100, step: 5, default: 50 },
  accentHue: { min: 0, max: 360, step: 5, default: 225 },
  textSize: { min: 80, max: 130, step: 5, default: 100 },
  readingFontSize: { min: 80, max: 140, step: 5, default: 100 },
  readingLineHeight: { min: 120, max: 200, step: 10, default: 160 },
  readingMaxWidth: { min: 600, max: 900, step: 50, default: 720 },
} as const;

export const DEFAULT_SCHEDULE: ScheduleSettings = {
  enabled: false,
  start: '22:00',
  end: '07:00',
  followSystem: false,
};

export const DEFAULT_ACCESSIBILITY: AccessibilitySettings = {
  highContrast: false,
  reducedMotion: false,
  underlineLinks: false,
  colorBlindMode: 'none',
};

export const DEFAULT_READING: ReadingModeSettings = {
  enabled: false,
  fontSize: 100,
  lineHeight: 160,
  maxWidth: 720,
  fontFamily: 'system',
};

export const DEFAULT_PERFORMANCE: PerformanceSettings = {
  enableCache: true,
  maxElementsPerFrame: 400,
  debounceMs: 150,
};

export function cloneDefaults(): Settings {
  return {
    schemaVersion: 2,
    enabled: true,
    theme: 'midnight',
    brightness: LIMITS.brightness.default,
    contrast: LIMITS.contrast.default,
    sepia: LIMITS.sepia.default,
    warmth: LIMITS.warmth.default,
    saturation: LIMITS.saturation.default,
    accentHue: LIMITS.accentHue.default,
    textSize: LIMITS.textSize.default,
    fontFamily: 'system',
    siteRules: {},
    siteThemes: {},
    siteOverrides: {},
    customThemes: [],
    activeCustomThemeId: null,
    customCSS: {},
    schedule: { ...DEFAULT_SCHEDULE },
    accessibility: { ...DEFAULT_ACCESSIBILITY },
    readingMode: { ...DEFAULT_READING },
    performance: { ...DEFAULT_PERFORMANCE },
    developerMode: false,
    compatibility: {},
  };
}

// For migrating old schemaVersion 1 to 2
export function migrateLegacySettings(raw: Record<string, unknown>): Partial<Settings> {
  const migrated: Partial<Settings> = {};
  // Theme migration: balanced -> midnight, highContrast -> amoled, dim -> softDark
  if (typeof raw.theme === 'string') {
    const map: Record<string, string> = {
      balanced: 'midnight',
      highContrast: 'amoled',
      dim: 'softDark',
      system: 'system',
    };
    if (map[raw.theme]) {
      migrated.theme = map[raw.theme] as Settings['theme'];
    }
  }
  // sepia -> warmth
  if (typeof raw.sepia === 'number') {
    migrated.warmth = raw.sepia;
    migrated.sepia = raw.sepia;
  }
  return migrated;
}
