import { LIMITS } from '../shared/defaults';
import type { CustomTheme, Settings } from '../shared/types';
import { clamp, ensureContrast, hslToRgb, parseColor, rgbToHsl, toHex, type RGB } from './color';

interface PresetSpec {
  bgL: number; bgMidL: number; textL: number; mutedL: number; hue: number; sat: number;
  minText: number; minBorder: number; mediaBrightness: number;
}

export const PRESETS: Record<string, PresetSpec> = {
  // Legacy (kept for backward compat + tests)
  balanced: { bgL: 0.115, bgMidL: 0.34, textL: 0.9, mutedL: 0.68, hue: 225, sat: 0.08, minText: 4.5, minBorder: 1.5, mediaBrightness: 1 },
  highContrast: { bgL: 0.04, bgMidL: 0.22, textL: 1, mutedL: 0.86, hue: 225, sat: 0.04, minText: 7, minBorder: 3, mediaBrightness: 1 },
  dim: { bgL: 0.17, bgMidL: 0.38, textL: 0.8, mutedL: 0.64, hue: 225, sat: 0.07, minText: 4.5, minBorder: 1.5, mediaBrightness: 0.88 },

  // Premium themes
  midnight: { bgL: 0.08, bgMidL: 0.24, textL: 0.92, mutedL: 0.72, hue: 225, sat: 0.10, minText: 4.5, minBorder: 1.5, mediaBrightness: 1 },
  deepSpace: { bgL: 0.09, bgMidL: 0.28, textL: 0.91, mutedL: 0.70, hue: 235, sat: 0.14, minText: 4.5, minBorder: 1.5, mediaBrightness: 1 },
  amoled: { bgL: 0.02, bgMidL: 0.16, textL: 0.98, mutedL: 0.84, hue: 240, sat: 0.03, minText: 7, minBorder: 3, mediaBrightness: 1 },
  softDark: { bgL: 0.14, bgMidL: 0.36, textL: 0.88, mutedL: 0.66, hue: 30, sat: 0.06, minText: 4.5, minBorder: 1.5, mediaBrightness: 0.96 },
  charcoal: { bgL: 0.11, bgMidL: 0.30, textL: 0.90, mutedL: 0.69, hue: 30, sat: 0.04, minText: 4.5, minBorder: 1.5, mediaBrightness: 1 },
  graphite: { bgL: 0.13, bgMidL: 0.33, textL: 0.90, mutedL: 0.71, hue: 220, sat: 0.05, minText: 4.5, minBorder: 1.5, mediaBrightness: 1 },
  solarized: { bgL: 0.10, bgMidL: 0.28, textL: 0.88, mutedL: 0.70, hue: 195, sat: 0.11, minText: 4.5, minBorder: 1.5, mediaBrightness: 1 },
  nord: { bgL: 0.12, bgMidL: 0.30, textL: 0.89, mutedL: 0.72, hue: 220, sat: 0.10, minText: 4.5, minBorder: 1.5, mediaBrightness: 1 },
  dracula: { bgL: 0.10, bgMidL: 0.26, textL: 0.93, mutedL: 0.76, hue: 265, sat: 0.12, minText: 4.5, minBorder: 1.8, mediaBrightness: 1 },
  oledNight: { bgL: 0.03, bgMidL: 0.18, textL: 0.96, mutedL: 0.82, hue: 230, sat: 0.05, minText: 7, minBorder: 3, mediaBrightness: 1 },

  // System uses midnight as base but will be switched by decision
  system: { bgL: 0.115, bgMidL: 0.34, textL: 0.9, mutedL: 0.68, hue: 225, sat: 0.08, minText: 4.5, minBorder: 1.5, mediaBrightness: 1 },
  custom: { bgL: 0.10, bgMidL: 0.30, textL: 0.90, mutedL: 0.70, hue: 225, sat: 0.08, minText: 4.5, minBorder: 1.5, mediaBrightness: 1 },
};

export const PREMIUM_THEME_META: Record<string, { label: string; description: string; preview: { bg: string; text: string; accent: string } }> = {
  midnight: { label: 'Midnight', description: 'Deep blue-black, balanced contrast', preview: { bg: '#14171d', text: '#e8eaf0', accent: '#7ab7ff' } },
  deepSpace: { label: 'Deep Space', description: 'Rich indigo darkness', preview: { bg: '#181b26', text: '#e6e8f2', accent: '#8b9cf0' } },
  amoled: { label: 'AMOLED', description: 'Near-black palette with maximum contrast', preview: { bg: '#050505', text: '#ffffff', accent: '#7ab7ff' } },
  softDark: { label: 'Soft Dark', description: 'Warm charcoal, gentle on eyes', preview: { bg: '#1e1c1a', text: '#e8e0d8', accent: '#ffb86b' } },
  charcoal: { label: 'Charcoal', description: 'Neutral professional gray', preview: { bg: '#1c1c1e', text: '#eaeaeb', accent: '#a7abb4' } },
  graphite: { label: 'Graphite', description: 'Cool medium-dark gray', preview: { bg: '#1f2125', text: '#ececee', accent: '#9aa3b8' } },
  solarized: { label: 'Solarized', description: 'Scientific precision, muted tones', preview: { bg: '#002b36', text: '#839496', accent: '#268bd2' } },
  nord: { label: 'Nord', description: 'Arctic inspired, frosted blues', preview: { bg: '#2e3440', text: '#eceff4', accent: '#88c0d0' } },
  dracula: { label: 'Dracula', description: 'Vibrant purple twilight', preview: { bg: '#282a36', text: '#f8f8f2', accent: '#bd93f9' } },
  oledNight: { label: 'OLED Night', description: 'True black with crisp highlights', preview: { bg: '#050508', text: '#f0f0f5', accent: '#7ab7ff' } },
  balanced: { label: 'Balanced', description: 'Original NightLens default', preview: { bg: '#17181b', text: '#ececee', accent: '#7ab7ff' } },
  highContrast: { label: 'High Contrast', description: 'WCAG AAA, maximum readability', preview: { bg: '#0a0a0a', text: '#ffffff', accent: '#ffd54a' } },
  dim: { label: 'Dim', description: 'Low brightness, late night reading', preview: { bg: '#252830', text: '#d0d2d6', accent: '#7ab7ff' } },
};

const SEPIA_HUE = 35;
const RAISED_OFFSET = 0.045;
const BORDER_OFFSET = 0.14;
const MIN_FOCUS_CONTRAST = 3;
const MIN_DISABLED_CONTRAST = 3;
const MIN_CONTROL_BORDER_CONTRAST = 3;

export interface ThemeTokens {
  preset: string;
  minTextContrast: number;
  minBorderContrast: number;
  minControlBorderContrast: number;
  minDisabledContrast: number;
  neutralHue: number;
  neutralSat: number;
  bgL: number;
  bgMidL: number;
  textL: number;
  mutedL: number;
  mediaBrightness: number;
  colors: Record<'bg' | 'bgRaised' | 'text' | 'textMuted' | 'link' | 'linkVisited' | 'border' | 'focus' | 'selectionBg' | 'selectionText', RGB>;
  accentHue?: number;
  customId?: string;
}

const SEPIA_SAT_BOOST = 0.2;

function neutralTint(baseHue: number, baseSat: number, warmth: number): { hue: number; sat: number } {
  const cool = hslToRgb({ h: baseHue, s: baseSat, l: 0.5 });
  const warm = hslToRgb({ h: SEPIA_HUE, s: baseSat + SEPIA_SAT_BOOST, l: 0.5 });
  const mix = { r: cool.r + (warm.r - cool.r) * warmth, g: cool.g + (warm.g - cool.g) * warmth, b: cool.b + (warm.b - cool.b) * warmth };
  const { h, s } = rgbToHsl(mix);
  return warmth === 0 ? { hue: baseHue, sat: baseSat } : { hue: h, sat: s };
}

export function resolvePreset(theme: Settings['theme']): string {
  if (theme === 'system') return 'balanced';
  if (theme === 'custom') return 'custom';
  return theme;
}

function hexToRgb(hex: string): RGB | null {
  const c = parseColor(hex);
  if (!c) return null;
  return { r: c.r, g: c.g, b: c.b };
}

function buildCustomTokens(custom: CustomTheme, settings: Pick<Settings, 'brightness' | 'contrast' | 'sepia'> & Partial<Pick<Settings, 'warmth'>>): ThemeTokens | null {
  const bgRgb = hexToRgb(custom.bg);
  const textRgb = hexToRgb(custom.text);
  const bgRaisedRgb = hexToRgb(custom.bgRaised);
  const textMutedRgb = hexToRgb(custom.textMuted);
  const accentRgb = hexToRgb(custom.accent);
  const linkRgb = hexToRgb(custom.link);
  const borderRgb = hexToRgb(custom.border);
  if (!bgRgb || !textRgb) return null;

  const bgHsl = rgbToHsl(bgRgb);
  const customWarmth = clamp(settings.warmth ?? settings.sepia, LIMITS.warmth.min, LIMITS.warmth.max) / 100;
  const neutral = neutralTint(bgHsl.h, bgHsl.s, customWarmth);
  const f = clamp(settings.brightness, LIMITS.brightness.min, LIMITS.brightness.max) / 100;
  const c = clamp(settings.contrast, LIMITS.contrast.min, LIMITS.contrast.max) / 100;

  // Adjust lightness by brightness factor
  const bgL = clamp(bgHsl.l * f, 0.02, 0.3);
  const textHsl = rgbToHsl(textRgb);
  const textL = clamp(bgL + (textHsl.l - bgHsl.l + 0.5) * c, 0.5, 1);

  const bg = hslToRgb({ h: neutral.hue, s: neutral.sat, l: bgL });
  const raisedHsl = bgRaisedRgb ? rgbToHsl(bgRaisedRgb) : bgHsl;
  const raisedTint = neutralTint(raisedHsl.h, raisedHsl.s, customWarmth);
  const bgRaised = hslToRgb({ h: raisedTint.hue, s: raisedTint.sat, l: Math.min(bgL + RAISED_OFFSET, 0.35) });
  const text = ensureContrast(bgRaised && textHsl ? hslToRgb({ h: textHsl.h, s: textHsl.s, l: textL }) : textRgb, bgRaised, 4.5);
  const textMuted = textMutedRgb ? ensureContrast(textMutedRgb, bgRaised, 4.5) : ensureContrast(hslToRgb({ h: textHsl.h, s: textHsl.s * 0.7, l: textL - 0.12 }), bgRaised, 4.5);
  const link = linkRgb ? ensureContrast(linkRgb, bgRaised, 4.5) : ensureContrast(accentRgb ?? hslToRgb({ h: 212, s: 0.95, l: 0.72 }), bgRaised, 4.5);
  const linkVisited = ensureContrast(hslToRgb({ h: 268, s: 0.75, l: 0.78 }), bgRaised, 4.5);
  const border = borderRgb ? ensureContrast(borderRgb, bgRaised, 1.5) : ensureContrast(hslToRgb({ h: bgHsl.h, s: bgHsl.s, l: bgL + BORDER_OFFSET }), bgRaised, 1.5);
  const focus = ensureContrast(hslToRgb({ h: 45, s: 0.95, l: 0.62 }), bgRaised, MIN_FOCUS_CONTRAST);
  const selectionBg = accentRgb ?? hslToRgb({ h: 212, s: 0.7, l: 0.35 });
  const selectionText = ensureContrast(text, selectionBg, 4.5);

  return {
    preset: 'custom',
    minTextContrast: 4.5,
    minBorderContrast: 1.5,
    minControlBorderContrast: MIN_CONTROL_BORDER_CONTRAST,
    minDisabledContrast: MIN_DISABLED_CONTRAST,
    neutralHue: neutral.hue,
    neutralSat: neutral.sat,
    bgL,
    bgMidL: clamp(bgL + 0.18, bgL + 0.08, 0.5),
    textL,
    mutedL: textL - 0.12,
    mediaBrightness: 1,
    colors: { bg, bgRaised, text, textMuted, link, linkVisited, border, focus, selectionBg, selectionText },
    customId: custom.id,
  };
}

export function buildTokens(
  s: Pick<Settings, 'theme' | 'brightness' | 'contrast' | 'sepia'> & Partial<Pick<Settings, 'warmth' | 'saturation' | 'accentHue'>> & { customThemes?: CustomTheme[]; activeCustomThemeId?: string | null }
): ThemeTokens {
  // Handle custom theme
  if (s.theme === 'custom' && s.customThemes && s.activeCustomThemeId) {
    const custom = s.customThemes.find((c) => c.id === s.activeCustomThemeId);
    if (custom) {
      const ct = buildCustomTokens(custom, s);
      if (ct) return ct;
    }
  }

  const presetName = resolvePreset(s.theme);
  const p = PRESETS[presetName] ?? PRESETS['midnight']!;
  const f = clamp(s.brightness, LIMITS.brightness.min, LIMITS.brightness.max) / 100;
  const c = clamp(s.contrast, LIMITS.contrast.min, LIMITS.contrast.max) / 100;
  // Warmth: handle legacy sepia param – if sepia and warmth differ, prefer the non-default one (test compat)
  const rawWarmth = s.warmth;
  const rawSepia = s.sepia;
  let warmthVal: number;
  if (rawWarmth !== undefined && rawSepia !== undefined && rawWarmth !== rawSepia) {
    // Legacy test sets sepia=60 but warmth stays 0 (default). Use the higher / non-default.
    warmthVal = rawSepia !== LIMITS.sepia.default && rawWarmth === LIMITS.warmth.default ? rawSepia : rawWarmth;
  } else {
    warmthVal = rawWarmth ?? rawSepia ?? 0;
  }
  const sep = clamp(warmthVal, LIMITS.warmth.min, LIMITS.warmth.max) / 100;
  const satFactor = clamp(s.saturation ?? 50, LIMITS.saturation.min, LIMITS.saturation.max) / 50; // 1.0 = default, 0 = desaturated, 2x = saturated
  const accentHue = s.accentHue ?? p.hue;

  const bgL = clamp(p.bgL * f, 0.02, 0.3);
  const bgMidL = clamp(p.bgMidL * f, bgL + 0.08, 0.5);
  const textTarget = clamp(p.textL + (f - 1) * 0.1, 0.7, 1);
  const mutedTarget = clamp(p.mutedL + (f - 1) * 0.1, 0.55, 0.95);
  const textL = clamp(bgL + (textTarget - bgL) * c, 0.6, 1);
  const mutedL = Math.min(clamp(bgL + (mutedTarget - bgL) * c, 0.5, 1), textL);
  const { hue, sat } = neutralTint(p.hue, p.sat, sep);

  // Apply saturation factor to neutral
  const adjustedSat = clamp(sat * satFactor, 0, 0.5);

  const bg = hslToRgb({ h: hue, s: adjustedSat, l: bgL });
  const bgRaised = hslToRgb({ h: hue, s: adjustedSat, l: bgL + RAISED_OFFSET });
  const text = ensureContrast(hslToRgb({ h: hue, s: adjustedSat * 0.6, l: textL }), bgRaised, p.minText);
  const textMuted = ensureContrast(hslToRgb({ h: hue, s: adjustedSat * 0.6, l: mutedL }), bgRaised, p.minText);

  // Link color uses accentHue
  const linkHsl = { h: accentHue, s: clamp(0.95 * satFactor, 0, 1), l: 0.72 };
  const link = ensureContrast(hslToRgb(linkHsl), bgRaised, p.minText);
  const linkVisited = ensureContrast(hslToRgb({ h: (accentHue + 56) % 360, s: clamp(0.75 * satFactor, 0, 1), l: 0.78 }), bgRaised, p.minText);
  const border = ensureContrast(hslToRgb({ h: hue, s: adjustedSat, l: bgL + BORDER_OFFSET }), bgRaised, p.minBorder);
  const focus = ensureContrast(hslToRgb({ h: 45, s: clamp(0.95 * satFactor, 0, 1), l: 0.62 }), bgRaised, MIN_FOCUS_CONTRAST);
  const selectionBg = hslToRgb({ h: accentHue, s: 0.7, l: 0.35 });
  const selectionText = ensureContrast(text, selectionBg, 4.5);

  return {
    preset: presetName,
    minTextContrast: p.minText,
    minBorderContrast: p.minBorder,
    minControlBorderContrast: MIN_CONTROL_BORDER_CONTRAST,
    minDisabledContrast: MIN_DISABLED_CONTRAST,
    neutralHue: hue,
    neutralSat: adjustedSat,
    bgL,
    bgMidL,
    textL,
    mutedL,
    mediaBrightness: p.mediaBrightness,
    accentHue,
    colors: { bg, bgRaised, text, textMuted, link, linkVisited, border, focus, selectionBg, selectionText },
  };
}

// Helper for UI previews
export function themePreviewColors(themeId: string): { bg: string; bgRaised: string; text: string; accent: string } {
  const meta = PREMIUM_THEME_META[themeId];
  if (meta) return { bg: meta.preview.bg, bgRaised: meta.preview.bg, text: meta.preview.text, accent: meta.preview.accent };
  // For legacy, generate via tokens
  try {
    const t = buildTokens({ theme: themeId as any, brightness: 100, contrast: 100, sepia: 0, warmth: 0, saturation: 50, accentHue: 225 });
    return { bg: `#${toHex(t.colors.bg)}`, bgRaised: `#${toHex(t.colors.bgRaised)}`, text: `#${toHex(t.colors.text)}`, accent: `#${toHex(t.colors.link)}` };
  } catch {
    return { bg: '#14171d', text: '#e8eaf0', accent: '#7ab7ff', bgRaised: '#1c1f26' };
  }
}
