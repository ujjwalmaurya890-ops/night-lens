import { afterEach, describe, expect, it } from 'vitest';
import { detectNativeDark, NATIVE_DARK_LUMINANCE } from '../../src/engine/detect';
import { relativeLuminance, WHITE } from '../../src/engine/color';

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('style');
  document.body.removeAttribute('style');
});

const detect = () => detectNativeDark(document, window);

describe('native-dark detection heuristics', () => {
  it('uses the painted body background first', () => {
    document.body.setAttribute('style', 'background-color:#0d1117');
    expect(detect()).toEqual({ dark: true, reason: 'background' });
    document.body.setAttribute('style', 'background-color:#ffffff');
    expect(detect()).toEqual({ dark: false, reason: 'background' });
  });

  it('falls back to <html> when the body paints nothing', () => {
    document.documentElement.setAttribute('style', 'background-color:#101214');
    expect(detect()).toEqual({ dark: true, reason: 'background' });
  });

  it('honours a dark <meta name="color-scheme"> on a transparent page', () => {
    document.head.innerHTML = '<meta name="color-scheme" content="dark">';
    expect(detect()).toEqual({ dark: true, reason: 'color-scheme' });
  });

  it('honours the CSS color-scheme property', () => {
    document.documentElement.setAttribute('style', 'color-scheme: dark');
    expect(detect()).toEqual({ dark: true, reason: 'color-scheme' });
  });

  it('treats "dark light" as system-dependent', () => {
    document.documentElement.setAttribute('style', 'color-scheme: dark light');
    // jsdom's matchMedia stub reports no dark preference by default.
    expect(detect()).toEqual({ dark: false, reason: 'light' });
  });

  it('recognises a dark design-system backdrop variable', () => {
    document.documentElement.setAttribute('style', '--background: #0b0d12');
    expect(detect()).toEqual({ dark: true, reason: 'theme-variable' });
  });

  it('recognises a light design-system backdrop variable and stops there', () => {
    document.documentElement.setAttribute('style', '--background: #ffffff; --surface: #0b0d12');
    expect(detect()).toEqual({ dark: false, reason: 'light' });
  });

  it('ignores variables that are not colours', () => {
    document.documentElement.setAttribute('style', '--bg: var(--nope)');
    expect(detect()).toEqual({ dark: false, reason: 'light' });
  });

  it('exposes a dark threshold consistent with its own luminance helper', () => {
    const grey = Math.round(255 * Math.sqrt(NATIVE_DARK_LUMINANCE) * 1.3);
    expect(relativeLuminance({ r: grey, g: grey, b: grey })).toBeLessThan(relativeLuminance(WHITE));
  });
});
