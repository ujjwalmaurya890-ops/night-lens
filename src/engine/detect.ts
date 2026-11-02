import { WHITE, blend, parseColor, relativeLuminance } from './color';

/** Pages whose own background is darker than this relative luminance are treated as natively dark. */
export const NATIVE_DARK_LUMINANCE = 0.2;

export interface Detection { dark: boolean; reason: 'background' | 'color-scheme' | 'color-scheme+system' | 'light' }

/**
 * Must be called while NightLens's own styles are detached, so it sees the site's real appearance.
 * Heuristic, not a guarantee; the per-site "force on / exclude" rules cover the cases it gets wrong.
 */
export function detectNativeDark(doc: Document, win: Window): Detection {
  const opaqueBg = (el: Element | null) => {
    if (!el) return null;
    const c = parseColor(win.getComputedStyle(el).backgroundColor || 'transparent');
    return c && c.a > 0.5 ? c : null;
  };
  const bg = opaqueBg(doc.body) ?? opaqueBg(doc.documentElement);
  if (bg) {
    return { dark: relativeLuminance(blend(bg, WHITE)) < NATIVE_DARK_LUMINANCE, reason: 'background' };
  }
  const scheme = (win.getComputedStyle(doc.documentElement).getPropertyValue('color-scheme') || '').toLowerCase().split(/\s+/);
  if (scheme.includes('dark') && !scheme.includes('light')) return { dark: true, reason: 'color-scheme' };
  if (scheme.includes('dark') && scheme.includes('light') && win.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return { dark: true, reason: 'color-scheme+system' };
  }
  return { dark: false, reason: 'light' };
}
