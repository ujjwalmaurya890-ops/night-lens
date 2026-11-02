import { toHex } from './color';
import type { ThemeTokens } from './palette';

const hex = (c: Parameters<typeof toHex>[0]): string => `#${toHex(c)}`;

/**
 * Static part of the theme. Per-element colours are added as generated attribute rules by the engine.
 * !important is used so the theme wins over author styles; the engine records every element's
 * original colours before applying anything, and removing the <style> elements restores the page.
 */
export function buildBaseCss(t: ThemeTokens, opts?: { readingMode?: { enabled: boolean; fontSize: number; lineHeight: number; maxWidth: number; fontFamily: string }; customCSS?: string; underlineLinks?: boolean; reduceMotion?: boolean; highContrast?: boolean }): string {
  const c = t.colors;
  const media = t.mediaBrightness < 1 ? `:where(img,video,picture){filter:brightness(${t.mediaBrightness})}` : '';
  const base = [
    `:root{color-scheme:dark !important;--nl-bg:${hex(c.bg)};--nl-bg-raised:${hex(c.bgRaised)};--nl-text:${hex(c.text)};--nl-muted:${hex(c.textMuted)};--nl-link:${hex(c.link)};--nl-visited:${hex(c.linkVisited)};--nl-border:${hex(c.border)};--nl-focus:${hex(c.focus)};--nl-sel-bg:${hex(c.selectionBg)};--nl-sel-fg:${hex(c.selectionText)}}`,
    'html:not([data-nl-ready]){background-color:var(--nl-bg) !important;color:var(--nl-text) !important}',
    'a[data-nl-link]:visited{color:var(--nl-visited) !important}',
    '::placeholder{color:var(--nl-muted) !important;opacity:1 !important}',
    '::selection{background-color:var(--nl-sel-bg);color:var(--nl-sel-fg)}',
    ':where(a,button,input,select,textarea,summary,[tabindex]):focus-visible{outline:2px solid var(--nl-focus);outline-offset:2px}',
    // Code blocks preservation: ensure monospace text stays readable
    ':where(pre,code,kbd,samp){font-variant-ligatures:none}',
    // Table handling
    ':where(table){border-collapse:collapse}',
    // Form controls dark scheme
    ':where(input,select,textarea,button){color-scheme:dark}',
    media,
  ].filter(Boolean).join('\n');

  let extras = '';

  // Reading mode
  if (opts?.readingMode?.enabled) {
    const rm = opts.readingMode;
    const fontMap: Record<string, string> = {
      system: 'system-ui, -apple-system, sans-serif',
      serif: 'Georgia, "Times New Roman", serif',
      sans: '"Inter", system-ui, sans-serif',
      dyslexic: '"OpenDyslexic", "Comic Sans MS", sans-serif',
    };
    extras += `\n/* NightLens Reading Mode */\nbody{max-width:${rm.maxWidth}px !important;margin-left:auto !important;margin-right:auto !important;padding-left:24px !important;padding-right:24px !important}` +
      `\nbody p,body li,body td,body th,body blockquote{line-height:${rm.lineHeight / 100} !important;font-size:${rm.fontSize}% !important}` +
      `\nbody{font-family:${fontMap[rm.fontFamily] ?? fontMap.system} !important}` +
      `\nbody header,body nav,body aside,body .sidebar,body [role="banner"],body .ad,body .ads,body .advertisement{display:none !important}`; // hide distractions
  }

  // Accessibility: underline links
  if (opts?.underlineLinks) {
    extras += '\na[data-nl-link]{text-decoration:underline !important;text-underline-offset:3px !important}';
  }

  // Reduced motion
  if (opts?.reduceMotion) {
    extras += '\n*,*::before,*::after{animation-duration:0.01ms !important;transition-duration:0.01ms !important}';
  }

  // High contrast border emphasis
  if (opts?.highContrast) {
    extras += '\n[data-nl-bt],[data-nl-br],[data-nl-bb],[data-nl-bl]{border-width:1.5px !important}';
  }

  // Custom CSS (validated on input, inserted as-is but scoped)
  if (opts?.customCSS && opts.customCSS.trim()) {
    extras += `\n/* Custom CSS for this site */\n${opts.customCSS}`;
  }

  return base + extras;
}

export function buildReadingModeCss(readingMode: { fontSize: number; lineHeight: number; maxWidth: number; fontFamily: string }): string {
  const fontMap: Record<string, string> = {
    system: 'system-ui, -apple-system, sans-serif',
    serif: 'Georgia, "Times New Roman", serif',
    sans: '"Inter", system-ui, sans-serif',
    dyslexic: '"OpenDyslexic", sans-serif',
  };
  return `body{max-width:${readingMode.maxWidth}px !important;margin:auto !important}` +
    `p,li{line-height:${readingMode.lineHeight / 100} !important;font-size:${readingMode.fontSize}% !important;font-family:${fontMap[readingMode.fontFamily] ?? fontMap.system} !important}`;
}
