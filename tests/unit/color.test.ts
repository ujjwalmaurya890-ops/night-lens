import { describe, expect, it } from 'vitest';
import { BLACK, WHITE, blend, colorKey, contrastRatio, ensureContrast, hslToRgb, parseColor, relativeLuminance, rgbToHsl, toHex } from '../../src/engine/color';

describe('parseColor', () => {
  it.each([
    ['rgb(255, 0, 0)', { r: 255, g: 0, b: 0, a: 1 }],
    ['rgba(10, 20, 30, 0.5)', { r: 10, g: 20, b: 30, a: 0.5 }],
    ['rgb(10 20 30 / 50%)', { r: 10, g: 20, b: 30, a: 0.5 }],
    ['rgb(100%, 0%, 0%)', { r: 255, g: 0, b: 0, a: 1 }],
    ['#fff', { r: 255, g: 255, b: 255, a: 1 }],
    ['#102030', { r: 16, g: 32, b: 48, a: 1 }],
    ['#10203080', { r: 16, g: 32, b: 48, a: 128 / 255 }],
    ['transparent', { r: 0, g: 0, b: 0, a: 0 }],
    ['WHITE', { r: 255, g: 255, b: 255, a: 1 }],
    ['hsl(0, 100%, 50%)', { r: 255, g: 0, b: 0, a: 1 }],
    ['color(srgb 1 0 0 / 0.25)', { r: 255, g: 0, b: 0, a: 0.25 }],
  ])('parses %s', (input, expected) => {
    const c = parseColor(input)!;
    expect(c).not.toBeNull();
    for (const k of ['r', 'g', 'b', 'a'] as const) expect(c[k]).toBeCloseTo(expected[k], 5);
  });
  it.each(['', 'banana', 'rgb(1,2)', 'rgb(a,b,c)', '#12', '#gggggg', 'color(rec2020 1 0 0)', 'oklch(a b c)', 'lab(1 2)', 'color(srgb 1 1)'])('returns null for %j', (input) => {
    expect(parseColor(input)).toBeNull();
  });
});

describe('modern colour spaces (what Chrome returns for oklch()/lab()/display-p3)', () => {
  const near = (input: string, rgb: [number, number, number], tol = 2) => {
    const c = parseColor(input);
    expect(c, input).not.toBeNull();
    expect(Math.abs(c!.r - rgb[0]), `${input} r=${c!.r}`).toBeLessThanOrEqual(tol);
    expect(Math.abs(c!.g - rgb[1]), `${input} g=${c!.g}`).toBeLessThanOrEqual(tol);
    expect(Math.abs(c!.b - rgb[2]), `${input} b=${c!.b}`).toBeLessThanOrEqual(tol);
  };
  it('oklch/oklab match published reference values', () => {
    near('oklch(1 0 0)', [255, 255, 255]);
    near('oklch(0 0 0)', [0, 0, 0]);
    near('oklch(0.62796 0.25768 29.234)', [255, 0, 0]);   // sRGB red
    near('oklch(0.86644 0.29483 142.495)', [0, 255, 0]);  // sRGB green
    near('oklch(0.45201 0.31321 264.052)', [0, 0, 255]);  // sRGB blue
    near('oklab(0.62796 0.22486 0.12585)', [255, 0, 0]);
    near('oklch(97% 0 0)', [245, 245, 245], 3);
  });
  it('lab/lch (D50) match reference values', () => {
    near('lab(100 0 0)', [255, 255, 255]);
    near('lab(0 0 0)', [0, 0, 0]);
    near('lab(54.29 80.8 69.89)', [255, 0, 0], 3);        // sRGB red expressed in CIE Lab D50
    near('lch(54.29 106.83 40.86)', [255, 0, 0], 3);
  });
  it('color() spaces: srgb, srgb-linear, display-p3', () => {
    near('color(srgb 0.5 0.5 0.5)', [127.5, 127.5, 127.5], 1);
    near('color(srgb-linear 0.2140 0.2140 0.2140)', [128, 128, 128], 1);
    near('color(display-p3 1 1 1)', [255, 255, 255]);
    near('color(display-p3 0 0 0)', [0, 0, 0]);
  });
  it('keeps alpha, supports "none" and percentages', () => {
    expect(parseColor('oklch(0.5 0.1 200 / 0.4)')!.a).toBeCloseTo(0.4, 5);
    expect(parseColor('oklch(0.5 none none)')).not.toBeNull();
    expect(parseColor('oklch(50% 25% 200deg)')).not.toBeNull();
  });
  it('light oklch stays light and dark stays dark (monotonic with L)', () => {
    const lum = (s: string) => relativeLuminance(parseColor(s)!);
    expect(lum('oklch(0.97 0 0)')).toBeGreaterThan(0.85);
    expect(lum('oklch(0.2 0 0)')).toBeLessThan(0.05);
    expect(lum('oklch(0.4 0.1 250)')).toBeLessThan(lum('oklch(0.8 0.1 250)'));
  });
});

describe('conversions', () => {
  it('round-trips rgb<->hsl within rounding for a grid of colours', () => {
    for (let r = 0; r < 256; r += 51) for (let g = 0; g < 256; g += 51) for (let b = 0; b < 256; b += 51) {
      const back = hslToRgb(rgbToHsl({ r, g, b }));
      expect(Math.abs(back.r - r)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.g - g)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.b - b)).toBeLessThanOrEqual(1);
    }
  });
  it('formats hex keys', () => {
    expect(toHex({ r: 1, g: 2, b: 255 })).toBe('0102ff');
    expect(colorKey({ r: 255, g: 255, b: 255, a: 1 })).toBe('ffffff');
    expect(colorKey({ r: 0, g: 0, b: 0, a: 0.5 })).toBe('00000080');
  });
  it('blends alpha over a background', () => {
    expect(blend({ r: 0, g: 0, b: 0, a: 0.5 }, WHITE)).toEqual({ r: 127.5, g: 127.5, b: 127.5 });
  });
});

describe('WCAG contrast', () => {
  it('matches known reference values', () => {
    expect(relativeLuminance(WHITE)).toBeCloseTo(1, 10);
    expect(relativeLuminance(BLACK)).toBe(0);
    expect(contrastRatio(WHITE, BLACK)).toBeCloseTo(21, 10);
    expect(contrastRatio({ r: 0x76, g: 0x76, b: 0x76 }, WHITE)).toBeCloseTo(4.54, 2); // #767676 is the classic AA grey
    expect(contrastRatio({ r: 0x77, g: 0x77, b: 0x77 }, WHITE)).toBeLessThan(4.5);
  });
  it('is symmetric', () => {
    const a = { r: 12, g: 99, b: 200 }, b = { r: 220, g: 210, b: 20 };
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10);
  });
});

describe('ensureContrast', () => {
  it('leaves already-sufficient colours untouched', () => {
    const fg = { r: 230, g: 230, b: 230 };
    expect(ensureContrast(fg, { r: 20, g: 20, b: 20 }, 4.5)).toBe(fg);
  });
  it('always reaches the target when reachable, across a deterministic colour grid', () => {
    let checked = 0;
    for (let i = 0; i < 400; i++) {
      const fg = { r: (i * 53) % 256, g: (i * 97) % 256, b: (i * 193) % 256 };
      const bg = { r: (i * 31) % 256, g: (i * 71) % 256, b: (i * 17) % 256 };
      const out = ensureContrast(fg, bg, 4.5);
      expect(contrastRatio(out, bg)).toBeGreaterThanOrEqual(4.5); // 4.5 is always reachable via white or black
      checked++;
    }
    expect(checked).toBe(400);
  });
  it('falls back to the best extreme when the target is unreachable', () => {
    const mid = { r: 119, g: 119, b: 119 };
    const out = ensureContrast({ r: 120, g: 120, b: 120 }, mid, 7);
    expect([WHITE, BLACK]).toContainEqual(out);
  });
  it('preserves hue when adjusting', () => {
    const out = ensureContrast({ r: 40, g: 40, b: 200 }, { r: 20, g: 20, b: 30 }, 4.5);
    expect(Math.abs(rgbToHsl(out).h - rgbToHsl({ r: 40, g: 40, b: 200 }).h)).toBeLessThan(6);
  });
});
