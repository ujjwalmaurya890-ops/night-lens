import { chromium, expect, test as base, type BrowserContext, type Frame, type Page, type Worker } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, extname } from 'node:path';

export const DIST = resolve(process.cwd(), 'dist');
const FIXTURES = resolve(process.cwd(), 'tests/e2e/fixtures');
const CHROMIUM = process.env.NIGHTLENS_CHROMIUM ?? chromium.executablePath();
export const PORT_A = 4101;
export const PORT_B = 4102;
export const ORIGIN_A = `http://127.0.0.1:${PORT_A}`; // hostname "127.0.0.1"
export const ORIGIN_B = `http://localhost:${PORT_B}`; // different hostname AND origin
export const STORAGE_KEY = 'nightlens:settings';

const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.css': 'text/css' };

function serve(port: number): Promise<Server> {
  const server = createServer((req, res) => {
    const name = (req.url ?? '/').split('?')[0]!.replace(/^\//, '');
    if (name === 'favicon.ico') { res.writeHead(204).end(); return; } // browsers request this automatically
    const file = join(FIXTURES, name);
    if (!name || name.includes('..') || !existsSync(file)) { res.writeHead(404).end('not found'); return; }
    let body = readFileSync(file, 'utf8').replace('__CROSS__', port === PORT_A ? ORIGIN_B : ORIGIN_A);
    const headers: Record<string, string> = { 'content-type': TYPES[extname(file)] ?? 'text/plain' };
    if (name === 'csp.html') headers['content-security-policy'] = "default-src 'self'; style-src 'self'; script-src 'none'";
    res.writeHead(200, headers).end(body);
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok(server)));
}

interface Fixtures { context: BrowserContext; sw: Worker; extensionId: string; setSettings: (s: Record<string, unknown>) => Promise<void> }
interface WorkerFixtures { servers: Server[] }

export const test = base.extend<Fixtures, WorkerFixtures>({
  servers: [async ({}, use) => { const s = [await serve(PORT_A), await serve(PORT_B)]; await use(s); s.forEach((x) => x.close()); }, { scope: 'worker', auto: true }],
  context: async ({}, use) => {
    const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'nightlens-')), {
      executablePath: CHROMIUM, headless: false,
      args: ['--headless=new', `--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--no-sandbox'],
    });
    await use(ctx);
    await ctx.close();
  },
  sw: async ({ context }, use) => { await use(context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'))); },
  extensionId: async ({ sw }, use) => { await use(new URL(sw.url()).host); },
  setSettings: async ({ sw }, use) => {
    await use(async (s) => {
      // A freshly started service worker can briefly lack chrome.storage; wait for it, but fail loudly on anything else.
      for (let attempt = 0; ; attempt++) {
        try {
          await sw.evaluate(([k, v]) => chrome.storage.local.set({ [k as string]: v }), [STORAGE_KEY, s] as const);
          // Confirm the write is readable from the storage the pages will read, not just that set() resolved.
          for (let check = 0; check < 20; check++) {
            const stored = await sw.evaluate(([k]) => chrome.storage.local.get(k as string), [STORAGE_KEY] as const);
            const got = stored[STORAGE_KEY] as { theme?: unknown; siteRules?: unknown } | undefined;
            const want = s as { theme?: unknown; siteRules?: unknown };
            if (got && JSON.stringify(got.theme) === JSON.stringify(want.theme ?? got.theme)
              && JSON.stringify(got.siteRules ?? {}) === JSON.stringify(want.siteRules ?? {})) return;
            await new Promise((r) => setTimeout(r, 100));
          }
          throw new Error('settings write was not readable after 2s');
        } catch (error) {
          const notReady = error instanceof Error && /reading 'local'/.test(error.message);
          if (!notReady || attempt >= 20) throw error;
          await new Promise((r) => setTimeout(r, 100));
        }
      }
    });
  },
});
export { expect };

export const settings = (over: Record<string, unknown> = {}) => ({ schemaVersion: 2, enabled: true, theme: 'balanced', brightness: 100, contrast: 100, sepia: 0, siteRules: {}, ...over });

/** Opens a fixture and waits until NightLens has finished its first pass (or timed out as "not themed"). */
export async function open(page: Page, path: string, origin = ORIGIN_A, expectThemed = true): Promise<void> {
  await page.goto(`${origin}/${path}`);
  if (expectThemed) await waitThemed(page);
  else {
    await page.waitForTimeout(600);
    // A page that should stay untouched is the interesting case: report what the content script saw.
    const diag = await page.evaluate(() => document.documentElement.getAttribute('data-diag-nightlens'));
    console.log(`[e2e] ${path} should be untouched; content script saw: ${diag ?? '(no diagnosis attribute)'}`);
  }
}
export async function waitThemed(page: Page | Frame): Promise<void> {
  await page.waitForFunction(() => document.querySelector('style[data-nl-owned]') !== null && document.querySelector('[data-nl-bg],[data-nl-fg]') !== null, undefined, { timeout: 8000 });
  await page.waitForTimeout(250); // let time-sliced batches finish
}

export interface Violation { el: string; text: string; fg: string; bg: string; ratio: number; min: number }

/** WCAG contrast audit of every visible text node against its composited, real rendered background. */
export function auditContrast(target: Page | Frame, minRatio = 4.5): Promise<Violation[]> {
  return target.evaluate((min) => {
    type C = { r: number; g: number; b: number; a: number };
    const parse = (s: string): C | null => {
      const m = s.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1]!.split(/[\s,/]+/).filter(Boolean).map(Number);
      return { r: p[0]!, g: p[1]!, b: p[2]!, a: p.length > 3 ? p[3]! : 1 };
    };
    const lum = (c: { r: number; g: number; b: number }) => {
      const f = (v: number) => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const ratio = (a: C, b: C) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const over = (top: C, base: C): C => ({ r: top.r * top.a + base.r * (1 - top.a), g: top.g * top.a + base.g * (1 - top.a), b: top.b * top.a + base.b * (1 - top.a), a: 1 });
    const out: Array<{ el: string; text: string; fg: string; bg: string; ratio: number; min: number }> = [];
    const check = (el: Element, text: string) => {
      const cs = getComputedStyle(el);
      if (cs.visibility !== 'visible' || cs.display === 'none' || parseFloat(cs.opacity) === 0) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || el.namespaceURI === 'http://www.w3.org/2000/svg') return;
      const layers: C[] = [];
      for (let n: Element | null = el; n; n = n.parentElement) {
        const c = getComputedStyle(n);
        if (c.backgroundImage !== 'none') return; // author-controlled image/gradient: cannot be audited by colour
        const b = parse(c.backgroundColor);
        if (b && b.a > 0) { layers.push(b); if (b.a >= 0.999) break; }
      }
      let base: C = { r: 255, g: 255, b: 255, a: 1 };
      for (const l of layers.reverse()) base = over(l, base);
      const fgRaw = parse(cs.color);
      if (!fgRaw) return;
      const fg = over(fgRaw, base);
      const disabled = el.closest(':disabled,[aria-disabled="true"]') !== null;
      const need = disabled ? 3 : min;
      const got = ratio(fg, base);
      if (got < need) out.push({ el: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''}`, text: text.slice(0, 30), fg: cs.color, bg: `rgb(${Math.round(base.r)},${Math.round(base.g)},${Math.round(base.b)})`, ratio: Math.round(got * 100) / 100, min: need });
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const t = walker.currentNode as Text;
      const el = t.parentElement;
      if (!t.nodeValue?.trim() || !el || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'OPTION'].includes(el.tagName)) continue;
      check(el, t.nodeValue.trim());
    }
    document.querySelectorAll('input:not([type=radio]):not([type=checkbox]),textarea,select').forEach((el) => check(el, (el as HTMLInputElement).value || 'control'));
    return out;
  }, minRatio);
}

export const managedCount = (p: Page | Frame) => p.evaluate(() => document.querySelectorAll('[data-nl-fg],[data-nl-bg],[data-nl-bt],[data-nl-br],[data-nl-bb],[data-nl-bl],[data-nl-link],[data-nl-fill],[data-nl-stroke],[data-nl-plate]').length);
export const ownedCount = (p: Page | Frame) => p.evaluate(() => document.querySelectorAll('[data-nl-owned]').length);
export const pageBg = (p: Page | Frame) => p.evaluate(() => getComputedStyle(document.body).backgroundColor);
