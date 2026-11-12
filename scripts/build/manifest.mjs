import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Keys NightLens never needs. Their presence would widen what a store review has to trust. */
const FORBIDDEN_KEYS = [
  'externally_connectable',
  'optional_permissions',
  'optional_host_permissions',
  'web_accessible_resources',
  'devtools_page',
  'chrome_url_overrides',
  'sandbox',
  'key',
];

const HOST_PATTERN = /^https?:\/\/[^/]+\/\*$/;

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Deep-merges a target override onto the shared manifest. Arrays replace, and `null` removes a
 * key, so a target can delete a field the base declares (used for host permissions on Chromium).
 */
export function deepMerge(base, override) {
  if (!isPlainObject(override)) return override === undefined ? base : override;
  const out = isPlainObject(base) ? { ...base } : {};
  for (const [key, value] of Object.entries(override)) {
    if (value === null) {
      delete out[key];
    } else if (isPlainObject(value) && isPlainObject(out[key])) {
      out[key] = deepMerge(out[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function buildManifest({ root, target, version }) {
  const base = readJson(resolve(root, 'manifests/base.mv3.json'));
  const override = readJson(resolve(root, 'manifests', target.manifest));
  const pkg = readJson(resolve(root, 'package.json'));
  const manifest = deepMerge(base, override);
  manifest.version = version ?? pkg.version;
  return manifest;
}

/**
 * Structural validation, independent of the built files. Returns a list of human-readable
 * problems; an empty list means the manifest satisfies both the platform and NightLens' own
 * privacy invariants.
 */
export function validateManifest(manifest, targetId, target) {
  const problems = [];
  const fail = (message) => problems.push(`${targetId}: ${message}`);
  const family = target.family;

  if (manifest.manifest_version !== 3) fail('manifest_version must be 3');
  if (typeof manifest.name !== 'string' || manifest.name.length === 0) fail('name is required');
  if (typeof manifest.name === 'string' && manifest.name.length > 75) fail('name exceeds 75 characters');
  if (typeof manifest.description !== 'string' || manifest.description.length > 132) {
    fail('description is required and must stay within 132 characters');
  }
  if (typeof manifest.version !== 'string' || !/^\d+(\.\d+){0,3}$/.test(manifest.version)) {
    fail('version must be 1-4 dot-separated integers');
  }

  for (const key of FORBIDDEN_KEYS) {
    if (key in manifest) fail(`unexpected key "${key}" (NightLens does not need it)`);
  }

  // Privacy invariant: `storage` and nothing else.
  const permissions = manifest.permissions ?? [];
  if (JSON.stringify(permissions) !== JSON.stringify(['storage'])) {
    fail(`permissions must be exactly ["storage"], found ${JSON.stringify(permissions)}`);
  }

  const hosts = manifest.host_permissions ?? [];
  if (!Array.isArray(hosts)) {
    fail('host_permissions must be an array');
  } else {
    if (family === 'chromium' && hosts.length !== 0) {
      fail('Chromium builds must not declare host_permissions (content_scripts.matches covers it)');
    }
    if (family !== 'chromium') {
      // Firefox MV3 and Safari treat host access as a grant; declaring it is what makes
      // tabs.sendMessage and the content script work once the user allows the site.
      if (hosts.length === 0) fail('this engine needs an explicit host_permissions grant');
      for (const host of hosts) {
        if (!HOST_PATTERN.test(host)) fail(`host permission "${host}" must be an explicit http(s) origin`);
      }
    }
  }

  const background = manifest.background ?? {};
  if (family === 'chromium') {
    if (typeof background.service_worker !== 'string') fail('Chromium requires background.service_worker');
    if ('scripts' in background) fail('Chromium must not declare background.scripts');
  } else {
    if (!Array.isArray(background.scripts) || background.scripts.length === 0) {
      fail(`${family} requires a non-persistent background.scripts event page`);
    }
    if ('service_worker' in background) fail(`${family} still cannot run a background service worker reliably`);
  }

  const gecko = manifest.browser_specific_settings?.gecko;
  if (family === 'firefox') {
    if (!gecko || typeof gecko.id !== 'string' || !gecko.id.includes('@')) {
      fail('Firefox MV3 requires browser_specific_settings.gecko.id');
    }
    if (typeof gecko?.strict_min_version !== 'string') fail('Firefox requires gecko.strict_min_version');
    const declared = gecko?.data_collection_permissions?.required;
    if (JSON.stringify(declared) !== JSON.stringify(['none'])) {
      fail('Firefox requires data_collection_permissions.required to be ["none"]');
    }
  } else if (gecko) {
    fail('gecko settings must appear only in the Firefox build');
  }

  const scripts = manifest.content_scripts ?? [];
  if (!Array.isArray(scripts) || scripts.length !== 1) {
    fail('exactly one content_scripts entry is expected');
  } else {
    const entry = scripts[0];
    if (JSON.stringify(entry.matches) !== JSON.stringify(['http://*/*', 'https://*/*'])) {
      fail('content scripts must match http/https only');
    }
    if (JSON.stringify(entry.js) !== JSON.stringify(['content.js'])) fail('content script must be content.js');
    if (entry.run_at !== 'document_start') fail('content script must run at document_start');
    if (entry.all_frames !== true) fail('content script must cover all frames');
  }

  if (manifest.action?.default_popup !== 'popup/index.html') fail('action.default_popup must be popup/index.html');
  if (manifest.options_ui?.page !== 'options/index.html') fail('options_ui.page must be options/index.html');

  const toggle = manifest.commands?.['toggle-nightlens'];
  if (!toggle || typeof toggle.description !== 'string' || toggle.description.length === 0) {
    fail('the toggle-nightlens command needs a description');
  }

  const icons = manifest.icons ?? {};
  for (const size of ['16', '48', '128']) {
    if (!icons[size]) fail(`icons.${size} is required`);
  }

  if (family === 'chromium' && typeof manifest.minimum_chrome_version !== 'string') {
    fail('Chromium builds must state minimum_chrome_version');
  }
  if (family === 'chromium' && !/^\d+$/.test(manifest.minimum_chrome_version ?? '')) {
    fail('minimum_chrome_version must be a major version');
  }

  return problems;
}

/** Checks that every path the manifest references is actually present in the build output. */
export function validateManifestFiles(manifest, directory) {
  const problems = [];
  const check = (relativePath, label) => {
    if (typeof relativePath !== 'string' || relativePath.length === 0) return;
    if (relativePath.startsWith('/') || relativePath.includes('..')) {
      problems.push(`${label}: "${relativePath}" must be a relative path inside the bundle`);
      return;
    }
    if (!existsSync(resolve(directory, relativePath))) {
      problems.push(`${label}: "${relativePath}" is missing from ${directory}`);
    }
  };

  for (const [size, path] of Object.entries(manifest.icons ?? {})) check(path, `icons.${size}`);
  for (const [size, path] of Object.entries(manifest.action?.default_icon ?? {})) check(path, `action.default_icon.${size}`);
  check(manifest.action?.default_popup, 'action.default_popup');
  check(manifest.options_ui?.page, 'options_ui.page');
  for (const path of manifest.background?.scripts ?? []) check(path, 'background.scripts');
  check(manifest.background?.service_worker, 'background.service_worker');
  for (const entry of manifest.content_scripts ?? []) {
    for (const path of entry.js ?? []) check(path, 'content_scripts.js');
    for (const path of entry.css ?? []) check(path, 'content_scripts.css');
  }
  return problems;
}
