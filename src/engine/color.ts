export interface RGB { r: number; g: number; b: number }
export interface RGBA extends RGB { a: number }
export interface HSL { h: number; s: number; l: number }

export const WHITE: RGB = { r: 255, g: 255, b: 255 };
export const BLACK: RGB = { r: 0, g: 0, b: 0 };
export const TRANSPARENT: RGBA = { r: 0, g: 0, b: 0, a: 0 };

const NAMED: Record<string, RGB> = {
  black: BLACK, white: WHITE, red: { r: 255, g: 0, b: 0 }, blue: { r: 0, g: 0, b: 255 },
  green: { r: 0, g: 128, b: 0 }, gray: { r: 128, g: 128, b: 128 }, grey: { r: 128, g: 128, b: 128 },
};

export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

function channel(token: string): number | null {
  if (token === 'none') return 0;
  const n = parseFloat(token);
  if (!Number.isFinite(n)) return null;
  return clamp(token.endsWith('%') ? (n / 100) * 255 : n, 0, 255);
}
function alpha(token: string | undefined): number | null {
  if (token === undefined) return 1;
  const n = parseFloat(token);
  if (!Number.isFinite(n)) return null;
  return clamp(token.endsWith('%') ? n / 100 : n, 0, 1);
}

function parseHex(s: string): RGBA | null {
  const h = s.slice(1);
  if (!/^[0-9a-f]+$/.test(h)) return null;
  const full = h.length === 3 || h.length === 4 ? [...h].map((c) => c + c).join('') : h;
  if (full.length !== 6 && full.length !== 8) return null;
  const n = (i: number) => parseInt(full.slice(i, i + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: full.length === 8 ? n(6) / 255 : 1 };
}

// ---- wide-gamut / perceptual colour spaces ---------------------------------------------------------------
// getComputedStyle returns oklch()/lab()/color(display-p3 ...) unchanged, so they must be converted to sRGB.
// Out-of-gamut values are clipped by clamping, which is fine for choosing a replacement dark/light tone.

const encodeSrgb = (v: number): number => {
  const c = clamp(v, 0, 1);
  return (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055) * 255;
};
const decodeSrgb = (v: number): number => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
type Vec3 = [number, number, number];
const linearToRgb = ([r, g, b]: Vec3): RGB => ({ r: encodeSrgb(r), g: encodeSrgb(g), b: encodeSrgb(b) });

/** Björn Ottosson's OKLab -> linear sRGB. */
function oklabToRgb(L: number, a: number, b: number): RGB {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return linearToRgb([
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]);
}

const D50: Vec3 = [0.96422, 1, 0.82521];
/** CIE Lab (D50, as used by CSS) -> XYZ(D50) -> linear sRGB (Bradford-adapted matrix). */
function labToRgb(L: number, a: number, b: number): RGB {
  const kappa = 903.2963, eps = 0.008856;
  const fy = (L + 16) / 116, fx = a / 500 + fy, fz = fy - b / 200;
  const xr = fx ** 3 > eps ? fx ** 3 : (116 * fx - 16) / kappa;
  const yr = L > kappa * eps ? fy ** 3 : L / kappa;
  const zr = fz ** 3 > eps ? fz ** 3 : (116 * fz - 16) / kappa;
  const X = xr * D50[0], Y = yr * D50[1], Z = zr * D50[2];
  return linearToRgb([
    3.1338561 * X - 1.6168667 * Y - 0.4906146 * Z,
    -0.9787684 * X + 1.9161415 * Y + 0.033454 * Z,
    0.0719453 * X - 0.2289914 * Y + 1.4052427 * Z,
  ]);
}

const polar = (c: number, hDeg: number): [number, number] => [c * Math.cos((hDeg * Math.PI) / 180), c * Math.sin((hDeg * Math.PI) / 180)];

/** Number or percentage; `pctScale` is what 100% means for this channel. */
function component(token: string, pctScale: number): number | null {
  if (token === 'none') return 0;
  const n = parseFloat(token);
  if (!Number.isFinite(n)) return null;
  return token.endsWith('%') ? (n / 100) * pctScale : n;
}

function parseModernFunction(name: string, parts: string[]): RGBA | null {
  if (parts.length < 3 || parts.length > 4) return null;
  const a = alpha(parts[3]);
  if (a === null) return null;
  const hue = (t: string) => (t === 'none' ? 0 : parseFloat(t)); // "deg" suffix is ignored by parseFloat
  let rgb: RGB;
  if (name === 'oklab' || name === 'oklch') {
    const L = component(parts[0]!, 1), x = component(parts[1]!, 0.4);
    const y = name === 'oklab' ? component(parts[2]!, 0.4) : hue(parts[2]!);
    if (L === null || x === null || y === null || !Number.isFinite(y)) return null;
    const [aa, bb] = name === 'oklab' ? [x, y] : polar(x, y);
    rgb = oklabToRgb(L, aa, bb);
  } else {
    const L = component(parts[0]!, 100), x = component(parts[1]!, 125);
    const y = name === 'lab' ? component(parts[2]!, 125) : hue(parts[2]!);
    if (L === null || x === null || y === null || !Number.isFinite(y)) return null;
    const [aa, bb] = name === 'lab' ? [x, y] : polar(x, y);
    rgb = labToRgb(L, aa, bb);
  }
  return { ...rgb, a };
}

function parseColorFunction(parts: string[]): RGBA | null {
  const space = parts[0];
  if (parts.length < 4 || parts.length > 5) return null;
  const v = [parts[1]!, parts[2]!, parts[3]!].map((p) => component(p, 1));
  const a = alpha(parts[4]);
  if (a === null || v.some((x) => x === null)) return null;
  const [r, g, b] = v as Vec3;
  if (space === 'srgb') return { r: clamp(r * 255, 0, 255), g: clamp(g * 255, 0, 255), b: clamp(b * 255, 0, 255), a };
  if (space === 'srgb-linear') return { ...linearToRgb([r, g, b]), a };
  if (space === 'display-p3') {
    const [R, G, B] = [decodeSrgb(r), decodeSrgb(g), decodeSrgb(b)];
    return { ...linearToRgb([1.2249401 * R - 0.2249404 * G, -0.0420569 * R + 1.0420571 * G, -0.0196376 * R - 0.0786361 * G + 1.0982735 * B]), a };
  }
  return null;
}

/**
 * Parses what getComputedStyle returns in practice: rgb()/rgba() (legacy and space-separated), hex, hsl(),
 * oklab/oklch/lab/lch, color(srgb | srgb-linear | display-p3 ...) and a few names. Anything else returns null so
 * callers can leave that element alone instead of guessing.
 */
export function parseColor(input: string): RGBA | null {
  const s = input.trim().toLowerCase();
  if (s === 'transparent') return { ...TRANSPARENT };
  if (Object.prototype.hasOwnProperty.call(NAMED, s)) return { ...NAMED[s]!, a: 1 };
  if (s.startsWith('#')) return parseHex(s);
  const fn = /^([a-z]+)\((.*)\)$/.exec(s);
  if (!fn) return null;
  const name = fn[1]!;
  const parts = fn[2]!.split(/[\s,/]+/).filter(Boolean);
  if (name === 'rgb' || name === 'rgba') {
    if (parts.length < 3 || parts.length > 4) return null;
    const [r, g, b, a] = [channel(parts[0]!), channel(parts[1]!), channel(parts[2]!), alpha(parts[3])];
    return r === null || g === null || b === null || a === null ? null : { r, g, b, a };
  }
  if (name === 'hsl' || name === 'hsla') {
    if (parts.length < 3 || parts.length > 4) return null;
    const h = parseFloat(parts[0]!);
    const sat = parseFloat(parts[1]!);
    const l = parseFloat(parts[2]!);
    const a = alpha(parts[3]);
    if (![h, sat, l].every(Number.isFinite) || a === null) return null;
    return { ...hslToRgb({ h, s: clamp(sat / 100, 0, 1), l: clamp(l / 100, 0, 1) }), a };
  }
  if (name === 'color') return parseColorFunction(parts);
  if (name === 'oklab' || name === 'oklch' || name === 'lab' || name === 'lch') return parseModernFunction(name, parts);
  return null;
}

const hex2 = (n: number): string => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0');
export const toHex = (c: RGB): string => `${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;
/** 6 hex digits when opaque, otherwise 8 (rrggbbaa). Used as CSS attribute values and rule keys. */
export const colorKey = (c: RGBA): string => (c.a >= 0.999 ? toHex(c) : toHex(c) + hex2(c.a * 255));

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min;
  const l = (max + min) / 2;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === R) h = ((G - B) / d) % 6;
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  return { h: (h * 60 + 360) % 360, s: clamp(s, 0, 1), l };
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  const hh = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = hh < 60 ? [c, x, 0] : hh < 120 ? [x, c, 0] : hh < 180 ? [0, c, x] : hh < 240 ? [0, x, c] : hh < 300 ? [x, 0, c] : [c, 0, x];
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}

/** WCAG 2.x relative luminance (sRGB threshold 0.04045 as in the current spec text). */
export function relativeLuminance({ r, g, b }: RGB): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function blend(fg: RGBA, bg: RGB): RGB {
  return { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) };
}

/**
 * Smallest lightness change (hue/saturation kept) that reaches `min` contrast against `bg`.
 * If that is impossible (e.g. 7:1 on a mid-grey), returns whichever of white/black has more contrast.
 */
export function ensureContrast(fg: RGB, bg: RGB, min: number): RGB {
  if (contrastRatio(fg, bg) >= min) return fg;
  const { h, s, l } = rgbToHsl(fg);
  const lightenFirst = contrastRatio(WHITE, bg) >= contrastRatio(BLACK, bg);
  for (const dir of lightenFirst ? [1, -1] : [-1, 1]) {
    for (let step = 1; step <= 100; step++) {
      const nl = clamp(l + dir * step * 0.01, 0, 1);
      const candidate = hslToRgb({ h, s, l: nl });
      if (contrastRatio(candidate, bg) >= min) return candidate;
      if (nl === 0 || nl === 1) break;
    }
  }
  return contrastRatio(WHITE, bg) >= contrastRatio(BLACK, bg) ? WHITE : BLACK;
}
