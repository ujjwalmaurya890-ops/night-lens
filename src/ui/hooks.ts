import { useCallback, useEffect, useRef, useState } from 'react';
import { getBrowserApi, type MessageSender } from '../adapters/browser';
import { cloneDefaults } from '../shared/defaults';
import { STATUS_CHANGED, GET_STATUS, isDebugInfoMessage, isStatusChangedMessage, isStatusPayload, type StatusPayload } from '../shared/messages';
import { loadSettings, resetSettings, subscribeToSettings, updateSettings } from '../shared/storage';
import type { Settings } from '../shared/types';

export interface Notice { kind: 'ok' | 'error'; text: string }

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(cloneDefaults());
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let alive = true;
    void loadSettings().then((s) => { if (alive) { setSettings(s); setReady(true); } });
    const unsub = subscribeToSettings((s) => alive && setSettings(s));
    return () => { alive = false; unsub(); };
  }, []);

  // Auto-clear notice after 3s
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  const change = useCallback(async (updater: (s: Settings) => Settings, successText: string) => {
    try {
      setSettings(await updateSettings(updater));
      setNotice({ kind: 'ok', text: successText });
    } catch (error) {
      setNotice({ kind: 'error', text: `Could not save settings: ${error instanceof Error ? error.message : String(error)}` });
    }
  }, []);

  const reset = useCallback(async () => {
    try {
      setSettings(await resetSettings());
      setNotice({ kind: 'ok', text: 'All settings were reset to their defaults.' });
    } catch (error) {
      setNotice({ kind: 'error', text: `Could not reset settings: ${error instanceof Error ? error.message : String(error)}` });
    }
  }, []);

  const setNoticeManual = useCallback((n: Notice | null) => setNotice(n), []);

  return { settings, ready, notice, change, reset, setNotice: setNoticeManual };
}

export type PageState = { state: 'loading' } | { state: 'unsupported' } | ({ state: 'ready' } & StatusPayload);

async function findTabId(): Promise<number | null> {
  const override = new URLSearchParams(location.search).get('tab');
  if (override && /^\d+$/.test(override)) return Number(override);
  const { id } = await getBrowserApi().tabs.queryActiveTab();
  return id;
}

export function usePageStatus(): PageState {
  const [page, setPage] = useState<PageState>({ state: 'loading' });
  const tabId = useRef<number | null>(null);

  useEffect(() => {
    const api = getBrowserApi();
    let alive = true;
    const stopListening = api.runtime.onMessage((message, sender: MessageSender) => {
      if (isStatusChangedMessage(message) && sender.tab?.id === tabId.current && sender.frameId === 0) {
        setPage({ state: 'ready', hostname: message.hostname, status: message.status, siteMode: message.siteMode });
      }
    });
    void (async () => {
      try {
        const id = await findTabId();
        tabId.current = id;
        if (id === null) throw new Error('no tab');
        const reply: unknown = await api.tabs.sendMessageToTab(id, { type: GET_STATUS }, { frameId: 0 });
        if (!alive) return;
        setPage(isStatusPayload(reply) ? { state: 'ready', ...reply } : { state: 'unsupported' });
      } catch {
        if (alive) setPage({ state: 'unsupported' });
      }
    })();
    return () => { alive = false; stopListening(); };
  }, []);

  return page;
}

export { STATUS_CHANGED };

// Hook for per-site stats
export function useSiteStats() {
  const [stats, setStats] = useState<{ elementsProcessed: number; rules: number } | null>(null);
  useEffect(() => {
    const stopListening = getBrowserApi().runtime.onMessage((message) => {
      if (isDebugInfoMessage(message)) {
        setStats({ elementsProcessed: message.processed, rules: message.rules });
      }
    });
    return stopListening;
  }, []);
  return stats;
}

export interface EnvironmentState {
  /** False when the page is not running inside an extension context at all. */
  available: boolean;
  /** Product label for copy, e.g. "Firefox". */
  browserLabel: string;
  /** Text for a storage/permission failure the user can act on, if any. */
  problem: string | null;
}

/**
 * Reports whether the UI is running with a usable browser API. Opened as a plain file (or after a
 * failed install) the popup and options page used to render silently with defaults; now they say so.
 */
export function useEnvironment(): EnvironmentState {
  const [state, setState] = useState<EnvironmentState>(() => {
    const api = getBrowserApi();
    const available = api.capabilities.runtime && api.capabilities.storage;
    return {
      available,
      browserLabel: api.info.label,
      problem: available
        ? null
        : 'NightLens is not running inside a browser extension context, so settings cannot be loaded or saved.',
    };
  });

  useEffect(() => {
    const api = getBrowserApi();
    const available = api.capabilities.runtime && api.capabilities.storage;
    setState({
      available,
      browserLabel: api.info.label,
      problem: available
        ? null
        : 'NightLens is not running inside a browser extension context, so settings cannot be loaded or saved.',
    });
  }, []);

  return state;
}

export interface HostAccessState {
  /** True only where the browser can withhold the page access the content script needs. */
  required: boolean;
  /** True while the declared host access is granted (or not needed). */
  granted: boolean;
  browserLabel: string;
  request: () => Promise<boolean>;
}

/**
 * Firefox MV3 treats host permissions as a revocable grant. When it is missing the content script
 * never runs, which previously looked like "this site is unsupported". This hook lets the popup
 * explain the real cause and ask for access from a user gesture.
 */
export function useHostAccess(): HostAccessState {
  const api = getBrowserApi();
  const required = api.capabilities.hostAccessIsUserControlled;
  const [granted, setGranted] = useState(true);

  useEffect(() => {
    if (!required) return;
    let alive = true;
    void api.permissions.containsHostAccess().then((value) => { if (alive) setGranted(value); });
    const stop = api.permissions.onHostAccessChanged((value) => { if (alive) setGranted(value); });
    return () => { alive = false; stop(); };
  }, [api, required]);

  const request = useCallback(async () => {
    const result = await api.permissions.requestHostAccess();
    setGranted(result);
    return result;
  }, [api]);

  return { required, granted: !required || granted, browserLabel: api.info.label, request };
}
