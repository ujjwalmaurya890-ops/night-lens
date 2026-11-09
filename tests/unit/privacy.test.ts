import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const sourceFiles = walk(resolve(root, 'src')).filter((f) => /\.(ts|tsx|json)$/.test(f));
const sourceText = sourceFiles.map((f) => ({ file: f, text: readFileSync(f, 'utf8') }));
const manifest = JSON.parse(readFileSync(resolve(root, 'src/manifest.json'), 'utf8')) as Record<string, unknown>;
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

/**
 * These assertions are the machine-checkable half of docs/PRIVACY.md. If a future change adds
 * network access, telemetry, or a wider permission, this suite fails and the documentation must
 * be revisited in the same pull request.
 */
describe('privacy invariants (contribution 17)', () => {
  const forbidden: Array<[string, RegExp]> = [
    ['network requests', /\bfetch\s*\(|XMLHttpRequest|new\s+WebSocket|navigator\.sendBeacon/],
    ['dynamic code execution', /\beval\s*\(|new\s+Function\s*\(/],
    ['HTML injection', /\.innerHTML\s*=|outerHTML\s*=|\bdocument\.write\b|insertAdjacentHTML/],
    ['browser storage outside chrome.storage', /\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b/],
    ['history or cookie access', /chrome\.history|chrome\.cookies|chrome\.webRequest|chrome\.debugger/],
    ['script injection APIs', /chrome\.scripting|chrome\.tabs\.executeScript/],
  ];

  it.each(forbidden)('never uses %s in extension source', (_label, pattern) => {
    const offenders = sourceText.filter(({ text }) => pattern.test(text)).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('imports no analytics, tracking, or remote-configuration dependency', () => {
    const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    const suspicious = names.filter((name) =>
      /analytic|track|sentry|segment|amplitude|mixpanel|datadog|telemetry|bugsnag|hotjar|posthog/i.test(name),
    );
    expect(suspicious).toEqual([]);
    // The runtime dependency list is small enough to audit by hand.
    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual([
      '@fontsource-variable/inter',
      '@fontsource-variable/jetbrains-mono',
      '@fontsource-variable/plus-jakarta-sans',
      'lucide-react',
      'react',
      'react-dom',
    ]);
  });

  it('asks for the minimum permissions and no host permissions', () => {
    expect(manifest.permissions).toEqual(['storage']);
    expect(manifest.host_permissions).toEqual([]);
    expect(manifest).not.toHaveProperty('externally_connectable');
    expect(manifest).not.toHaveProperty('web_accessible_resources');
    expect(manifest).not.toHaveProperty('optional_permissions');
    expect(JSON.stringify(manifest.permissions)).not.toMatch(/tabs|history|cookies|webRequest|scripting/);
  });

  it('injects only into http and https pages, at document_start, without evaluation', () => {
    const scripts = manifest.content_scripts as Array<Record<string, unknown>>;
    expect(scripts).toHaveLength(1);
    expect(scripts[0]!.matches).toEqual(['http://*/*', 'https://*/*']);
    expect(scripts[0]!.run_at).toBe('document_start');
    expect(scripts[0]).not.toHaveProperty('world');
    expect(String(scripts[0]!.js)).not.toMatch(/eval|remote|http/i);
  });

  it('stores settings only under the documented local key', () => {
    const keys = [...new Set(sourceText.flatMap(({ text }) => [...text.matchAll(/'(nightlens:[a-z-]+)'/g)].map((m) => m[1]!)))];
    expect(keys.sort()).toEqual(['nightlens:settings']);
    const storageAreas = sourceText.flatMap(({ text }) => [...text.matchAll(/chrome\.storage\.(local|sync|session)/g)].map((m) => m[1]!));
    expect([...new Set(storageAreas)]).toEqual(['local']);
  });

  it('documents the data flow in docs/PRIVACY.md, matching what the code does', () => {
    const doc = readFileSync(resolve(root, 'docs/PRIVACY.md'), 'utf8');
    expect(doc).toContain('nightlens:settings');
    expect(doc).toMatch(/chrome\.storage\.local/);
    expect(doc).toMatch(/no network/i);
    expect(doc).toMatch(/uninstall/i);
    expect(doc).toMatch(/storage/);
  });
});
