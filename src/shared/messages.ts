import { normalizeHostname } from './hostname';
import { SITE_MODES, SITE_STATUSES, type SiteMode, type SiteStatus } from './types';

export const GET_STATUS = 'nightlens/get-status' as const;
export const STATUS_CHANGED = 'nightlens/status-changed' as const;
export const GET_STORAGE = 'nightlens/get-storage' as const;
export const EXPORT_SETTINGS = 'nightlens/export-settings' as const;
export const GET_DEBUG = 'nightlens/get-debug' as const;
export const DEBUG_INFO = 'nightlens/debug-info' as const;

export interface GetStatusMessage { type: typeof GET_STATUS }
export interface StatusPayload { hostname: string | null; status: SiteStatus; siteMode: SiteMode | null }
export interface StatusChangedMessage extends StatusPayload { type: typeof STATUS_CHANGED }

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function isGetStatusMessage(m: unknown): m is GetStatusMessage {
  return isObject(m) && m.type === GET_STATUS;
}

export function isStatusPayload(m: unknown): m is StatusPayload {
  if (!isObject(m)) return false;
  const hostOk = m.hostname === null || (typeof m.hostname === 'string' && normalizeHostname(m.hostname) === m.hostname);
  const modeOk = m.siteMode === null || (SITE_MODES as readonly unknown[]).includes(m.siteMode);
  return hostOk && modeOk && (SITE_STATUSES as readonly unknown[]).includes(m.status);
}

export function isStatusChangedMessage(m: unknown): m is StatusChangedMessage {
  return isObject(m) && m.type === STATUS_CHANGED && isStatusPayload(m);
}

/**
 * Debug payload sent by the content script to extension pages. It deliberately contains no
 * settings and no site rules: only counters, the active preset name, and the current hostname,
 * so a diagnostics view can never leak a user's configuration to another listener.
 */
export interface DebugInfoMessage {
  type: typeof DEBUG_INFO;
  hostname: string | null;
  running: boolean;
  preset: string;
  processed: number;
  rules: number;
  duration: number;
  cacheHit: number;
}

export function isGetStorageMessage(m: unknown): m is { type: typeof GET_STORAGE } {
  return isObject(m) && m.type === GET_STORAGE;
}

export function isExportSettingsMessage(m: unknown): m is { type: typeof EXPORT_SETTINGS } {
  return isObject(m) && m.type === EXPORT_SETTINGS;
}

export function isGetDebugMessage(m: unknown): m is { type: typeof GET_DEBUG } {
  return isObject(m) && m.type === GET_DEBUG;
}

const finiteOrZero = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v);

export function isDebugInfoMessage(m: unknown): m is DebugInfoMessage {
  if (!isObject(m) || m.type !== DEBUG_INFO) return false;
  const hostOk =
    m.hostname === null || (typeof m.hostname === 'string' && normalizeHostname(m.hostname) === m.hostname);
  return (
    hostOk &&
    typeof m.running === 'boolean' &&
    typeof m.preset === 'string' &&
    finiteOrZero(m.processed) &&
    finiteOrZero(m.rules) &&
    finiteOrZero(m.duration) &&
    finiteOrZero(m.cacheHit)
  );
}
