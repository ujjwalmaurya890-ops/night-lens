import { vi } from 'vitest';

type Listener<A extends unknown[]> = (...args: A) => void;
function emitter<A extends unknown[]>() {
  const listeners = new Set<Listener<A>>();
  return {
    addListener: (l: Listener<A>) => listeners.add(l),
    removeListener: (l: Listener<A>) => listeners.delete(l),
    hasListener: (l: Listener<A>) => listeners.has(l),
    emit: (...args: A) => listeners.forEach((l) => l(...args)),
    count: () => listeners.size,
  };
}

export interface ChromeMock {
  data: Record<string, unknown>;
  onChanged: ReturnType<typeof emitter<[Record<string, chrome.storage.StorageChange>, string]>>;
  onMessage: ReturnType<typeof emitter<[unknown, chrome.runtime.MessageSender, (r?: unknown) => void]>>;
  onCommand: ReturnType<typeof emitter<[string]>>;
  failStorage: { get: boolean; set: boolean };
  tabs: { query: ReturnType<typeof vi.fn>; sendMessage: ReturnType<typeof vi.fn> };
  runtime: { sendMessage: ReturnType<typeof vi.fn>; openOptionsPage: ReturnType<typeof vi.fn>; id: string };
  action: { setBadgeText: ReturnType<typeof vi.fn>; setBadgeBackgroundColor: ReturnType<typeof vi.fn> };
}

/** In-memory chrome.* with the semantics NightLens relies on (async storage + onChanged). */
export function installChromeMock(): ChromeMock {
  const data: Record<string, unknown> = {};
  const onChanged = emitter<[Record<string, chrome.storage.StorageChange>, string]>();
  const onMessage = emitter<[unknown, chrome.runtime.MessageSender, (r?: unknown) => void]>();
  const onCommand = emitter<[string]>();
  const failStorage = { get: false, set: false };
  const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

  const mock: ChromeMock = {
    data, onChanged, onMessage, onCommand, failStorage,
    tabs: { query: vi.fn(async () => [{ id: 5 }]), sendMessage: vi.fn(async () => undefined) },
    runtime: { sendMessage: vi.fn(async () => undefined), openOptionsPage: vi.fn(async () => undefined), id: 'test-extension-id' },
    action: { setBadgeText: vi.fn(async () => undefined), setBadgeBackgroundColor: vi.fn(async () => undefined) },
  };

  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      local: {
        get: vi.fn(async (key: string) => {
          if (failStorage.get) throw new Error('storage unavailable');
          return key in data ? { [key]: clone(data[key]) } : {};
        }),
        set: vi.fn(async (items: Record<string, unknown>) => {
          if (failStorage.set) throw new Error('quota exceeded');
          const changes: Record<string, chrome.storage.StorageChange> = {};
          for (const [k, v] of Object.entries(items)) {
            changes[k] = { oldValue: clone(data[k]), newValue: clone(v) };
            data[k] = clone(v);
          }
          onChanged.emit(changes, 'local');
        }),
      },
      onChanged,
    },
    runtime: { ...mock.runtime, onMessage, onStartup: emitter(), onInstalled: emitter() },
    tabs: mock.tabs,
    action: mock.action,
    commands: { onCommand },
  };
  return mock;
}
