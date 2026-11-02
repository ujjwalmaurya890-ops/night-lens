import { MAX_CUSTOM_CSS_LENGTH } from './defaults';

/**
 * Sanitizes user-supplied per-site custom CSS before it is injected into a page.
 * Privacy-first: the page must never be able to trigger an external network request
 * through NightLens, so remote url() references, @import, @font-face, javascript:
 * and expression() are all rejected. Only inline data: URLs and SVG fragment refs
 * (url(#id)) are allowed.
 */
export function sanitizeCustomCss(css: string): string {
  if (!css || !css.trim()) return '';
  if (css.length > MAX_CUSTOM_CSS_LENGTH) return '';
  const lower = css.toLowerCase();
  if (lower.includes('javascript:') || lower.includes('expression(') || lower.includes('@import') || lower.includes('@font-face') || lower.includes('behavior:') || lower.includes('-moz-binding')) return '';
  // Block url() unless it is a data: URI or an in-document fragment reference.
  const urlRe = /url\(\s*(['"]?)([^'")]*)\1\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(css)) !== null) {
    const target = m[2]!.trim().toLowerCase();
    if (target.startsWith('data:') || target.startsWith('#')) continue;
    return '';
  }
  return css.slice(0, MAX_CUSTOM_CSS_LENGTH);
}
