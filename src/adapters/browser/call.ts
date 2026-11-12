import { toBrowserApiError } from './errors';
import type { AdapterEnvironment, CallMode, Unsubscribe } from './types';

type AnyFunction = (...args: unknown[]) => unknown;
type AnyRecord = Record<string, unknown>;

interface Resolved {
  readonly owner: unknown;
  readonly fn: AnyFunction;
}

const isRecord = (value: unknown): value is AnyRecord =>
  typeof value === 'object' && value !== null;

/**
 * Resolves a dotted API path ("storage.local.get") against a namespace, returning the function
 * and its owner. Resolution happens on every call on purpose: some engines attach API objects
 * lazily, and tests replace the namespace between cases.
 */
export function resolveApiPath(root: unknown, path: string): Resolved | null {
  const segments = path.split('.');
  const method = segments.pop();
  if (!method) return null;
  let owner: unknown = root;
  for (const segment of segments) {
    if (!isRecord(owner)) return null;
    owner = owner[segment];
  }
  if (!isRecord(owner)) return null;
  const fn = owner[method];
  return typeof fn === 'function' ? { owner, fn: fn as AnyFunction } : null;
}

/** Reads a nested value (e.g. "runtime.lastError") without throwing on missing objects. */
export function readPath(root: unknown, path: string): unknown {
  let current: unknown = root;
  for (const segment of path.split('.')) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
}

export function hasApiPath(root: unknown, path: string): boolean {
  return resolveApiPath(root, path) !== null;
}

export function getEvent(root: unknown, path: string): unknown {
  return readPath(root, path);
}

function readLastError(root: unknown): { message?: string } | null {
  const value = readPath(root, 'runtime.lastError');
  return isRecord(value) ? (value as { message?: string }) : null;
}

/**
 * Calls an async WebExtension API and always returns a promise.
 *
 * `hybrid` mode (the `chrome.*` namespace on Chromium/Safari) accepts either a returned promise
 * or a trailing callback, depending on the engine version. `promise` mode (`browser.*` on Firefox
 * and Safari) never receives an extra argument, because Gecko validates argument counts strictly.
 */
export function callApi<T>(
  env: Pick<AdapterEnvironment, 'root' | 'callMode'>,
  path: string,
  args: readonly unknown[] = [],
  fallback?: T,
): Promise<T | undefined> {
  const resolved = resolveApiPath(env.root, path);
  if (!resolved) return Promise.resolve(fallback);

  if (env.callMode === 'promise') {
    try {
      const result = resolved.fn.apply(resolved.owner, [...args]);
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        return (result as Promise<T>).catch((error: unknown) => {
          throw toBrowserApiError(error, path);
        });
      }
      return Promise.resolve((result === undefined ? fallback : result) as T | undefined);
    } catch (error) {
      return Promise.reject(toBrowserApiError(error, path));
    }
  }

  // A userland promise implementation (test double, polyfill, or a browser whose namespace is
  // already promisified) must not receive a trailing callback: some engines validate arity.
  const isPromiseFunction = (resolved.fn as { constructor?: { name?: string } }).constructor?.name === 'AsyncFunction';
  if (isPromiseFunction) {
    try {
      const result = resolved.fn.apply(resolved.owner, [...args]) as Promise<T> | T | undefined;
      return Promise.resolve(result as T | undefined);
    } catch (error) {
      return Promise.reject(toBrowserApiError(error, path));
    }
  }

  return new Promise<T | undefined>((resolve, reject) => {
    let settled = false;
    const settle = (action: () => void): void => {
      if (settled) return;
      settled = true;
      action();
    };
    const callback = (value?: unknown): void => {
      // Reading lastError also marks it as handled, which keeps the console free of
      // "Unchecked runtime.lastError" noise in Chromium.
      const lastError = readLastError(env.root);
      if (lastError) {
        settle(() => reject(toBrowserApiError(lastError, path)));
        return;
      }
      settle(() => resolve((value === undefined ? fallback : value) as T | undefined));
    };
    try {
      const result = resolved.fn.apply(resolved.owner, [...args, callback]);
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        (result as Promise<unknown>).then(
          (value) => settle(() => resolve((value === undefined ? fallback : value) as T | undefined)),
          (error: unknown) => settle(() => reject(toBrowserApiError(error, path))),
        );
      } else if (result !== undefined) {
        settle(() => resolve(result as T));
      }
      // result === undefined: the engine is callback-based and will settle via `callback`.
    } catch (error) {
      settle(() => reject(toBrowserApiError(error, path)));
    }
  });
}

/**
 * Fire-and-forget invocation for cosmetic APIs (badge text, title). It never waits, never rejects
 * and never appends a callback, so it behaves identically on every engine.
 */
export function notifyApi(
  env: Pick<AdapterEnvironment, 'root'>,
  path: string,
  args: readonly unknown[] = [],
): void {
  const resolved = resolveApiPath(env.root, path);
  if (!resolved) return;
  try {
    const result = resolved.fn.apply(resolved.owner, [...args]);
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      void (result as Promise<unknown>).catch(() => undefined);
    }
  } catch {
    /* cosmetic only: an unpinned toolbar button must not break a settings change */
  }
}

/** Best-effort call: never rejects. Used for cosmetic work such as the toolbar badge. */
export async function tryApiCall<T>(
  env: Pick<AdapterEnvironment, 'root' | 'callMode'>,
  path: string,
  args: readonly unknown[] = [],
  fallback?: T,
): Promise<T | undefined> {
  try {
    return await callApi(env, path, args, fallback);
  } catch {
    return fallback;
  }
}

export function addListener(
  root: unknown,
  eventPath: string,
  listener: (...args: never[]) => void,
): Unsubscribe {
  const event = getEvent(root, eventPath);
  if (!isRecord(event) || typeof event.addListener !== 'function') return () => undefined;
  const add = event.addListener.bind(event) as (fn: unknown) => void;
  const remove =
    typeof event.removeListener === 'function'
      ? (event.removeListener.bind(event) as (fn: unknown) => void)
      : null;
  try {
    add(listener);
  } catch {
    return () => undefined;
  }
  return () => {
    try {
      remove?.(listener);
    } catch {
      /* the extension context is gone; nothing left to remove */
    }
  };
}

/** Creates a no-op unsubscribe so call sites never need to branch on availability. */
export const NOOP_UNSUBSCRIBE: Unsubscribe = () => undefined;

export type { CallMode };
