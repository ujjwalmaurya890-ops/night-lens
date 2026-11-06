import type { SiteMode, SiteRules } from './types';

const LABEL = '[a-z0-9](?:[a-z0-9-]*[a-z0-9])?';
const HOST_RE = new RegExp(`^${LABEL}(?:\\.${LABEL})*$`);
const IPV6_RE = /^\[[0-9a-f:.]+\]$/;

/**
 * Hostnames are normalized by lower-casing and removing one trailing dot. Ports,
 * schemes and paths are ignored. A rule for example.com also covers its subdomains;
 * the nearest (most specific) rule wins. IP addresses and single-label hosts match
 * exactly, so unrelated suffixes such as notexample.com never inherit a rule.
 */
export function normalizeHostname(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  let h = input.trim().toLowerCase();
  if (h.endsWith('.')) h = h.slice(0, -1);
  if (h.length === 0 || h.length > 253) return null;
  return HOST_RE.test(h) || IPV6_RE.test(h) ? h : null;
}

/** Accepts "example.com", "https://Example.com:8080/path?q" etc. and returns a normalized hostname. */
export function hostnameFromUserInput(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `http://${text}`);
    return normalizeHostname(url.hostname);
  } catch {
    return null;
  }
}

/** Returns the closest matching entry, walking from the exact host to parent domains. */
export function getSiteEntry<T>(entries: Record<string, T>, hostname: string | null): T | undefined {
  const host = normalizeHostname(hostname);
  if (!host || !host.includes('.') || host.startsWith('[') || /^\d+(?:\.\d+){3}$/.test(host)) {
    return host && Object.prototype.hasOwnProperty.call(entries, host) ? entries[host] : undefined;
  }
  const labels = host.split('.');
  for (let i = 0; i < labels.length - 1; i++) {
    const candidate = labels.slice(i).join('.');
    if (Object.prototype.hasOwnProperty.call(entries, candidate)) return entries[candidate];
  }
  return undefined;
}

/** Returns the matching rule's hostname, useful for explaining inherited settings. */
export function getSiteEntryHost<T>(entries: Record<string, T>, hostname: string | null): string | null {
  const host = normalizeHostname(hostname);
  if (!host) return null;
  if (Object.prototype.hasOwnProperty.call(entries, host)) return host;
  if (!host.includes('.') || host.startsWith('[') || /^\d+(?:\.\d+){3}$/.test(host)) return null;
  const labels = host.split('.');
  for (let i = 1; i < labels.length - 1; i++) {
    const candidate = labels.slice(i).join('.');
    if (Object.prototype.hasOwnProperty.call(entries, candidate)) return candidate;
  }
  return null;
}

export function getSiteMode(rules: SiteRules, hostname: string | null): SiteMode | undefined {
  return getSiteEntry(rules, hostname);
}
