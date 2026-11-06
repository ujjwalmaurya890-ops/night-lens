import { ThemeEngine, type EngineConfig, type EngineStatus } from '../engine/engine';
import { buildTokens } from '../engine/palette';
import { decide, getEffectiveSettings } from '../shared/decision';
import { sanitizeCustomCss } from '../shared/css';
import { getSiteEntry, normalizeHostname } from '../shared/hostname';
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

export function startContentScript(): () => void {
  const w = window as unknown as { __nightlensLoaded?: boolean };
  if (w.__nightlensLoaded) return () => undefined;
  w.__nightlensLoaded = true;

  const isTop = window.top === window;
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let settings: Settings = cloneDefaults();
  let loaded = false;
  let disposed = false;
  let siteStatus: SiteStatus = 'globally-off';
  let siteMode: StatusPayload['siteMode'] = null;

  const payload = (): StatusPayload => ({ hostname: getSiteHostname(), status: siteStatus, siteMode });
  const setStatus = (status: SiteStatus): void => {
    if (status === siteStatus) return;
    siteStatus = status;
    if (!isTop || disposed) return;
    const message: StatusChangedMessage = { type: STATUS_CHANGED, ...payload() };
    chrome.runtime.sendMessage(message).catch(() => undefined);
  };

  const engine = new ThemeEngine(document, window, {
    onStatus: (s: EngineStatus) => setStatus(s === 'active' ? 'active' : 'native-dark'),
    onStats: (stats) => {
      if (settings.developerMode) console.debug('[NightLens] Engine stats', stats);
    },
  });

  const apply = (): void => {
    if (!loaded || disposed) return;
    const hostname = getSiteHostname();
    const effective = getEffectiveSettings(settings, hostname);
    const decision = decide(effective, hostname, darkQuery.matches);
    siteMode = decision.siteMode;

    if (!decision.active) {
      engine.stop();
      setStatus(decision.status);
      return;
    }

    let tokens: ReturnType<typeof buildTokens>;
    try {
      tokens = buildTokens(effective);
    } catch {
      // A corrupt custom theme must not prevent the rest of the page from working.
      tokens = buildTokens(cloneDefaults());
    }

    const customCSS = getSiteEntry(settings.customCSS, hostname);
    const sanitizedCSS = customCSS ? sanitizeCustomCss(customCSS) : undefined;
    const config: EngineConfig = {
      tokens,
      skipNativeDarkCheck: decision.forceNative,
      readingMode: effective.readingMode.enabled ? effective.readingMode : undefined,
      customCSS: sanitizedCSS || undefined,
      accessibility: {
        underlineLinks: effective.accessibility.underlineLinks,
        reducedMotion: effective.accessibility.reducedMotion || motionQuery.matches,
        highContrast: effective.accessibility.highContrast,
      },
      developerMode: effective.developerMode,
      compatibility: getSiteEntry(effective.compatibility, hostname) ?? 'auto',
      textSize: effective.textSize,
      batchSize: effective.performance.maxElementsPerFrame,
      debounceMs: effective.performance.debounceMs,
      enableCache: effective.performance.enableCache,
    };

    if (engine.isRunning) engine.update(config); else engine.start(config);
  };

  const onVisibilityChange = (): void => {
    if (!document.hidden) apply();
  };
  const onMessage = (message: unknown, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void): boolean => {
    if (sender.id !== chrome.runtime.id || typeof message !== 'object' || message === null) return false;
    if (isGetStatusMessage(message) && isTop) {
      sendResponse(payload());
      return false;
    }
    if ((message as Record<string, unknown>).type === 'nightlens/get-debug' && isTop) {
      chrome.runtime.sendMessage({
        type: 'nightlens/debug-info',
        hostname: getSiteHostname(),
        settings,
        engineRunning: engine.isRunning,
        stats: engine.getStats(),
      }).catch(() => undefined);
    }
    return false;
  };
  const onPageHide = (event: PageTransitionEvent): void => {
    // Keep the BFCache page intact; a normal unload is the final cleanup point.
    if (!event.persisted) dispose();
  };
  const unsubscribe = subscribeToSettings((s) => { settings = s; apply(); });
  const scheduleTimer = window.setInterval(() => {
    if (settings.schedule.enabled && !document.hidden) apply();
  }, 60_000);

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    unsubscribe();
    window.clearInterval(scheduleTimer);
    darkQuery.removeEventListener('change', apply);
    motionQuery.removeEventListener('change', apply);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', onPageHide);
    chrome.runtime.onMessage.removeListener(onMessage);
    engine.stop();
    w.__nightlensLoaded = false;
  }

  void loadSettings().then((s) => {
    if (disposed) return;
    settings = s;
    loaded = true;
    apply();
  });
  darkQuery.addEventListener('change', apply);
  motionQuery.addEventListener('change', apply);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', onPageHide);
  chrome.runtime.onMessage.addListener(onMessage);
  return dispose;
}
