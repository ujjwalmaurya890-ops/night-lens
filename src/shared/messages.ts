import { normalizeHostname } from './hostname';
import { SITE_MODES, SITE_STATUSES, type SiteMode, type SiteStatus } from './types';

export const GET_STATUS = 'nightlens/get-status' as const;
export const STATUS_CHANGED = 'nightlens/status-changed' as const;

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
