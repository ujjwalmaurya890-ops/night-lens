/**
 * Cross-browser extension API surface.
 *
 * Everything NightLens needs from a browser is described here. Application code depends on
 * these interfaces only, so no other module has to know whether it is running on a Chromium
 * browser, Firefox or Safari, or whether the underlying API is callback- or promise-based.
 */

/** Rendering engine family. Behaviour differences are grouped by engine, never by brand. */
export type BrowserFamily = 'chromium' | 'firefox' | 'safari' | 'unknown';

/** Best-effort product identification, used for wording and diagnostics only. */
export type BrowserName =
  | 'chrome'
  | 'edge'
  | 'brave'
  | 'opera'
  | 'vivaldi'
  | 'firefox'
  | 'safari'
  | 'unknown';

/** How the underlying namespace delivers results. */
export type CallMode = 'promise' | 'hybrid';

/** Which global namespace the adapter is bound to. */
export type NamespaceName = 'chrome' | 'browser' | 'none';

export interface BrowserInfo {
  readonly family: BrowserFamily;
  readonly name: BrowserName;
  /** Human-readable product label for UI copy, e.g. "Firefox". */
  readonly label: string;
  readonly namespace: NamespaceName;
  readonly manifestVersion: number | null;
}

/**
 * Feature flags derived once per environment. Missing APIs degrade to a documented fallback
 * instead of throwing, so one unavailable API can never take the whole extension down.
 */
export interface BrowserCapabilities {
  readonly runtime: boolean;
  readonly storage: boolean;
  readonly storageChangeEvents: boolean;
  readonly tabs: boolean;
  readonly tabMessaging: boolean;
  readonly commands: boolean;
  readonly action: boolean;
  readonly actionBadge: boolean;
  readonly actionTitle: boolean;
  readonly openOptionsPage: boolean;
  readonly manifest: boolean;
  readonly permissionsApi: boolean;
  /**
   * True where the engine treats host access as a revocable, user-controlled grant (Firefox MV3).
   * On those browsers the content script may legitimately not be running yet.
   */
  readonly hostAccessIsUserControlled: boolean;
}

export type Unsubscribe = () => void;

/** Subset of the WebExtensions MessageSender fields NightLens relies on. */
export interface MessageSender {
  readonly id?: string;
  readonly url?: string;
  readonly frameId?: number;
  readonly tab?: { readonly id?: number };
}

export type MessageResponse = (response?: unknown) => void;
export type MessageHandler = (
  message: unknown,
  sender: MessageSender,
  sendResponse: MessageResponse,
) => boolean | void;

export interface StorageChange {
  readonly oldValue?: unknown;
  readonly newValue?: unknown;
}
export type StorageChangeListener = (
  changes: Record<string, StorageChange>,
  areaName: string,
) => void;

export interface ExtensionManifest {
  readonly name?: string;
  readonly version?: string;
  readonly manifest_version?: number;
  readonly host_permissions?: readonly string[];
  readonly permissions?: readonly string[];
}

export interface RuntimeApi {
  /** Extension id, or null once this script's extension context has been invalidated. */
  id(): string | null;
  isAvailable(): boolean;
  getURL(path: string): string;
  getManifest(): ExtensionManifest | null;
  sendMessage(message: unknown): Promise<unknown>;
  onMessage(handler: MessageHandler): Unsubscribe;
  onInstalled(listener: () => void): Unsubscribe;
  onStartup(listener: () => void): Unsubscribe;
  openOptionsPage(): Promise<boolean>;
}

export interface StorageApi {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  onChanged(listener: StorageChangeListener): Unsubscribe;
}

export interface TabInfo {
  readonly id: number | null;
}

export interface TabsApi {
  queryActiveTab(): Promise<TabInfo>;
  sendMessageToTab(
    tabId: number,
    message: unknown,
    options?: { frameId?: number },
  ): Promise<unknown>;
}

export interface CommandsApi {
  onCommand(listener: (command: string) => void): Unsubscribe;
  getAll(): Promise<string[]>;
}

export interface ActionApi {
  setBadgeText(text: string): Promise<void>;
  setBadgeBackgroundColor(color: string): Promise<void>;
  setTitle(title: string): Promise<void>;
}

export interface PermissionsApi {
  /** True when every declared host origin is granted (also true when none is declared). */
  containsHostAccess(): Promise<boolean>;
  /** Must be called from a user gesture. Returns the resulting grant state. */
  requestHostAccess(): Promise<boolean>;
  onHostAccessChanged(listener: (granted: boolean) => void): Unsubscribe;
}

export interface OptionsPageApi {
  open(): Promise<boolean>;
}

export interface BrowserApi {
  readonly info: BrowserInfo;
  readonly capabilities: BrowserCapabilities;
  readonly runtime: RuntimeApi;
  readonly storage: StorageApi;
  readonly tabs: TabsApi;
  readonly commands: CommandsApi;
  readonly action: ActionApi;
  readonly permissions: PermissionsApi;
  readonly options: OptionsPageApi;
}

/** Everything a concrete adapter builder needs to know about its namespace. */
export interface AdapterEnvironment {
  /** The raw `chrome` / `browser` namespace object. */
  readonly root: unknown;
  readonly callMode: CallMode;
  readonly info: BrowserInfo;
}
