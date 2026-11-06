import { MAX_CUSTOM_CSS_LENGTH } from './defaults';

/**
 * Conservative custom-CSS validation. NightLens never needs remote resources,
 * so only fragment references and base64 raster data images are accepted in
 * url(). Comments and escapes are rejected to avoid obfuscated-token bypasses.
 * This is a privacy guard, not a sandbox: imported CSS can still alter layout.
 */
export function sanitizeCustomCss(css: string): string {
  if (!css || !css.trim() || css.length > MAX_CUSTOM_CSS_LENGTH) return '';
  if (/[\\\0-\x08\x0b\x0c\x0e-\x1f]/.test(css) || css.includes('/*') || css.includes('*/')) return '';

  const lower = css.toLowerCase();
  const forbidden = ['javascript:', 'expression(', '@import', '@font-face', 'behavior:', '-moz-binding'];
  if (forbidden.some((token) => lower.includes(token))) return '';

  const urlRe = /url\(\s*(['"]?)([^'")]*)\1\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = urlRe.exec(css)) !== null) {
    const target = match[2]!.trim().toLowerCase();
    if (target.startsWith('#')) continue;
    if (/^data:image\/(?:png|gif|jpeg|webp);base64,[a-z0-9+/=\s]+$/.test(target)) continue;
    return '';
  }
  // Also reject malformed/url-like constructs the extractor did not recognize.
  const withoutValidUrls = css.replace(urlRe, '');
  if (/url\s*\(/i.test(withoutValidUrls)) return '';
  return css;
}
