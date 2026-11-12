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
  manifest: Record<string, unknown>;
  onChanged: ReturnType<typeof emitter<[Record<string, chrome.storage.StorageChange>, string]>>;
  onMessage: ReturnType<typeof emitter<[unknown, chrome.runtime.MessageSender, (r?: unknown) => void]>>;
  onCommand: ReturnType<typeof emitter<[string]>>;
  onInstalled: ReturnType<typeof emitter<[]>>;
  onStartup: ReturnType<typeof emitter<[]>>;
  onPermissionAdded: ReturnType<typeof emitter<[]>>;
  onPermissionRemoved: ReturnType<typeof emitter<[]>>;
  failStorage: { get: boolean; set: boolean };
  tabs: { query: ReturnType<typeof vi.fn>; sendMessage: ReturnType<typeof vi.fn> };
  runtime: { sendMessage: ReturnType<typeof vi.fn>; openOptionsPage: ReturnType<typeof vi.fn>; id: string };
  action: {
    setBadgeText: ReturnType<typeof vi.fn>;
    setBadgeBackgroundColor: ReturnType<typeof vi.fn>;
    setTitle: ReturnType<typeof vi.fn>;
  };
  commands: { getAll: ReturnType<typeof vi.fn> };
  permissions: { contains: ReturnType<typeof vi.fn>; request: ReturnType<typeof vi.fn> };
}

export interface MockOptions {
  /** Firefox-like environment: installs a `browser` namespace and a Firefox user agent. */
  firefox?: boolean;
  /** Manifest served by runtime.getManifest(). */
  manifest?: Record<string, unknown>;
  /** Include the `permissions` API (needed for the Firefox host-access flow). */
  withPermissions?: boolean;
}

export const FIREFOX_UA =
  'Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0';
const DEFAULT_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko)';

let uaDescriptor: PropertyDescriptor | undefined;

function setUserAgent(ua?: string): void {
  if (uaDescriptor === undefined) uaDescriptor = Object.getOwnPropertyDescriptor(navigator, 'userAgent');
  if (ua) Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
  else if (uaDescriptor) Object.defineProperty(navigator, 'userAgent', uaDescriptor);
}

/**
 * In-memory extension namespace with the semantics NightLens relies on: async storage,
 * onChanged events, messaging, the toolbar action and (optionally) permissions.
 *
 * Methods are `async`, which is what a current Chromium/Firefox namespace does. The callback-style
 * variant that old Chromium forks still use is covered separately in adapters.test.ts.
 */
export function installChromeMock(options: MockOptions = {}): ChromeMock {
  const data: Record<string, unknown> = {};
  const onChanged = emitter<[Record<string, chrome.storage.StorageChange>, string]>();
  const onMessage = emitter<[unknown, chrome.runtime.MessageSender, (r?: unknown) => void]>();
  const onCommand = emitter<[string]>();
  const onInstalled = emitter<[]>();
  const onStartup = emitter<[]>();
  const onPermissionAdded = emitter<[]>();
  const onPermissionRemoved = emitter<[]>();
  const failStorage = { get: false, set: false };
  const manifest: Record<string, unknown> = options.manifest ?? {
    manifest_version: 3,
    version: '9.9.9',
    host_permissions: options.firefox ? ['http://*/*', 'https://*/*'] : [],
  };
  const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

  const mock: ChromeMock = {
    data, manifest, onChanged, onMessage, onCommand, onInstalled, onStartup,
    onPermissionAdded, onPermissionRemoved, failStorage,
    tabs: { query: vi.fn(async () => [{ id: 5 }]), sendMessage: vi.fn(async () => undefined) },
    runtime: {
      sendMessage: vi.fn(async () => undefined),
      openOptionsPage: vi.fn(async () => undefined),
      id: 'test-extension-id',
    },
    action: {
      setBadgeText: vi.fn(async () => undefined),
      setBadgeBackgroundColor: vi.fn(async () => undefined),
      setTitle: vi.fn(async () => undefined),
    },
    commands: { getAll: vi.fn(async () => [{ name: 'toggle-nightlens' }]) },
    permissions: {
      contains: vi.fn(async () => (options.firefox ? false : true)),
      request: vi.fn(async () => true),
    },
  };

  const namespace: Record<string, unknown> = {
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
    runtime: {
      ...mock.runtime,
      getManifest: vi.fn(() => manifest),
      onMessage,
      onStartup,
      onInstalled,
    },
    tabs: mock.tabs,
    action: mock.action,
    commands: { onCommand, getAll: mock.commands.getAll },
  };

  if (options.withPermissions || options.firefox) {
    namespace.permissions = {
      contains: mock.permissions.contains,
      request: mock.permissions.request,
      onAdded: onPermissionAdded,
      onRemoved: onPermissionRemoved,
    };
  }

  const globals = globalThis as unknown as Record<string, unknown>;
  globals.chrome = namespace;
  if (options.firefox) globals.browser = namespace;
  else delete globals.browser;
  setUserAgent(options.firefox ? FIREFOX_UA : DEFAULT_UA);

  return mock;
}

/** Firefox-shaped environment: `browser` namespace, Firefox UA and revocable host access. */
export function installFirefoxMock(overrides: Omit<MockOptions, 'firefox'> = {}): ChromeMock {
  return installChromeMock({ ...overrides, firefox: true });
}

export { emitter };
