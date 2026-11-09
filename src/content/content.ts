import { ThemeEngine, type EngineConfig, type EngineStatus } from '../engine/engine';
import { buildTokens } from '../engine/palette';
import { decide, getEffectiveSettings } from '../shared/decision';
import { sanitizeCustomCss } from '../shared/css';
import { getSiteEntry, normalizeHostname } from '../shared/hostname';
import {
  DEBUG_INFO, STATUS_CHANGED, isGetDebugMessage, isGetStatusMessage,
  type DebugInfoMessage, type StatusChangedMessage, type StatusPayload,
} from '../shared/messages';
import { isExtensionContextValid, loadSettings, subscribeToSettings } from '../shared/storage';
import { STORAGE_KEY } from '../shared/defaults';
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
  const buildTokensSafe = (): ReturnType<typeof buildTokens> => {
    try {
      return buildTokens(getEffectiveSettings(settings, getSiteHostname()));
    } catch {
      return buildTokens(cloneDefaults());
    }
  };
  const setStatus = (status: SiteStatus): void => {
    if (status === siteStatus) return;
    siteStatus = status;
    if (!isTop || disposed) return;
    // After an extension update the old content script keeps running with a dead runtime;
    // sendMessage would throw "Extension context invalidated".
    if (!isExtensionContextValid()) return;
    const message: StatusChangedMessage = { type: STATUS_CHANGED, ...payload() };
    try {
      void chrome.runtime.sendMessage(message).catch(() => undefined);
    } catch { /* context went away between the check and the call */ }
  };

  const engine = new ThemeEngine(document, window, {
    onStatus: (s: EngineStatus) => setStatus(s === 'active' ? 'active' : 'native-dark'),
    onStats: (stats) => {
      if (settings.developerMode) console.debug('[NightLens] Engine stats', stats);
    },
  });

  const apply = (): void => {
    if (!loaded || disposed) return;
    if (!isExtensionContextValid()) {
      // The extension was reloaded/updated/removed: leave the page clean instead of half-themed.
      dispose();
      return;
    }
    try {
      applyNow();
    } catch (error) {
      // Never let one unexpected page value break the content script for the whole document.
      if (settings.developerMode) console.warn('[NightLens] Failed to apply theme.', error);
    }
  };

  const applyNow = (): void => {
    const hostname = getSiteHostname();
    const effective = getEffectiveSettings(settings, hostname);
    const decision = decide(effective, hostname, darkQuery.matches);
    siteMode = decision.siteMode;
    // TEMP-DIAG: remove after the first browser run; records why the engine did or did not run.
    document.documentElement.setAttribute('data-diag-nightlens', JSON.stringify({
      host: hostname, theme: effective.theme, rules: settings.siteRules, dark: darkQuery.matches,
      active: decision.active, status: decision.active ? 'active' : decision.status, loaded,
    }));

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
    syncScheduleTimer();
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
    if (isGetDebugMessage(message) && isTop) {
      // Deliberately excludes settings and site rules: diagnostics need counters, not configuration.
      const stats = engine.getStats();
      const info: DebugInfoMessage = {
        type: DEBUG_INFO,
        hostname: getSiteHostname(),
        running: engine.isRunning,
        preset: engine.isRunning ? buildTokensSafe().preset : 'idle',
        processed: stats.processed,
        rules: stats.rules,
        duration: Math.round(stats.duration),
        cacheHit: stats.cacheHit,
      };
      try {
        void chrome.runtime.sendMessage(info).catch(() => undefined);
      } catch { /* context invalidated */ }
    }
    return false;
  };
  const onPageHide = (event: PageTransitionEvent): void => {
    // Keep the BFCache page intact; a normal unload is the final cleanup point.
    if (!event.persisted) dispose();
  };
  const unsubscribe = subscribeToSettings((s) => { settings = s; apply(); });

  // Only keep a 60s ticker alive while a schedule exists; otherwise it wakes the page for nothing.
  let scheduleTimer: number | null = null;
  const syncScheduleTimer = (): void => {
    const needed = settings.schedule.enabled && !disposed;
    if (needed && scheduleTimer === null) {
      scheduleTimer = window.setInterval(() => {
        if (!document.hidden) apply();
      }, 60_000);
    } else if (!needed && scheduleTimer !== null) {
      window.clearInterval(scheduleTimer);
      scheduleTimer = null;
    }
  };

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    unsubscribe();
    if (scheduleTimer !== null) window.clearInterval(scheduleTimer);
    scheduleTimer = null;
    darkQuery.removeEventListener('change', apply);
    motionQuery.removeEventListener('change', apply);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', onPageHide);
    chrome.runtime.onMessage.removeListener(onMessage);
    engine.stop();
    w.__nightlensLoaded = false;
  }

  // TEMP-DIAG: remove after diagnosis. Records what storage actually held when the script started.
  void (async () => {
    let raw: unknown;
    let err: string | null = null;
    try { raw = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY]; } catch (e) { err = String(e); }
    const r = raw as { theme?: unknown; siteRules?: unknown; schemaVersion?: unknown } | undefined;
    document.documentElement.setAttribute('data-diag-raw', JSON.stringify({
      ctxValid: isExtensionContextValid(),
      raw: raw === undefined ? 'undefined' : { theme: r?.theme ?? null, rules: r?.siteRules ?? null, v: r?.schemaVersion ?? null },
      err,
    }));
  })();
  void loadSettings().then((s) => {
    if (disposed) return;
    settings = s;
    loaded = true;
    apply();
    // TEMP-DIAG: did the load itself return defaults?
    document.documentElement.setAttribute('data-diag-load', JSON.stringify({ theme: s.theme, rules: Object.keys(s.siteRules) }));
  });
  darkQuery.addEventListener('change', apply);
  motionQuery.addEventListener('change', apply);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', onPageHide);
  chrome.runtime.onMessage.addListener(onMessage);
  return dispose;
}
