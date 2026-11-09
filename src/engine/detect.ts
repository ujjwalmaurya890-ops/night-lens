import { WHITE, blend, parseColor, relativeLuminance } from './color';

/** Pages whose own background is darker than this relative luminance are treated as natively dark. */
export const NATIVE_DARK_LUMINANCE = 0.2;

export type DetectionReason =
  | 'background'
  | 'meta-color-scheme'
  | 'color-scheme'
  | 'color-scheme+system'
  | 'theme-variable'
  | 'light';

export interface Detection { dark: boolean; reason: DetectionReason }

/**
 * Design-system variables that commonly hold the page backdrop. They are only consulted when
 * body/html paint nothing of their own (transparent body over a themed wrapper is very common
 * in Tailwind/shadcn-style apps).
 */
const THEME_BACKGROUND_VARS = [
  '--background',
  '--bg',
  '--background-color',
  '--page-background',
  '--body-bg',
  '--surface',
  '--color-background',
  '--background-base',
];

const isDark = (rgb: Parameters<typeof relativeLuminance>[0]): boolean =>
  relativeLuminance(blend({ ...rgb, a: 1 }, WHITE)) < NATIVE_DARK_LUMINANCE;

function declaredScheme(doc: Document, win: Window): 'dark' | 'light' | 'both' | null {
  const meta = doc.querySelector('meta[name="color-scheme"]');
  const fromMeta = (meta?.getAttribute('content') ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const fromCss = (win.getComputedStyle(doc.documentElement).getPropertyValue('color-scheme') || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const tokens = new Set([...fromMeta, ...fromCss]);
  const dark = tokens.has('dark');
  const light = tokens.has('light');
  if (dark && light) return 'both';
  if (dark) return 'dark';
  if (light) return 'light';
  return null;
}

/**
 * Must be called while NightLens's own styles are detached, so it sees the site's real appearance.
 * Three ordered signals: the painted backdrop, a declared colour scheme (meta or CSS property),
 * then a design-system background variable. Heuristic, not a guarantee; the per-site
 * "force on / exclude" rules cover the cases it gets wrong.
 */
export function detectNativeDark(doc: Document, win: Window): Detection {
  const opaqueBg = (el: Element | null) => {
    if (!el) return null;
    const c = parseColor(win.getComputedStyle(el).backgroundColor || 'transparent');
    return c && c.a > 0.5 ? c : null;
  };
  const bg = opaqueBg(doc.body) ?? opaqueBg(doc.documentElement);
  if (bg) return { dark: isDark(bg), reason: 'background' };

  const scheme = declaredScheme(doc, win);
  if (scheme === 'dark') return { dark: true, reason: 'color-scheme' };
  if (scheme === 'both' && win.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return { dark: true, reason: 'color-scheme+system' };
  }

  // A page that paints nothing but declares a dark design-system backdrop variable is
  // effectively dark; theming it would fight the site's own intent.
  const rootStyle = win.getComputedStyle(doc.documentElement);
  for (const name of THEME_BACKGROUND_VARS) {
    const value = rootStyle.getPropertyValue(name);
    if (!value) continue;
    const parsed = parseColor(value);
    if (parsed && parsed.a > 0.5) {
      const dark = isDark(parsed);
      // The first opaque themed backdrop decides, exactly like a painted background would.
      return dark ? { dark: true, reason: 'theme-variable' } : { dark: false, reason: 'light' };
    }
  }
  return { dark: false, reason: 'light' };
}
