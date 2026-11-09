import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

export function usePageStatus(): PageState {
  const [page, setPage] = useState<PageState>({ state: 'loading' });
  const tabId = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    const listener = (message: unknown, sender: chrome.runtime.MessageSender) => {
      if (isStatusChangedMessage(message) && sender.tab?.id === tabId.current && sender.frameId === 0) {
        setPage({ state: 'ready', hostname: message.hostname, status: message.status, siteMode: message.siteMode });
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    void (async () => {
      try {
        const id = await findTabId();
        tabId.current = id;
        if (id === null) throw new Error('no tab');
        const reply: unknown = await chrome.tabs.sendMessage(id, { type: GET_STATUS }, { frameId: 0 });
        if (!alive) return;
        setPage(isStatusPayload(reply) ? { state: 'ready', ...reply } : { state: 'unsupported' });
      } catch {
        if (alive) setPage({ state: 'unsupported' });
      }
    })();
    return () => { alive = false; chrome.runtime.onMessage.removeListener(listener); };
  }, []);

  return page;
}

export { STATUS_CHANGED };

// Hook for per-site stats
export function useSiteStats() {
  const [stats, setStats] = useState<{ elementsProcessed: number; rules: number } | null>(null);
  useEffect(() => {
    const listener = (message: unknown) => {
      if (isDebugInfoMessage(message)) {
        setStats({ elementsProcessed: message.processed, rules: message.rules });
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);
  return stats;
}
