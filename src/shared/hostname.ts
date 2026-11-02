import type { SiteMode, SiteRules } from './types';

const LABEL = '[a-z0-9](?:[a-z0-9-]*[a-z0-9])?';
const HOST_RE = new RegExp(`^${LABEL}(?:\\.${LABEL})*$`);
const IPV6_RE = /^\[[0-9a-f:.]+\]$/;

/**
 * Matching rules (documented in docs/): hostnames are compared EXACTLY after
 * lower-casing and removing one trailing dot. Ports, schemes and paths are ignored.
 * "www.example.com" and "example.com" are different sites; subdomains are never inherited.
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

export function getSiteMode(rules: SiteRules, hostname: string | null): SiteMode | undefined {
  if (!hostname) return undefined;
  return Object.prototype.hasOwnProperty.call(rules, hostname) ? rules[hostname] : undefined;
}
