import { afterEach, describe, expect, it, vi } from 'vitest';
import { contrastRatio, parseColor } from '../../src/engine/color';
import { ThemeEngine, type EngineConfig, type EngineStatus } from '../../src/engine/engine';
import { buildTokens } from '../../src/engine/palette';
import { cloneDefaults } from '../../src/shared/defaults';

const config = (over: Partial<EngineConfig> = {}, settings = cloneDefaults()): EngineConfig => ({ tokens: buildTokens(settings), skipNativeDarkCheck: false, ...over });
const settle = (ms = 80) => new Promise((r) => setTimeout(r, ms));
const rgb = (hex: string) => parseColor(`#${hex}`)!;
const managed = () => document.querySelectorAll('[data-nl-fg],[data-nl-bg],[data-nl-bt],[data-nl-br],[data-nl-bb],[data-nl-bl],[data-nl-link],[data-nl-fill],[data-nl-stroke],[data-nl-plate]');
const owned = () => document.querySelectorAll('[data-nl-owned]');

function page(html: string): void { document.body.innerHTML = html; }
const LIGHT = 'background-color:#ffffff;color:#000000;';

let engine: ThemeEngine | null = null;
afterEach(() => { engine?.stop(); engine = null; });
function run(cfg = config(), onStatus?: (s: EngineStatus) => void): ThemeEngine {
  engine = new ThemeEngine(document, window, { onStatus });
  engine.start(cfg);
  return engine;
}

describe('enabling', () => {
  it('maps light backgrounds to the theme background and makes dark text readable on it', async () => {
    page(`<main id="m" style="${LIGHT}"><p id="p" style="color:#333333">Hello</p></main>`);
    const cfg = config();
    run(cfg);
    await settle();
    const m = document.getElementById('m')!, p = document.getElementById('p')!;
    const bg = m.getAttribute('data-nl-bg')!;
    expect(bg).toHaveLength(6);
    expect(parseColor(`#${bg}`)).toMatchObject({ r: cfg.tokens.colors.bg.r, g: cfg.tokens.colors.bg.g, b: cfg.tokens.colors.bg.b });
    expect(contrastRatio(rgb(p.getAttribute('data-nl-fg')!), rgb(bg))).toBeGreaterThanOrEqual(4.5);
    expect(document.querySelector('style[data-nl-owned]')!.textContent).toContain('color-scheme:dark');
  });

  it('reaches AA contrast for a variety of text/background combinations', async () => {
    const combos = [['#ffffff', '#000000'], ['#f5f5f5', '#767676'], ['#fff8dc', '#8b4513'], ['#e0f0ff', '#003366'], ['#1a1a2e', '#cccccc'], ['#ffcccc', '#990000'], ['#222222', '#ffffff']];
    page(combos.map(([b, f], i) => `<div id="c${i}" style="background-color:${b};color:${f}"><span id="s${i}" style="color:${f}">x</span></div>`).join(''));
    run();
    await settle();
    combos.forEach((_, i) => {
      const bg = document.getElementById(`c${i}`)!.getAttribute('data-nl-bg');
      const fg = document.getElementById(`s${i}`)!.getAttribute('data-nl-fg')!;
      const bgColor = bg ? rgb(bg) : buildTokens(cloneDefaults()).colors.bg;
      expect(contrastRatio(rgb(fg), bgColor)).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('colours borders (subtle) and form-control borders (>= 3:1)', async () => {
    page(`<div id="box" style="${LIGHT}"><div id="card" style="border:1px solid #dddddd;padding:4px">x</div><input id="in" style="${LIGHT}border:1px solid #cccccc"></div>`);
    const cfg = config();
    run(cfg);
    await settle();
    const bg = rgb(document.getElementById('in')!.getAttribute('data-nl-bg')!);
    expect(document.getElementById('card')!.getAttribute('data-nl-bt')).not.toBeNull();
    const b = rgb(document.getElementById('in')!.getAttribute('data-nl-bt')!);
    expect(contrastRatio(b, bg)).toBeGreaterThanOrEqual(3);
  });

  it('keeps disabled controls recognisable but readable (>= 3:1)', async () => {
    page(`<div style="${LIGHT}"><input id="d" disabled style="${LIGHT}color:#999999"></div>`);
    run();
    await settle();
    const d = document.getElementById('d')!;
    expect(contrastRatio(rgb(d.getAttribute('data-nl-fg')!), rgb(d.getAttribute('data-nl-bg')!))).toBeGreaterThanOrEqual(3);
  });

  it('marks coloured links (for :visited styling) but not plain-text links', async () => {
    page(`<div style="${LIGHT}"><a id="blue" href="/a" style="color:#0000ee">a</a><a id="plain" href="/b" style="color:#222222">b</a></div>`);
    run();
    await settle();
    expect(document.getElementById('blue')!.hasAttribute('data-nl-link')).toBe(true);
    expect(document.getElementById('plain')!.hasAttribute('data-nl-link')).toBe(false);
    expect(contrastRatio(rgb(document.getElementById('blue')!.getAttribute('data-nl-fg')!), buildTokens(cloneDefaults()).colors.bg)).toBeGreaterThanOrEqual(4.5);
    expect(owned()[0]!.textContent).toContain('a[data-nl-link]:visited');
  });

  it('leaves author-controlled backgrounds (images/gradients) and their text alone', async () => {
    page(`<section id="hero" style="background-image:linear-gradient(#000,#333);color:#ffffff"><h1 id="t" style="color:#ffffff">Title</h1></section>`);
    run();
    await settle();
    expect(document.getElementById('hero')!.hasAttribute('data-nl-bg')).toBe(false);
    expect(document.getElementById('t')!.hasAttribute('data-nl-fg')).toBe(false);
  });

  it('recolours small inline SVG icons but not large illustrations', async () => {
    page(`<div style="${LIGHT}"><svg id="icon" width="16" height="16"><path id="ip" d="M0 0h8v8z" style="fill:#000000"/></svg><svg id="big" width="400" height="300"><path id="bp" d="M0 0h8v8z" style="fill:#000000"/></svg></div>`);
    run();
    await settle();
    expect(document.getElementById('ip')!.getAttribute('data-nl-fill')).not.toBeNull();
    expect(document.getElementById('bp')!.hasAttribute('data-nl-fill')).toBe(false);
  });

  it('puts big canvases and text-bearing SVG charts on their original light backdrop instead of altering pixels', async () => {
    page(`<div style="${LIGHT}"><canvas id="cv" width="300" height="150"></canvas><svg id="chart" width="300" height="200"><text>Sales</text></svg></div>`);
    run();
    await settle();
    expect(document.getElementById('cv')!.getAttribute('data-nl-plate')).toBe('ffffff');
    expect(document.getElementById('chart')!.getAttribute('data-nl-plate')).toBe('ffffff');
  });

  it('never touches images, video, audio, picture or iframes', async () => {
    page(`<div style="${LIGHT}"><img id="i" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" style="background-color:#fff;border:1px solid #ccc"><video id="v" style="background-color:#fff"></video><picture id="p"></picture><iframe id="f"></iframe></div>`);
    run();
    await settle();
    for (const id of ['i', 'v', 'p', 'f']) expect([...document.getElementById(id)!.attributes].some((a) => a.name.startsWith('data-nl'))).toBe(false);
  });

  it('themes open shadow roots with their own stylesheet', async () => {
    page(`<div id="host" style="${LIGHT}"></div>`);
    const root = document.getElementById('host')!.attachShadow({ mode: 'open' });
    root.innerHTML = `<p id="sp" style="background-color:#ffffff;color:#000000">in shadow</p>`;
    run();
    await settle();
    expect(root.getElementById('sp')!.getAttribute('data-nl-bg')).not.toBeNull();
    expect(root.querySelector('style[data-nl-owned]')).not.toBeNull();
    engine!.stop();
    expect(root.querySelector('style[data-nl-owned]')).toBeNull();
    expect(root.getElementById('sp')!.hasAttribute('data-nl-bg')).toBe(false);
  });
});

describe('canvas background propagation', () => {
  it('gives <html> the same mapped colour as a body that would have painted the canvas', async () => {
    document.body.setAttribute('style', 'background-color:#f3f2f1');
    page('<p>x</p>');
    run();
    await settle();
    const body = document.body.getAttribute('data-nl-bg');
    expect(body).not.toBeNull();
    expect(document.documentElement.getAttribute('data-nl-bg')).toBe(body);
  });
  it('does not override an <html> background of its own', async () => {
    document.documentElement.setAttribute('style', 'background-color:#ffffff');
    document.body.setAttribute('style', 'background-color:#f3f2f1');
    page('<p>x</p>');
    run();
    await settle();
    expect(document.documentElement.getAttribute('data-nl-bg')).not.toBe(document.body.getAttribute('data-nl-bg'));
  });
  it('stays correct after the body is re-themed', async () => {
    document.body.setAttribute('style', 'background-color:#f3f2f1');
    page('<p>x</p>');
    run();
    await settle();
    document.body.setAttribute('style', 'background-color:#cce5ff');
    await settle(200);
    expect(document.documentElement.getAttribute('data-nl-bg')).toBe(document.body.getAttribute('data-nl-bg'));
  });
});

describe('disabling and repeated activation', () => {
  const html = `<main style="${LIGHT}"><h1 style="color:#111">T</h1><a href="/x" style="color:#0000ee">l</a><svg width="16" height="16"><path d="M0 0h1" style="fill:#000"/></svg><canvas width="300" height="150"></canvas></main>`;

  it('restores the original DOM exactly when stopped', async () => {
    page(html);
    const before = document.documentElement.outerHTML;
    run();
    await settle();
    expect(managed().length).toBeGreaterThan(0);
    engine!.stop();
    expect(managed().length).toBe(0);
    expect(owned().length).toBe(0);
    expect(document.documentElement.outerHTML).toBe(before);
  });

  it('survives rapid enable/disable cycles without leaks', async () => {
    page(html);
    const before = document.documentElement.outerHTML;
    for (let i = 0; i < 6; i++) { const e = new ThemeEngine(document, window); e.start(config()); await settle(20); e.stop(); }
    expect(document.documentElement.outerHTML).toBe(before);
  });

  it('start() twice keeps exactly one pair of style elements', async () => {
    page(html);
    const e = run();
    e.start(config());
    await settle();
    expect(owned().length).toBe(2);
  });

  it('update() re-themes with new tokens', async () => {
    page(`<div id="d" style="${LIGHT}">x</div>`);
    const e = run();
    await settle();
    const first = document.getElementById('d')!.getAttribute('data-nl-bg');
    e.update(config({}, { ...cloneDefaults(), theme: 'highContrast' }));
    await settle();
    const second = document.getElementById('d')!.getAttribute('data-nl-bg');
    expect(second).not.toBe(first);
    expect(owned().length).toBe(2);
  });
});

describe('dynamic content', () => {
  it('themes elements inserted later (infinite scroll / SPA routes)', async () => {
    page(`<div id="feed"></div>`);
    run();
    await settle();
    const item = document.createElement('article');
    item.setAttribute('style', `${LIGHT}`);
    item.innerHTML = '<p style="color:#222222">new</p>';
    document.getElementById('feed')!.append(item);
    await settle();
    expect(item.getAttribute('data-nl-bg')).not.toBeNull();
    expect(item.querySelector('p')!.getAttribute('data-nl-fg')).not.toBeNull();
  });

  it('re-reads an element whose inline colours change', async () => {
    page(`<div id="d" style="background-color:#ffffff">x</div>`);
    run();
    await settle();
    const before = document.getElementById('d')!.getAttribute('data-nl-bg');
    document.getElementById('d')!.setAttribute('style', 'background-color:#cce5ff');
    await settle();
    const after = document.getElementById('d')!.getAttribute('data-nl-bg');
    expect(after).not.toBe(before);
    expect(after).not.toBeNull();
  });

  it('is quiescent: its own writes never trigger more processing (no MutationObserver feedback loop)', async () => {
    page(`<div style="${LIGHT}">${'<p style="color:#444">row</p>'.repeat(50)}</div>`);
    run();
    await settle(150);
    const seen: MutationRecord[] = [];
    const watcher = new MutationObserver((r) => seen.push(...r));
    watcher.observe(document, { subtree: true, attributes: true, childList: true, characterData: true });
    await settle(250);
    watcher.disconnect();
    expect(seen).toHaveLength(0);
  });

  it('processes large insertions in time-sliced batches and finishes', async () => {
    page(`<div id="root" style="${LIGHT}"></div>`);
    run();
    await settle();
    const root = document.getElementById('root')!;
    root.innerHTML = '<span style="color:#222">x</span>'.repeat(1500);
    const countUnthemed = () => [...root.children].filter((c) => !c.hasAttribute('data-nl-fg')).length;
    // jsdom's getComputedStyle is slow, so poll for completion instead of guessing a fixed delay.
    const progress: number[] = [];
    for (let i = 0; i < 100 && countUnthemed() > 0; i++) { await settle(50); progress.push(countUnthemed()); }
    expect(countUnthemed()).toBe(0);
    expect(new Set(progress).size).toBeGreaterThan(1); // it was processed in several slices, not one blocking pass
  });

  it('ignores style-attribute churn that cannot affect colours', async () => {
    page(`<div id="d" style="width:10px">x</div>`);
    run();
    await settle();
    const spy = vi.spyOn(window, 'getComputedStyle');
    for (let i = 0; i < 20; i++) document.getElementById('d')!.setAttribute('style', `width:${i}px`);
    await settle(100);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('performance settings are honored (not decorative)', () => {
  it('respects a custom batchSize: only N elements are themed per flush', async () => {
    page(`<div id="root" style="${LIGHT}">${'<p style="color:#222">x</p>'.repeat(30)}</div>`);
    run(config({ batchSize: 5 }));
    await settle(30);
    const done = document.querySelectorAll('#root p[data-nl-fg]').length;
    expect(done).toBeGreaterThan(0);
    expect(done).toBeLessThan(30); // not everything in one pass
    // eventually finishes
    for (let i = 0; i < 60 && document.querySelectorAll('#root p[data-nl-fg]').length < 30; i++) await settle(40);
    expect(document.querySelectorAll('#root p[data-nl-fg]').length).toBe(30);
  });

  it('enableCache=false still themes correctly and records no cache hits', async () => {
    page(`<main id="m" style="${LIGHT}"><p id="p" style="color:#333">Hello</p></main>`);
    const e = run(config({ enableCache: false }));
    await settle();
    expect(document.getElementById('p')!.getAttribute('data-nl-fg')).not.toBeNull();
    expect(e.getStats().cacheHit).toBe(0);
  });

  it('enableCache=true (default) produces cache hits on repeated colours', async () => {
    page(`<div style="${LIGHT}">${'<p style="color:#333333">x</p>'.repeat(10)}</div>`);
    const e = run(config());
    await settle();
    expect(e.getStats().cacheHit).toBeGreaterThan(0);
  });

  it('debounceMs is used for re-evaluation after a class change', async () => {
    page(`<p>x</p>`);
    const onStatus = vi.fn();
    run(config({ debounceMs: 400 }), onStatus);
    await settle();
    document.body.setAttribute('style', 'background-color:#101214');
    await settle(150); // shorter than the debounce: not yet re-evaluated
    expect(onStatus).not.toHaveBeenLastCalledWith('native-dark');
    await settle(500); // past the debounce
    expect(onStatus).toHaveBeenLastCalledWith('native-dark');
  });
});

describe('sites that already have a dark theme', () => {
  const dark = `<div style="background-color:#101214;color:#e8e8e8"><p style="color:#e8e8e8">dark</p></div>`;

  it('leaves a natively dark page untouched and reports it', async () => {
    document.body.setAttribute('style', 'background-color:#101214;color:#e8e8e8');
    page(dark);
    const onStatus = vi.fn();
    const before = document.documentElement.outerHTML;
    run(config(), onStatus);
    await settle();
    expect(onStatus).toHaveBeenCalledWith('native-dark');
    expect(managed().length).toBe(0);
    expect(owned().length).toBe(0);
    expect(document.documentElement.outerHTML).toBe(before);
  });

  it('applies anyway when the user forces it on for the site', async () => {
    document.body.setAttribute('style', 'background-color:#101214;color:#e8e8e8');
    page(dark);
    const onStatus = vi.fn();
    run(config({ skipNativeDarkCheck: true }), onStatus);
    await settle();
    expect(onStatus).toHaveBeenCalledWith('active');
    expect(owned().length).toBe(2);
  });

  it('reports active for a light page', async () => {
    page(`<p>light</p>`);
    const onStatus = vi.fn();
    run(config(), onStatus);
    await settle();
    expect(onStatus).toHaveBeenCalledWith('active');
  });

  it('notices when a site switches its own theme at runtime (class change on <body>)', async () => {
    page(`<p>x</p>`);
    const onStatus = vi.fn();
    run(config(), onStatus);
    await settle();
    document.body.setAttribute('style', 'background-color:#101214');
    await settle(300);
    expect(onStatus).toHaveBeenLastCalledWith('native-dark');
    expect(owned().length).toBe(0);
  });
});
