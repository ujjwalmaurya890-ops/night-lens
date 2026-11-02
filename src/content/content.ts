import { ThemeEngine, type EngineStatus } from '../engine/engine';
import { buildTokens } from '../engine/palette';
import { decide, getEffectiveSettings } from '../shared/decision';
import { normalizeHostname } from '../shared/hostname';
import { STATUS_CHANGED, isGetStatusMessage, type StatusChangedMessage, type StatusPayload } from '../shared/messages';
import { loadSettings, subscribeToSettings } from '../shared/storage';
import { cloneDefaults } from '../shared/defaults';
import type { Settings, SiteStatus } from '../shared/types';

/** Site identity for rules: the top-level page's hostname when it can be determined (so iframes follow their page). */
export function getSiteHostname(loc: Location = location): string | null {
  try {
    const origins = (loc as Location & { ancestorOrigins?: ArrayLike<string> }).ancestorOrigins;
    if (origins && origins.length > 0) return normalizeHostname(new URL(origins[origins.length - 1]!).hostname);
  } catch { /* opaque origin: fall through */ }
  return normalizeHostname(loc.hostname);
}

// Custom CSS validation
function sanitizeCustomCSS(css: string): string {
  if (!css || !css.trim()) return '';
  // Block dangerous patterns
  const lower = css.toLowerCase();
  if (lower.includes('javascript:') || lower.includes('expression(')) return '';
  // Limit size
  if (css.length > 20000) return css.slice(0, 20000);
  return css;
}

export function startContentScript(): void {
  const w = window as unknown as { __nightlensLoaded?: boolean };
  if (w.__nightlensLoaded) return;
  w.__nightlensLoaded = true;

  const isTop = window.top === window;
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  let settings: Settings = cloneDefaults();
  let loaded = false;
  let siteStatus: SiteStatus = 'globally-off';
  let siteMode: StatusPayload['siteMode'] = null;

  const payload = (): StatusPayload => ({ hostname: getSiteHostname(), status: siteStatus, siteMode });

  const setStatus = (status: SiteStatus): void => {
    if (status === siteStatus) return;
    siteStatus = status;
    if (!isTop) return;
    const message: StatusChangedMessage = { type: STATUS_CHANGED, ...payload() };
    chrome.runtime.sendMessage(message).catch(() => undefined);
  };

  const engine = new ThemeEngine(document, window, {
    onStatus: (s: EngineStatus) => setStatus(s === 'active' ? 'active' : 'native-dark'),
    onStats: (stats) => {
      if (settings.developerMode) {
        console.debug('[NightLens] Engine stats', stats);
      }
    },
  });

  const apply = (): void => {
    if (!loaded) return;
    const hostname = getSiteHostname();
    const effective = getEffectiveSettings(settings, hostname);
    const decision = decide(effective, hostname, darkQuery.matches);

    siteMode = decision.siteMode;

    if (!decision.active) {
      engine.stop();
      // Map scheduled-off to a user-friendly status
      const statusMap: Record<string, SiteStatus> = {
        'scheduled-off': 'waiting-for-system' as SiteStatus,
      };
      const status = (decision as any).status;
      setStatus((statusMap[status] as SiteStatus) ?? (status as SiteStatus));
      return;
    }

    // Determine effective theme (per-site override)
    let tokens: ReturnType<typeof buildTokens>;
    try {
      const effThemeSettings: any = {
        theme: effective.theme,
        brightness: effective.brightness,
        contrast: effective.contrast,
        sepia: effective.sepia,
        warmth: effective.warmth,
        saturation: effective.saturation,
        accentHue: effective.accentHue,
        customThemes: effective.customThemes,
        activeCustomThemeId: effective.activeCustomThemeId,
      };
      tokens = buildTokens(effThemeSettings);
    } catch {
      tokens = buildTokens(settings as any);
    }

    const customCSS = hostname ? settings.customCSS[hostname] : undefined;
    const sanitizedCSS = customCSS ? sanitizeCustomCSS(customCSS) : undefined;

    const config: any = {
      tokens,
      skipNativeDarkCheck: decision.forceNative,
      readingMode: effective.readingMode.enabled ? effective.readingMode : undefined,
      customCSS: sanitizedCSS,
      accessibility: {
        underlineLinks: effective.accessibility.underlineLinks,
        reducedMotion: effective.accessibility.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        highContrast: effective.accessibility.highContrast,
      },
      developerMode: effective.developerMode,
      compatibility: hostname ? effective.compatibility[hostname] ?? 'auto' : 'auto',
      textSize: effective.textSize,
    };

    if (engine.isRunning) engine.update(config); else engine.start(config);
  };

  loadSettings().then((s) => { settings = s; loaded = true; apply(); });
  subscribeToSettings((s) => { settings = s; apply(); });
  darkQuery.addEventListener('change', apply);

  // Re-check schedule every minute
  setInterval(() => {
    if (settings.schedule.enabled) apply();
  }, 60_000);

  // Listen for visibility change to re-apply (tab becomes active)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) apply();
  });

  if (isTop) {
    chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
      if (sender.id !== chrome.runtime.id || !isGetStatusMessage(message)) return false;
      sendResponse(payload());
      return false;
    });
    // Also handle requests for debug info
    chrome.runtime.onMessage.addListener((message: unknown) => {
      if (typeof message === 'object' && message !== null && (message as any).type === 'nightlens/get-debug') {
        const debug = {
          hostname: getSiteHostname(),
          settings,
          engineRunning: engine.isRunning,
          stats: engine.getStats(),
        };
        chrome.runtime.sendMessage({ type: 'nightlens/debug-info', ...debug }).catch(() => undefined);
      }
      return false;
    });
  }
}
