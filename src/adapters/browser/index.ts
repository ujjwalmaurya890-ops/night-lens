import { readPath } from './call';
import { createChromeAdapter } from './chrome.adapter';
import { createFirefoxAdapter } from './firefox.adapter';
import { createSafariAdapter } from './safari.adapter';
import type { BrowserApi, BrowserFamily, BrowserInfo, BrowserName, NamespaceName } from './types';

export type {
  BrowserApi,
  BrowserCapabilities,
  BrowserFamily,
  BrowserInfo,
  BrowserName,
  ExtensionManifest,
  MessageHandler,
  MessageSender,
  StorageChange,
  TabInfo,
  Unsubscribe,
} from './types';
export { BrowserApiError, describeBrowserApiError, isContextInvalidated } from './errors';

const LABELS: Record<BrowserName, string> = {
  chrome: 'Chrome',
  edge: 'Microsoft Edge',
  brave: 'Brave',
  opera: 'Opera',
  vivaldi: 'Vivaldi',
  firefox: 'Firefox',
  safari: 'Safari',
  unknown: 'this browser',
};

function readNamespace(name: 'chrome' | 'browser'): unknown {
  try {
    return (globalThis as unknown as Record<string, unknown>)[name];
  } catch {
    return undefined;
  }
}

function readUserAgent(): string {
  try {
    return typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string'
      ? navigator.userAgent
      : '';
  } catch {
    return '';
  }
}

function versionFrom(ua: string, pattern: RegExp): string | null {
  const match = ua.match(pattern);
  return match?.[1] ?? null;
}

/**
 * Product detection. It only picks wording and documented engine quirks; no feature is enabled or
 * disabled here, because capabilities are derived from the APIs that actually exist.
 */
export function detectBrowser(ua: string): { name: BrowserName; version: string | null } {
  if (/Firefox\//.test(ua)) return { name: 'firefox', version: versionFrom(ua, /Firefox\/(\d+(?:\.\d+)*)/) };
  if (/Edg(?:e|A|iOS)?\//.test(ua)) return { name: 'edge', version: versionFrom(ua, /Edg(?:e|A|iOS)?\/(\d+(?:\.\d+)*)/) };
  if (/OPR\//.test(ua) || /Opera[ /]/.test(ua)) return { name: 'opera', version: versionFrom(ua, /(?:OPR|Opera[ /])\/?(\d+(?:\.\d+)*)/) };
  if (/Vivaldi\//.test(ua)) return { name: 'vivaldi', version: versionFrom(ua, /Vivaldi\/(\d+(?:\.\d+)*)/) };
  if (typeof navigator !== 'undefined' && 'brave' in navigator) return { name: 'brave', version: versionFrom(ua, /Chrome\/(\d+(?:\.\d+)?)/) };
  if (/Chrome\//.test(ua) || /Chromium\//.test(ua)) return { name: 'chrome', version: versionFrom(ua, /(?:Chrome|Chromium)\/(\d+(?:\.\d+)*)/) };
  if (/Safari\//.test(ua)) return { name: 'safari', version: versionFrom(ua, /Version\/(\d+(?:\.\d+)*)/) };
  return { name: 'unknown', version: null };
}

export function familyOf(name: BrowserName): BrowserFamily {
  if (name === 'firefox') return 'firefox';
  if (name === 'safari') return 'safari';
  if (name === 'unknown') return 'unknown';
  return 'chromium';
}

function describeEnvironment(): {
  root: unknown;
  namespace: NamespaceName;
  info: BrowserInfo;
} {
  const chromeNs = readNamespace('chrome');
  const browserNs = readNamespace('browser');
  // Prefer `browser`: on Firefox it is promise-based, and on Safari it is the documented alias.
  const root = browserNs ?? chromeNs;
  const namespace: NamespaceName = browserNs ? 'browser' : chromeNs ? 'chrome' : 'none';
  const detected = detectBrowser(readUserAgent());
  let manifestVersion: number | null = null;
  const getManifest = readPath(root, 'runtime.getManifest');
  if (typeof getManifest === 'function') {
    try {
      const manifest = (getManifest as () => { manifest_version?: unknown }).call(
        readPath(root, 'runtime'),
      );
      const value = manifest?.manifest_version;
      manifestVersion = typeof value === 'number' ? value : null;
    } catch {
      manifestVersion = null;
    }
  }
  return {
    root,
    namespace,
    info: {
      family: familyOf(detected.name),
      name: detected.name,
      label: LABELS[detected.name],
      namespace,
      manifestVersion,
    },
  };
}

let cache: { root: unknown; api: BrowserApi } | null = null;

/** Creates the adapter for a namespace, without caching. Exposed for tests. */
export function createAdapterFor(root: unknown, info: BrowserInfo): BrowserApi {
  const namespace: NamespaceName = root ? info.namespace : 'none';
  const callMode = namespace === 'browser' ? 'promise' : 'hybrid';
  switch (info.family) {
    case 'firefox':
      return createFirefoxAdapter(root, info, callMode);
    case 'safari':
      return createSafariAdapter(root, info, callMode);
    default:
      return createChromeAdapter(root, info, callMode);
  }
}

/**
 * The one entry point application code uses. The adapter is cached per namespace object: tests
 * (and a hot-reloaded extension page) can replace `globalThis.chrome`, and the next call picks up
 * the new namespace instead of talking to a dead one.
 */
export function getBrowserApi(): BrowserApi {
  const env = describeEnvironment();
  if (cache && cache.root === env.root) return cache.api;
  const api = createAdapterFor(env.root, env.info);
  cache = { root: env.root, api };
  return api;
}

/** Drops the memoised adapter. Only needed by tests that replace the browser namespace. */
export function resetBrowserApi(): void {
  cache = null;
}
