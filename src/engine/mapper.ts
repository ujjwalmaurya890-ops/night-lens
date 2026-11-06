import { clamp, hslToRgb, parseColor, rgbToHsl, type RGB, type RGBA } from './color';
import type { ThemeTokens } from './palette';

/** Below this HSL saturation a colour is treated as grey and re-tinted with the theme's neutral hue. */
const NEUTRAL_SAT = 0.12;
const LINK_LIGHTNESS = 0.72;
const LINK_MIN_SAT = 0.7;
const BLUE_HUE_RANGE: [number, number] = [195, 265];
const LINK_HUE = 212;
const COLORED_LINK_MIN_SAT = 0.25;
const COLORED_LINK_MAX_LIGHTNESS = 0.7;
const COLOR_SAT_DAMPING = 0.85;
const COLOR_SAT_CAP = 0.8;
const BORDER_SUBTLE_LIGHTNESS = 0.75;
const BORDER_SUBTLE_OFFSET = 0.12;
const BORDER_STRONG_RANGE = 0.2;

/** Light backgrounds become dark (ordering inverted); dark/saturated brand backgrounds stay dark. */
export function mapBackground(c: RGBA, t: ThemeTokens): RGBA {
  const hsl = rgbToHsl(c);
  const neutral = hsl.s < NEUTRAL_SAT;
  const l = hsl.l > 0.5 ? t.bgL + ((1 - hsl.l) / 0.5) * (t.bgMidL - t.bgL) : Math.min(hsl.l, t.bgMidL);
  const rgb = hslToRgb({
    h: neutral ? t.neutralHue : hsl.h,
    s: neutral ? t.neutralSat : Math.min(hsl.s * COLOR_SAT_DAMPING, COLOR_SAT_CAP),
    l,
  });
  return { ...rgb, a: c.a };
}

/** Dark text becomes light, light text stays light; mid-greys become the muted text tone. */
export function mapForeground(c: RGB, t: ThemeTokens): RGB {
  const hsl = rgbToHsl(c);
  const k = hsl.l <= 0.5 ? hsl.l / 0.5 : (hsl.l - 0.5) / 0.5;
  const l = hsl.l <= 0.5 ? t.textL - k * (t.textL - t.mutedL) : t.mutedL + k * (t.textL - t.mutedL);
  const neutral = hsl.s < NEUTRAL_SAT;
  return hslToRgb({ h: neutral ? t.neutralHue : hsl.h, s: neutral ? t.neutralSat * 0.6 : Math.min(hsl.s, 0.9), l });
}

/** Saturated, not-too-light text colours on <a href> are treated as "link colours". */
export function isColoredLink(c: RGB): boolean {
  const { s, l } = rgbToHsl(c);
  return s >= COLORED_LINK_MIN_SAT && l <= COLORED_LINK_MAX_LIGHTNESS;
}

export function mapLinkColor(c: RGB, t?: ThemeTokens): RGB {
  const hsl = rgbToHsl(c);
  const bluish = hsl.h >= BLUE_HUE_RANGE[0] && hsl.h <= BLUE_HUE_RANGE[1];
  const targetHue = t?.accentHue ?? LINK_HUE;
  return hslToRgb({ h: bluish ? targetHue : hsl.h, s: clamp(Math.max(hsl.s, LINK_MIN_SAT), 0, 1), l: LINK_LIGHTNESS });
}

/** Light borders become subtle; dark borders become clearly visible. Contrast is enforced by the caller. */
export function mapBorder(c: RGB, t: ThemeTokens): RGB {
  const hsl = rgbToHsl(c);
  const base = t.bgL + BORDER_SUBTLE_OFFSET;
  const l = hsl.l >= BORDER_SUBTLE_LIGHTNESS ? base : base + ((BORDER_SUBTLE_LIGHTNESS - hsl.l) / BORDER_SUBTLE_LIGHTNESS) * BORDER_STRONG_RANGE;
  const neutral = hsl.s < NEUTRAL_SAT;
  return hslToRgb({ h: neutral ? t.neutralHue : hsl.h, s: neutral ? t.neutralSat : Math.min(hsl.s * COLOR_SAT_DAMPING, COLOR_SAT_CAP), l });
}

export function mapShadow(c: RGBA, t: ThemeTokens): RGBA {
  const mapped = mapBackground({ ...c, a: 1 }, t);
  return { ...mapped, a: c.a * 0.65 };
}

const CSS_COLOR_RE = /#[\da-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|oklab\([^)]*\)|oklch\([^)]*\)|lab\([^)]*\)|lch\([^)]*\)|color\([^)]*\)/gi;

function serialize(c: RGBA): string {
  const channel = (n: number) => String(Math.round(n));
  return c.a >= 1
    ? `rgb(${channel(c.r)}, ${channel(c.g)}, ${channel(c.b)})`
    : `rgba(${channel(c.r)}, ${channel(c.g)}, ${channel(c.b)}, ${Math.round(c.a * 1000) / 1000})`;
}

function mapCssColors(value: string, t: ThemeTokens, mapper: (c: RGBA, t: ThemeTokens) => RGBA): string {
  return value.replace(CSS_COLOR_RE, (token) => {
    // parseColor is intentionally strict; unknown modern functions stay untouched.
    const parsed = parseColor(token);
    return parsed ? serialize(mapper(parsed, t)) : token;
  });
}

/** Remap literal gradient stops while preserving geometry, direction and color hints. */
export function mapGradient(value: string, t: ThemeTokens): string | null {
  if (!/(?:linear|radial|conic)-gradient\(/i.test(value) || /url\s*\(/i.test(value)) return null;
  if (/[;{}]/.test(value)) return null;
  return mapCssColors(value, t, mapBackground);
}

/** Preserve shadow geometry and inset/spread while softening and darkening its colors. */
export function mapBoxShadow(value: string, t: ThemeTokens): string | null {
  if (!value || value === 'none' || /[;{}]|url\s*\(/i.test(value)) return null;
  return mapCssColors(value, t, mapShadow);
}
