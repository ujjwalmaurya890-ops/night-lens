import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeEngine, configSignature, type EngineConfig } from '../../src/engine/engine';
import { buildTokens } from '../../src/engine/palette';
import { cloneDefaults } from '../../src/shared/defaults';
import type { Settings } from '../../src/shared/types';

const LIGHT = 'background-color:#ffffff;color:#000000;';
const settle = (ms = 90) => new Promise((r) => setTimeout(r, ms));
const config = (over: Partial<EngineConfig> = {}, settings: Settings = cloneDefaults()): EngineConfig => ({
  tokens: buildTokens(settings),
  skipNativeDarkCheck: false,
  ...over,
});
const managed = (root: ParentNode = document) =>
  root.querySelectorAll('[data-nl-fg],[data-nl-bg],[data-nl-bt],[data-nl-br],[data-nl-bb],[data-nl-bl],[data-nl-link],[data-nl-fill],[data-nl-stroke],[data-nl-plate]');
const owned = (root: ParentNode = document) => root.querySelectorAll('[data-nl-owned]');

let engines: ThemeEngine[] = [];
afterEach(() => { for (const e of engines) e.stop(); engines = []; vi.restoreAllMocks(); });

function start(cfg = config(), onStatus?: (s: 'active' | 'native-dark') => void): ThemeEngine {
  const engine = new ThemeEngine(document, window, { onStatus });
  engines.push(engine);
  engine.start(cfg);
  return engine;
}

function page(html: string): void { document.body.innerHTML = html; }

describe('contribution 01 — dynamic detection', () => {
  it('re-processes elements whose theme-related data attributes change', async () => {
    page(`<div id="wrap" style="${LIGHT}"><p id="p" style="color:#333333">x</p></div>`);
    start();
    await settle();
    const spy = vi.spyOn(window, 'getComputedStyle');
    document.getElementById('wrap')!.setAttribute('data-theme', 'dark');
    await settle(250);
    expect(spy).toHaveBeenCalled();
  });

  it('processes every element of a large single insertion (no unstyled tail)', async () => {
    page('<div id="root"></div>');
    start(config({ batchSize: 200 }));
    await settle();
    const root = document.getElementById('root')!;
    root.innerHTML = '<span style="color:#222222">x</span>'.repeat(1200);
    for (let i = 0; i < 120 && managed(root).length < 1200; i++) await settle(50);
    expect(managed(root).length).toBe(1200);
  }, 30_000);

  it('does not reprocess an unchanged document in a loop', async () => {
    page(`<div style="${LIGHT}">${'<p style="color:#444444">row</p>'.repeat(40)}</div>`);
    const engine = start();
    await settle(200);
    const processedAfterFirstPass = engine.getStats().processed;
    await settle(300);
    expect(engine.getStats().processed).toBe(processedAfterFirstPass);
  });
});

describe('contribution 03 — native-dark detection integration', () => {
  it('leaves a page whose dark <meta name="color-scheme"> hides a transparent body alone', async () => {
    document.head.innerHTML = '<meta name="color-scheme" content="dark">';
    page('<p style="color:#e8e8e8">already dark</p>');
    const onStatus = vi.fn();
    start(config(), onStatus);
    await settle();
    expect(onStatus).toHaveBeenCalledWith('native-dark');
    expect(owned().length).toBe(0);
  });

  it('still themes a page that explicitly declares only a light scheme', async () => {
    document.head.innerHTML = '<meta name="color-scheme" content="light">';
    page(`<div style="${LIGHT}">x</div>`);
    const onStatus = vi.fn();
    start(config(), onStatus);
    await settle();
    expect(onStatus).toHaveBeenCalledWith('active');
    expect(owned().length).toBe(2);
  });
});

describe('contribution 04 — SPA history patching', () => {
  it('keeps working for the remaining engine after one stops, and stops patching once all do', async () => {
    // jsdom returns a fresh bound function for every `history.pushState` access, so identity is
    // not a usable assertion; behaviour of the shared wrapper is.
    page(`<div id="app" style="${LIGHT}">a</div>`);
    const a = start();
    await settle();
    const b = start();
    await settle();

    a.stop();
    engines = engines.filter((e) => e !== a);
    document.getElementById('app')!.innerHTML = '<p id="afterA" style="color:#333333">x</p>';
    window.history.pushState({}, '', '#after-a');
    await settle(300);
    expect(document.getElementById('afterA')!.getAttribute('data-nl-fg')).not.toBeNull();

    b.stop();
    engines = engines.filter((e) => e !== b);
    await settle();
    document.getElementById('app')!.innerHTML = '<p id="afterB" style="color:#333333">x</p>';
    window.history.pushState({}, '', '#after-b');
    await settle(300);
    expect(document.getElementById('afterB')!.hasAttribute('data-nl-fg')).toBe(false);
    expect(owned().length).toBe(0);
  });

  it('notifies every live engine on a same-document navigation and keeps working afterwards', async () => {
    page(`<div id="app" style="${LIGHT}">a</div>`);
    start();
    await settle();
    const app = document.getElementById('app')!;
    app.innerHTML = '<p id="p" style="color:#333333">b</p>';
    window.history.pushState({}, '', '#route-2');
    await settle(350);
    expect(document.getElementById('p')!.getAttribute('data-nl-fg')).not.toBeNull();
  });
});

describe('contribution 05 — shadow DOM lifecycle', () => {
  it('themes content added inside an already-themed open shadow root', async () => {
    page(`<div id="host"></div>`);
    const root = document.getElementById('host')!.attachShadow({ mode: 'open' });
    root.innerHTML = `<p id="first" style="${LIGHT}">one</p>`;
    start();
    await settle();
    const second = document.createElement('p');
    second.id = 'second';
    second.setAttribute('style', LIGHT);
    root.append(second);
    await settle(150);
    expect(root.getElementById('second')!.getAttribute('data-nl-bg')).not.toBeNull();
  });

  it('strips managed attributes from a shadow root whose host is removed', async () => {
    page('<div id="wrap"><div id="host"></div></div>');
    const host = document.getElementById('host')!;
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<p id="sp" style="${LIGHT}">in shadow</p>`;
    start();
    await settle();
    expect(root.getElementById('sp')!.getAttribute('data-nl-bg')).not.toBeNull();

    host.remove();
    await settle(150);
    expect(root.getElementById('sp')!.hasAttribute('data-nl-bg')).toBe(false);
    expect(root.querySelector('style[data-nl-owned]')).toBeNull();

    document.getElementById('wrap')!.append(host);
    await settle(200);
    const value = root.getElementById('sp')!.getAttribute('data-nl-bg');
    expect(value).not.toBeNull();
    // The attribute must again be backed by a generated rule, not a stale orphan value.
    expect(owned().length).toBeGreaterThan(0);
    const css = [...document.querySelectorAll('style[data-nl-owned]')].map((s) => s.textContent).join('');
    expect(css).toContain(`[data-nl-bg="${value}"]`);
  });
});

describe('contribution 11 — performance', () => {
  it('configSignature is stable for equal configs and changes with the theme', () => {
    const a = config();
    expect(configSignature(a)).toBe(configSignature(config()));
    expect(configSignature(a)).not.toBe(configSignature(config({}, { ...cloneDefaults(), theme: 'nord' })));
    expect(configSignature(a)).not.toBe(configSignature(config({ accessibility: { underlineLinks: true } })));
  });

  it('update() with an identical effective config does no work at all', async () => {
    page(`<div style="${LIGHT}"><p style="color:#333">x</p></div>`);
    const engine = start();
    await settle();
    const spy = vi.spyOn(window, 'getComputedStyle');
    engine.update(config());
    engine.update(config());
    await settle(120);
    expect(spy).not.toHaveBeenCalled();
  });

  it('update() with a changed theme does re-theme', async () => {
    page(`<div id="d" style="${LIGHT}">x</div>`);
    const engine = start();
    await settle();
    const before = document.getElementById('d')!.getAttribute('data-nl-bg');
    engine.update(config({}, { ...cloneDefaults(), theme: 'highContrast' }));
    await settle(150);
    expect(document.getElementById('d')!.getAttribute('data-nl-bg')).not.toBe(before);
  });

  it('never forces layout for ordinary elements (geometry is only read for canvas/SVG)', async () => {
    page(`<div style="${LIGHT}">${'<p style="color:#333">x</p>'.repeat(30)}</div>`);
    const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect');
    start();
    await settle();
    expect(managed().length).toBeGreaterThan(0);
    expect(rect).not.toHaveBeenCalled();
  });

  it('still measures canvases so their plate logic keeps working', async () => {
    page(`<div style="${LIGHT}"><canvas id="cv" width="300" height="150"></canvas></div>`);
    const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect');
    start();
    await settle();
    expect(rect).toHaveBeenCalled();
    expect(document.getElementById('cv')!.getAttribute('data-nl-plate')).toBe('ffffff');
  });
});

describe('contribution 14 — restoration', () => {
  const html = `<main id="m" style="${LIGHT}"><h1 style="color:#111">T</h1><a href="/x" style="color:#0000ee">l</a><svg width="16" height="16"><path style="fill:#000"/></svg><canvas width="300" height="150"></canvas></main>`;

  it('restores the document exactly across repeated enable/disable cycles', async () => {
    page(html);
    const before = document.documentElement.outerHTML;
    for (let i = 0; i < 4; i++) {
      const engine = new ThemeEngine(document, window);
      engine.start(config());
      await settle(40);
      expect(managed().length).toBeGreaterThan(0);
      engine.stop();
      expect(managed().length).toBe(0);
      expect(owned().length).toBe(0);
      expect(document.documentElement.hasAttribute('data-nl-ready')).toBe(false);
      expect(document.documentElement.outerHTML).toBe(before);
    }
  });

  it('does not leave a ready marker or styles behind when stopped before the first flush', async () => {
    page(html);
    const engine = new ThemeEngine(document, window);
    engine.start(config());
    engine.stop();
    expect(owned().length).toBe(0);
    expect(document.documentElement.hasAttribute('data-nl-ready')).toBe(false);
  });

  it('stops scheduling work after stop()', async () => {
    page(`<div id="d" style="${LIGHT}">x</div>`);
    const engine = start();
    await settle();
    engine.stop();
    engines = [];
    const app = document.createElement('p');
    app.setAttribute('style', LIGHT);
    document.body.append(app);
    await settle(200);
    expect(managed(app).length).toBe(0);
    expect(owned().length).toBe(0);
  });
});
