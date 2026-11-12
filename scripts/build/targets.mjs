/**
 * Build targets.
 *
 * Every target consumes byte-identical JavaScript bundles from one shared build; only the manifest
 * and the output location differ. That is what keeps the dark-mode engine single-source: the same
 * `content.js` runs on all seven browsers.
 */
export const TARGETS = {
  chrome: {
    id: 'chrome',
    family: 'chromium',
    label: 'Google Chrome',
    // Chromium targets load as unpacked extensions from this directory.
    output: 'chrome',
    manifest: 'chrome.json',
    docs: 'CHROME: docs/BROWSER_COMPATIBILITY.md',
  },
  edge: {
    id: 'edge',
    family: 'chromium',
    label: 'Microsoft Edge',
    output: 'edge',
    manifest: 'edge.json',
  },
  brave: {
    id: 'brave',
    family: 'chromium',
    label: 'Brave',
    output: 'brave',
    manifest: 'brave.json',
  },
  opera: {
    id: 'opera',
    family: 'chromium',
    label: 'Opera / Opera GX',
    output: 'opera',
    manifest: 'opera.json',
  },
  firefox: {
    id: 'firefox',
    family: 'firefox',
    label: 'Mozilla Firefox',
    output: 'firefox',
    manifest: 'firefox.json',
  },
  safari: {
    id: 'safari',
    family: 'safari',
    label: 'Safari (macOS)',
    // Apple's packaging requires the web extension to sit inside an Xcode project; the directory
    // produced here is the input to `safari-web-extension-converter`, not an installable app.
    output: 'safari/browser-extension',
    documentation: 'safari/documentation',
    manifest: 'safari.json',
  },
};

export const DEFAULT_TARGETS = ['chrome', 'edge', 'brave', 'opera', 'firefox', 'safari'];

/** Chromium-family targets share one manifest shape (MV3 + service worker). */
export const CHROMIUM_TARGETS = ['chrome', 'edge', 'brave', 'opera'];

export function resolveTargets(requested) {
  if (!requested || requested.length === 0) return [...DEFAULT_TARGETS];
  const unknown = requested.filter((id) => !(id in TARGETS));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown build target(s): ${unknown.join(', ')}. Valid targets: ${Object.keys(TARGETS).join(', ')}`,
    );
  }
  return [...new Set(requested)];
}
