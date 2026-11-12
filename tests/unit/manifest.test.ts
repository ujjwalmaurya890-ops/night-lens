import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildManifest, deepMerge, validateManifest } from '../../scripts/build/manifest.mjs';
import { DEFAULT_TARGETS, TARGETS } from '../../scripts/build/targets.mjs';

const root = process.cwd();
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { version: string };

const built = DEFAULT_TARGETS.map((id) => ({
  id,
  target: TARGETS[id],
  manifest: buildManifest({ root, target: TARGETS[id] }) as Record<string, unknown>,
}));

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe('browser-specific manifests', () => {
  it('are generated for every declared target with no validation problems', () => {
    expect(built.map((entry) => entry.id)).toEqual(['chrome', 'edge', 'brave', 'opera', 'firefox', 'safari']);
    for (const { id, target, manifest } of built) {
      expect(validateManifest(manifest, id, target), id).toEqual([]);
      expect(manifest.version, id).toBe(pkg.version);
      expect(manifest.manifest_version, id).toBe(3);
    }
  });

  it('run a service worker on Chromium and an event page everywhere else', () => {
    for (const { id, manifest } of built) {
      const background = manifest.background as Record<string, unknown>;
      if (['chrome', 'edge', 'brave', 'opera'].includes(id)) {
        expect(background.service_worker, id).toBe('background.js');
        expect(background, id).not.toHaveProperty('scripts');
      } else {
        expect(background.scripts, id).toEqual(['background.js']);
        expect(background, id).not.toHaveProperty('service_worker');
      }
    }
  });

  it('declares the Gecko identity, minimum version and data-collection policy Firefox requires', () => {
    const firefox = built.find((entry) => entry.id === 'firefox')!.manifest as {
      browser_specific_settings: { gecko: Record<string, unknown> };
    };
    const gecko = firefox.browser_specific_settings.gecko;
    expect(gecko.id).toMatch(/@/);
    expect(Number(String(gecko.strict_min_version).split('.')[0])).toBeGreaterThanOrEqual(140);
    expect(gecko.data_collection_permissions).toEqual({ required: ['none'] });
    for (const { id, manifest } of built) {
      if (id !== 'firefox') expect(manifest).not.toHaveProperty('browser_specific_settings');
    }
  });

  it('keeps the keyboard toggle on every engine that ships the commands API', () => {
    for (const { id, manifest } of built) {
      const commands = manifest.commands as Record<string, { description?: string }>;
      expect(commands['toggle-nightlens']?.description, id).toBeTruthy();
    }
  });
});

describe('manifest generator', () => {
  it('injects the package version and keeps shared keys', () => {
    const manifest = buildManifest({ root, target: TARGETS.chrome });
    expect(manifest.version).toBe(pkg.version);
    expect(manifest.name).toBe('NightLens');
    expect(manifest.options_ui).toEqual({ page: 'options/index.html', open_in_tab: true });
  });

  it('merges overrides deeply, replaces arrays and deletes keys set to null', () => {
    const merged = deepMerge(
      { a: { b: 1, c: 2 }, list: [1, 2], gone: true },
      { a: { c: 3 }, list: [9], gone: null },
    ) as Record<string, unknown>;
    expect(merged).toEqual({ a: { b: 1, c: 3 }, list: [9] });
  });
});

describe('manifest validation catches context-breaking mistakes', () => {
  const chrome = built.find((entry) => entry.id === 'chrome')!;
  const firefox = built.find((entry) => entry.id === 'firefox')!;
  const safari = built.find((entry) => entry.id === 'safari')!;

  const problemsFor = (entry: (typeof built)[number], mutate: (manifest: Record<string, unknown>) => void) => {
    const manifest = clone(entry.manifest);
    mutate(manifest);
    return validateManifest(manifest, entry.id, entry.target);
  };

  it('rejects an extra permission', () => {
    expect(problemsFor(chrome, (m) => { m.permissions = ['storage', 'tabs']; }).join()).toMatch(/permissions/);
  });

  it('rejects a Chromium build without a service worker', () => {
    expect(problemsFor(chrome, (m) => { delete m.background; }).join()).toMatch(/service_worker/);
  });

  it('rejects a Firefox build that asks for a service worker or forgets its Gecko id', () => {
    expect(problemsFor(firefox, (m) => { m.background = { service_worker: 'background.js' }; }).join()).toMatch(/event page/);
    expect(
      problemsFor(firefox, (m) => {
        (m.browser_specific_settings as { gecko: Record<string, unknown> }).gecko.id = '';
      }).join(),
    ).toMatch(/gecko.id/);
  });

  it('rejects a Firefox build that drops the data-collection declaration', () => {
    expect(
      problemsFor(firefox, (m) => {
        const gecko = (m.browser_specific_settings as { gecko: Record<string, unknown> }).gecko;
        delete gecko.data_collection_permissions;
      }).join(),
    ).toMatch(/data_collection_permissions/);
  });

  it('rejects host permissions that are broader than http/https', () => {
    expect(problemsFor(safari, (m) => { m.host_permissions = ['<all_urls>']; }).join()).toMatch(/http\(s\)/);
    expect(problemsFor(chrome, (m) => { m.host_permissions = ['https://*/*']; }).join()).toMatch(/must not declare/);
  });

  it('rejects API surfaces NightLens does not need', () => {
    expect(problemsFor(chrome, (m) => { m.web_accessible_resources = []; }).join()).toMatch(/web_accessible_resources/);
    expect(problemsFor(chrome, (m) => { m.externally_connectable = { matches: [] }; }).join()).toMatch(/externally_connectable/);
  });

  it('rejects content scripts outside the supported scheme or run timing', () => {
    expect(problemsFor(chrome, (m) => {
      (m.content_scripts as Array<Record<string, unknown>>)[0]!.matches = ['<all_urls>'];
    }).join()).toMatch(/http\/https/);
    expect(problemsFor(chrome, (m) => {
      (m.content_scripts as Array<Record<string, unknown>>)[0]!.run_at = 'document_idle';
    }).join()).toMatch(/document_start/);
  });
});
