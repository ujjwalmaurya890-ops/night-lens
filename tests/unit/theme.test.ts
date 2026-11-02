import { describe, expect, it } from 'vitest';
import { WHITE, contrastRatio, relativeLuminance, rgbToHsl } from '../../src/engine/color';
import { isColoredLink, mapBackground, mapBorder, mapForeground, mapLinkColor } from '../../src/engine/mapper';
import { buildTokens } from '../../src/engine/palette';
import { buildBaseCss } from '../../src/engine/styles';
import { LIMITS, cloneDefaults } from '../../src/shared/defaults';
import { THEME_IDS } from '../../src/shared/types';

const extremes = (l: { min: number; max: number; default: number }) => [l.min, l.default, l.max];

describe('palette tokens meet their contrast targets for every theme and slider extreme', () => {
  for (const theme of THEME_IDS) for (const brightness of extremes(LIMITS.brightness)) for (const contrast of extremes(LIMITS.contrast)) for (const sepia of extremes(LIMITS.sepia)) {
    it(`${theme} b${brightness} c${contrast} s${sepia}`, () => {
      const t = buildTokens({ theme, brightness, contrast, sepia });
      const { colors: c } = t;
      for (const surface of [c.bg, c.bgRaised]) {
        expect(contrastRatio(c.text, surface)).toBeGreaterThanOrEqual(t.minTextContrast);
        expect(contrastRatio(c.textMuted, surface)).toBeGreaterThanOrEqual(t.minTextContrast);
        expect(contrastRatio(c.link, surface)).toBeGreaterThanOrEqual(t.minTextContrast);
        expect(contrastRatio(c.linkVisited, surface)).toBeGreaterThanOrEqual(t.minTextContrast);
        expect(contrastRatio(c.focus, surface)).toBeGreaterThanOrEqual(3);
      }
      expect(contrastRatio(c.border, c.bgRaised)).toBeGreaterThanOrEqual(t.minBorderContrast);
      expect(contrastRatio(c.selectionText, c.selectionBg)).toBeGreaterThanOrEqual(4.5);
    });
  }
  it('default background is charcoal, not pure black; text is soft white', () => {
    const t = buildTokens(cloneDefaults());
    expect(relativeLuminance(t.colors.bg)).toBeGreaterThan(0.005);
    expect(relativeLuminance(t.colors.bg)).toBeLessThan(0.05);
    expect(relativeLuminance(t.colors.text)).toBeLessThan(1);
    expect(relativeLuminance(t.colors.text)).toBeGreaterThan(0.6);
  });
  it('high contrast is stricter than balanced; system uses the balanced palette', () => {
    expect(buildTokens({ ...cloneDefaults(), theme: 'highContrast' }).minTextContrast).toBe(7);
    expect(buildTokens({ ...cloneDefaults(), theme: 'system' }).preset).toBe('balanced');
  });
  it('sepia shifts the palette warmer', () => {
    const cool = buildTokens(cloneDefaults()).colors.bg;
    const warm = buildTokens({ ...cloneDefaults(), sepia: 60 }).colors.bg;
    expect(warm.r - warm.b).toBeGreaterThan(cool.r - cool.b); // more red than blue = warmer
    expect(rgbToHsl(warm).h).toBeLessThan(80); // lands on the orange/yellow side, not magenta/green
  });
  it('dim theme dims media; balanced does not', () => {
    expect(buildBaseCss(buildTokens({ ...cloneDefaults(), theme: 'dim' }))).toContain('brightness(0.88)');
    expect(buildBaseCss(buildTokens(cloneDefaults()))).not.toContain('brightness(');
  });
});

describe('colour mapping', () => {
  const t = buildTokens(cloneDefaults());
  it('maps white backgrounds to the theme background', () => {
    expect(mapBackground({ r: 255, g: 255, b: 255, a: 1 }, t)).toMatchObject({ ...t.colors.bg, a: 1 });
  });
  it('keeps dark backgrounds dark and light ones dark', () => {
    for (const v of [0, 40, 128, 200, 245, 255]) expect(relativeLuminance(mapBackground({ r: v, g: v, b: v, a: 1 }, t))).toBeLessThan(0.15);
  });
  it('preserves alpha and hue of coloured backgrounds', () => {
    const out = mapBackground({ r: 30, g: 100, b: 220, a: 0.4 }, t);
    expect(out.a).toBe(0.4);
    expect(Math.abs(rgbToHsl(out).h - rgbToHsl({ r: 30, g: 100, b: 220 }).h)).toBeLessThan(8);
  });
  it('turns dark text light and keeps light text light', () => {
    expect(relativeLuminance(mapForeground({ r: 0, g: 0, b: 0 }, t))).toBeGreaterThan(0.5);
    expect(relativeLuminance(mapForeground({ r: 255, g: 255, b: 255 }, t))).toBeGreaterThan(0.5);
    expect(contrastRatio(mapForeground({ r: 102, g: 102, b: 102 }, t), t.colors.bg)).toBeGreaterThan(4.5);
  });
  it('recognises coloured links and maps the default blue to a readable accent', () => {
    expect(isColoredLink({ r: 0, g: 0, b: 238 })).toBe(true);
    expect(isColoredLink({ r: 20, g: 20, b: 20 })).toBe(false);
    expect(contrastRatio(mapLinkColor({ r: 0, g: 0, b: 238 }), t.colors.bg)).toBeGreaterThan(4.5);
  });
  it('makes light borders subtle and dark borders visible', () => {
    const light = contrastRatio(mapBorder({ r: 221, g: 221, b: 221 }, t), t.colors.bg);
    const dark = contrastRatio(mapBorder({ r: 0, g: 0, b: 0 }, t), t.colors.bg);
    expect(dark).toBeGreaterThan(light);
    expect(light).toBeGreaterThan(1.2);
  });
  it('white-on-white is impossible after mapping: any text/bg pair becomes readable via ensureContrast in the engine', () => {
    expect(contrastRatio(mapForeground(WHITE, t), mapBackground({ ...WHITE, a: 1 }, t))).toBeGreaterThan(4.5);
  });
});
