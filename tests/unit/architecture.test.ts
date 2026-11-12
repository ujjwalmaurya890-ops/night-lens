import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Guards the cross-browser architecture against erosion.
 *
 * Everything browser-specific must live in src/adapters/browser/. If a future change reaches for
 * `chrome.*` in a component or sniffs a user agent in the engine, these tests fail before the
 * difference can reach a Firefox or Safari build.
 */
const root = process.cwd();
const src = resolve(root, 'src');
const ADAPTER_DIR = resolve(src, 'adapters/browser');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** Removes comments and string/template literals so only real code is inspected. */
function codeOnly(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|\s)\/\/[^\n]*/g, ' ')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""');
}

const files = walk(src).filter((file) => /\.(ts|tsx)$/.test(file));
const outsideAdapters = files.filter((file) => !file.startsWith(ADAPTER_DIR));
const sources = files.map((file) => ({ file, raw: readFileSync(file, 'utf8') }));
const codeSources = sources.map(({ file, raw }) => ({ file, code: codeOnly(raw) }));
const relative = (file: string): string => '@/' + file.slice(src.length + 1).replace(/\\/g, '/');

describe('browser API isolation', () => {
  it('uses the chrome/browser namespace only inside the adapter layer', () => {
    const offenders = codeSources
      .filter(({ file }) => !file.startsWith(ADAPTER_DIR))
      .filter(({ code }) => /\b(chrome|browser)\s*\./.test(code))
      .map(({ file }) => relative(file));
    expect(offenders).toEqual([]);
  });

  it('does not read the user agent or platform outside the adapter layer', () => {
    const offenders = codeSources
      .filter(({ file }) => !file.startsWith(ADAPTER_DIR))
      .filter(({ code }) => /navigator\.(userAgent|platform|vendor)|userAgentData/.test(code))
      .map(({ file }) => relative(file));
    expect(offenders).toEqual([]);
  });

  it('keeps application code importing the adapter facade, not the concrete adapters', () => {
    const offenders = codeSources
      .filter(({ file }) => !file.startsWith(ADAPTER_DIR))
      .filter(({ code }) => /from\s+"(\.\.?\/)+adapters\/browser\/(chrome|firefox|safari)\.adapter"/.test(code))
      .map(({ file }) => relative(file));
    expect(offenders).toEqual([]);
  });

  it('ships generated manifests instead of one hardcoded manifest', () => {
    expect(existsSync(resolve(src, 'manifest.json'))).toBe(false);
    const manifests = readdirSync(resolve(root, 'manifests')).filter((f) => f.endsWith('.json'));
    expect(manifests.sort()).toEqual([
      'base.mv3.json', 'brave.json', 'chrome.json', 'edge.json', 'firefox.json', 'opera.json', 'safari.json',
    ]);
  });

  it('keeps the shared engines free of per-browser branches', () => {
    const engineFiles = codeSources.filter(({ file }) => /[\\/]engine[\\/]/.test(file));
    expect(engineFiles.length).toBeGreaterThan(5);
    for (const { file, code } of engineFiles) {
      expect(code, relative(file)).not.toMatch(/family\s*===|info\.name|isFirefox|isSafari|isChrome/);
    }
  });

  it('does not add a second copy of the theming code per target', () => {
    // One content entry point, imported by the single build for all targets.
    const contentEntries = files.filter((file) => /src[\\/]content[\\/]index\.ts$/.test(file));
    expect(contentEntries).toHaveLength(1);
    expect(readFileSync(contentEntries[0]!, 'utf8')).toMatch(/startContentScript/);
  });

  it('keeps every UI surface reachable from both popup and options entry points', () => {
    for (const entry of ['src/popup/main.tsx', 'src/options/main.tsx', 'src/popup/index.html', 'src/options/index.html']) {
      expect(existsSync(resolve(root, entry)), entry).toBe(true);
    }
    expect(outsideAdapters.length).toBeGreaterThan(10);
  });
});
