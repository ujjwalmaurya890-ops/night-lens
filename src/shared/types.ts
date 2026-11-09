export const THEME_IDS = [
  'balanced',
  'highContrast',
  'dim',
  // Premium presets
  'midnight',
  'deepSpace',
  'amoled',
  'softDark',
  'charcoal',
  'graphite',
  'solarized',
  'nord',
  'dracula',
  'oledNight',
  'system',
  'custom',
] as const;
export type ThemeId = (typeof THEME_IDS)[number];

// Legacy aliases for backward compatibility (still valid but mapped)
export const LEGACY_THEMES = ['balanced', 'highContrast', 'dim'] as const;

export const PREMIUM_THEME_IDS = [
  'midnight',
  'deepSpace',
  'amoled',
  'softDark',
  'charcoal',
  'graphite',
  'solarized',
  'nord',
  'dracula',
  'oledNight',
] as const;
export type PremiumThemeId = (typeof PREMIUM_THEME_IDS)[number];

export const SITE_MODES = ['on', 'off'] as const;
/** 'off' = excluded; 'on' = forced even if the site looks natively dark. Absent = automatic. */
export type SiteMode = (typeof SITE_MODES)[number];
export type SiteRules = Record<string, SiteMode>;

export interface CustomTheme {
  id: string;
  name: string;
  bg: string; // hex #rrggbb
  bgRaised: string;
  text: string;
  textMuted: string;
  accent: string;
  link: string;
  border: string;
  createdAt: number;
}

export interface SiteOverride {
  theme?: ThemeId;
  brightness?: number;
  contrast?: number;
  warmth?: number;
  saturation?: number;
}

export interface ScheduleSettings {
  enabled: boolean;
  start: string; // HH:MM 24h
  end: string; // HH:MM
  followSystem: boolean;
}

export interface AccessibilitySettings {
  highContrast: boolean;
  reducedMotion: boolean;
  underlineLinks: boolean;
  colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
}

export interface ReadingModeSettings {
  enabled: boolean;
  fontSize: number; // 80-140 percent
  lineHeight: number; // 1.2 - 2.0
  maxWidth: number; // 600-900
  fontFamily: 'system' | 'serif' | 'sans' | 'dyslexic';
}

export interface PerformanceSettings {
  enableCache: boolean;
  maxElementsPerFrame: number;
  debounceMs: number;
}

export interface Settings {
  schemaVersion: 2;
  enabled: boolean;
  theme: ThemeId;
  /** Percent, see LIMITS. */
  brightness: number;
  contrast: number;
  sepia: number; // legacy alias for warmth, kept for compat
  warmth: number; // 0-60 (replaces sepia in UI, synced with sepia)
  saturation: number; // 0-100
  accentHue: number; // 0-360
  textSize: number; // 80-130
  fontFamily: string;
  siteRules: SiteRules;
  siteThemes: Record<string, ThemeId>;
  siteOverrides: Record<string, SiteOverride>;
  customThemes: CustomTheme[];
  activeCustomThemeId: string | null;
  customCSS: Record<string, string>;
  schedule: ScheduleSettings;
  accessibility: AccessibilitySettings;
  readingMode: ReadingModeSettings;
  performance: PerformanceSettings;
  developerMode: boolean;
  // Compatibility profiles per site
  compatibility: Record<string, CompatibilityMode>;
}

export const SITE_STATUSES = ['active', 'globally-off', 'excluded', 'native-dark', 'waiting-for-system', 'scheduled-off'] as const;
export type SiteStatus = (typeof SITE_STATUSES)[number];

export const COMPATIBILITY_MODES = ['auto', 'aggressive', 'gentle', 'mediaOnly'] as const;
export type CompatibilityMode = (typeof COMPATIBILITY_MODES)[number];
