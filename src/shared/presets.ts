import { LIMITS } from './defaults';
import type { Settings, ThemeId } from './types';

/**
 * Purpose presets: a palette plus the luminance/contrast calibration that makes that palette
 * appropriate for a specific reading situation. They are applied atomically so the UI never
 * shows a half-applied state, and they persist because they only write existing Settings fields.
 */
export const PURPOSE_PRESET_IDS = ['balancedDark', 'deepDark', 'dimReading', 'highContrast', 'softNight'] as const;
export type PurposePresetId = (typeof PURPOSE_PRESET_IDS)[number];

export interface PurposePreset {
  id: PurposePresetId;
  label: string;
  purpose: string;
  theme: ThemeId;
  brightness: number;
  contrast: number;
  warmth: number;
}

const clamp = (value: number, limit: { min: number; max: number }): number =>
  Math.min(limit.max, Math.max(limit.min, Math.round(value)));

export const PURPOSE_PRESETS: readonly PurposePreset[] = [
  {
    id: 'balancedDark',
    label: 'Balanced dark',
    purpose: 'Everyday browsing: neutral midnight surfaces at the default contrast.',
    theme: 'midnight',
    brightness: 100,
    contrast: 100,
    warmth: 0,
  },
  {
    id: 'deepDark',
    label: 'Deep dark',
    purpose: 'Dim rooms and OLED screens: deeper surfaces, slightly lifted text contrast.',
    theme: 'deepSpace',
    brightness: 90,
    contrast: 105,
    warmth: 0,
  },
  {
    id: 'dimReading',
    label: 'Dim reading',
    purpose: 'Long-form reading at night: muted surfaces, gentler contrast, a touch of warmth.',
    theme: 'dim',
    brightness: 85,
    contrast: 90,
    warmth: 15,
  },
  {
    id: 'highContrast',
    label: 'High contrast',
    purpose: 'Low vision and bright environments: 7:1 text floor with emphasised borders.',
    theme: 'highContrast',
    brightness: 100,
    contrast: 120,
    warmth: 0,
  },
  {
    id: 'softNight',
    label: 'Soft night',
    purpose: 'Warm, low-glare surfaces for late sessions when blue light feels harsh.',
    theme: 'softDark',
    brightness: 95,
    contrast: 95,
    warmth: 25,
  },
];

export const PURPOSE_PRESET_BY_ID: Record<PurposePresetId, PurposePreset> = PURPOSE_PRESETS.reduce(
  (acc, preset) => ({ ...acc, [preset.id]: preset }),
  {} as Record<PurposePresetId, PurposePreset>,
);

/** Applies a purpose preset without touching per-site rules, accessibility, or schedule settings. */
export function applyPurposePreset(settings: Settings, id: PurposePresetId): Settings {
  const preset = PURPOSE_PRESET_BY_ID[id];
  if (!preset) return settings;
  const brightness = clamp(preset.brightness, LIMITS.brightness);
  const contrast = clamp(preset.contrast, LIMITS.contrast);
  const warmth = clamp(preset.warmth, LIMITS.warmth);
  return { ...settings, theme: preset.theme, brightness, contrast, warmth, sepia: warmth };
}

/** Returns the preset whose palette and calibration match exactly, or null when customised. */
export function matchPurposePreset(settings: Pick<Settings, 'theme' | 'brightness' | 'contrast' | 'warmth' | 'sepia'>): PurposePresetId | null {
  const warmth = settings.warmth ?? settings.sepia ?? 0;
  const found = PURPOSE_PRESETS.find(
    (preset) =>
      preset.theme === settings.theme &&
      preset.brightness === settings.brightness &&
      preset.contrast === settings.contrast &&
      preset.warmth === warmth,
  );
  return found ? found.id : null;
}

/** Describes the preset for UI copy and tests: label plus the contrast floor it is expected to keep. */
export function purposePresetSummary(): Array<{ id: PurposePresetId; label: string; theme: ThemeId; minTextContrast: 4.5 | 7 }> {
  return PURPOSE_PRESETS.map((preset) => ({
    id: preset.id,
    label: preset.label,
    theme: preset.theme,
    minTextContrast: preset.id === 'highContrast' ? 7 : 4.5,
  }));
}
