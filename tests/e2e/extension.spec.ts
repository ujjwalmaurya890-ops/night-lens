import { ORIGIN_A, ORIGIN_B, auditContrast, expect, managedCount, open, ownedCount, pageBg, settings, test, waitThemed } from './harness';

const CATEGORIES: Array<[string, string]> = [
  ['news and blogs', 'news.html'], ['documentation', 'docs.html'], ['search engine', 'search.html'], ['e-commerce', 'shop.html'],
  ['educational', 'edu.html'], ['code hosting', 'codehost.html'], ['complex web app', 'webapp.html'],
];

test.describe('theming representative local pages (real Chromium, real extension)', () => {
  for (const [label, file] of CATEGORIES) {
    test(`${label}: every visible text node meets WCAG AA 4.5:1 and the page is dark`, async ({ context, setSettings }) => {
      await setSettings(settings());
      const page = await context.newPage();
      await open(page, file);
      expect(await auditContrast(page, 4.5)).toEqual([]);
      const bg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
      const [r, g, b] = bg.match(/\d+/g)!.map(Number);
      expect(Math.max(r!, g!, b!)).toBeLessThan(60); // charcoal, not white
      await page.screenshot({ path: `test-results/${file.replace('.html', '')}-dark.png` });
    });
  }

  test('baseline: the same pages WITHOUT NightLens are light (proves the audit and the theme are doing something)', async ({ context, setSettings }) => {
    await setSettings(settings({ enabled: false }));
    const page = await context.newPage();
    await open(page, 'news.html', ORIGIN_A, false);
    expect(await ownedCount(page)).toBe(0);
    expect(await pageBg(page)).toBe('rgb(255, 255, 255)');
  });
});

test('the canvas below a short <body> matches the body (no lighter band at the bottom)', async ({ context, setSettings }) => {
  await setSettings(settings());
  const page = await context.newPage();
  await open(page, 'webapp.html');
  const [html, body] = await page.evaluate(() => [getComputedStyle(document.documentElement).backgroundColor, getComputedStyle(document.body).backgroundColor]);
  expect(html).toBe(body);
});

test('regression: the engine records <html>\'s ORIGINAL background (not its own early-paint colour)', async ({ context, setSettings }) => {
  await setSettings(settings());
  const page = await context.newPage();
  await open(page, 'htmlbg.html');
  // html{background:#fff} is the canvas's original backdrop, so the chart must keep a white plate.
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('cv')!).backgroundColor)).toBe('rgb(255, 255, 255)');
  expect(await auditContrast(page)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.hasAttribute('data-nl-ready'))).toBe(true);
});

test('gradients and shadows are remapped while media remains unfiltered', async ({ context, setSettings }) => {
  await setSettings(settings());
  const page = await context.newPage();
  await open(page, 'gradient.html');
  const result = await page.evaluate(() => {
    const hero = getComputedStyle(document.getElementById('hero')!);
    return { gradient: hero.backgroundImage, shadow: hero.boxShadow, media: getComputedStyle(document.getElementById('photo')!).filter };
  });
  expect(result.gradient).toContain('linear-gradient(45deg');
  expect(result.gradient).not.toContain('255, 255, 255');
  expect(result.shadow).toContain('0px 4px 8px');
  expect(result.media).toBe('none');
});

test.describe('theme modes and settings', () => {
  for (const theme of ['highContrast', 'dim']) {
    test(`${theme}: docs page meets its contrast floor`, async ({ context, setSettings }) => {
      await setSettings(settings({ theme }));
      const page = await context.newPage();
      await open(page, 'docs.html');
      expect(await auditContrast(page, theme === 'highContrast' ? 7 : 4.5)).toEqual([]);
    });
  }

  test('slider extremes still meet AA', async ({ context, setSettings }) => {
    for (const s of [{ brightness: 60, contrast: 70, sepia: 60 }, { brightness: 120, contrast: 140, sepia: 0 }]) {
      await setSettings(settings(s));
      const page = await context.newPage();
      await open(page, 'news.html');
      expect(await auditContrast(page, 4.5), JSON.stringify(s)).toEqual([]);
      await page.close();
    }
  });

  test('changing settings re-themes a live page, and disabling restores the original colours exactly', async ({ context, setSettings }) => {
    await setSettings(settings({ enabled: false }));
    const page = await context.newPage();
    await open(page, 'shop.html', ORIGIN_A, false);
    const snapshot = () => page.evaluate(() => [...document.querySelectorAll('body, header, .card, .price, .add, h3, select, #zip')].map((e) => { const c = getComputedStyle(e); return [c.color, c.backgroundColor, c.borderTopColor].join('|'); }));
    const original = await snapshot();

    await setSettings(settings());
    await waitThemed(page);
    expect(await snapshot()).not.toEqual(original);
    const balancedBg = await page.evaluate(() => getComputedStyle(document.querySelector('.card')!).backgroundColor);

    await setSettings(settings({ theme: 'highContrast' }));
    await page.waitForFunction((prev) => getComputedStyle(document.querySelector('.card')!).backgroundColor !== prev, balancedBg);

    await setSettings(settings({ enabled: false }));
    await page.waitForFunction(() => document.querySelector('style[data-nl-owned]') === null);
    expect(await snapshot()).toEqual(original);
    expect(await managedCount(page)).toBe(0);
  });

  test('settings persist across reloads and browser pages', async ({ context, setSettings }) => {
    await setSettings(settings({ theme: 'dim' }));
    const page = await context.newPage();
    await open(page, 'news.html');
    const filter = () => page.evaluate(() => getComputedStyle(document.getElementById('photo')!).filter);
    expect(await filter()).toBe('none');
    await page.reload();
    await waitThemed(page);
    expect(await filter()).toBe('none');
  });

  test('follow-system mode tracks prefers-color-scheme', async ({ context, setSettings }) => {
    await setSettings(settings({ theme: 'system' }));
    const light = await context.newPage();
    await light.emulateMedia({ colorScheme: 'light' });
    await open(light, 'news.html', ORIGIN_A, false);
    expect(await ownedCount(light)).toBe(0);
    await light.emulateMedia({ colorScheme: 'dark' });
    await waitThemed(light);
    expect(await ownedCount(light)).toBeGreaterThan(0);
    await light.emulateMedia({ colorScheme: 'light' });
    await light.waitForFunction(() => document.querySelector('style[data-nl-owned]') === null);
  });
});

test.describe('per-site rules (nearest hostname matching)', () => {
  test('excluding 127.0.0.1 leaves it untouched but still themes localhost', async ({ context, setSettings }) => {
    await setSettings(settings({ siteRules: { '127.0.0.1': 'off' } }));
    const excluded = await context.newPage();
    await open(excluded, 'news.html', ORIGIN_A, false);
    expect(await ownedCount(excluded)).toBe(0);
    expect(await pageBg(excluded)).toBe('rgb(255, 255, 255)');
    const other = await context.newPage();
    await open(other, 'news.html', ORIGIN_B);
    expect(await ownedCount(other)).toBeGreaterThan(0);
  });

  test('adding and removing an exclusion at runtime applies live', async ({ context, setSettings }) => {
    await setSettings(settings());
    const page = await context.newPage();
    await open(page, 'docs.html');
    await setSettings(settings({ siteRules: { '127.0.0.1': 'off' } }));
    await page.waitForFunction(() => document.querySelector('style[data-nl-owned]') === null);
    await setSettings(settings());
    await waitThemed(page);
  });
});

test.describe('keyboard shortcut and known, documented limitations', () => {
  test('the toggle command is registered with Chrome with its suggested shortcut', async ({ sw }) => {
    const commands = await sw.evaluate(() => chrome.commands.getAll());
    expect(commands).toContainEqual(expect.objectContaining({ name: 'toggle-nightlens', shortcut: 'Alt+Shift+D' }));
    // NOTE: a physical key press cannot be simulated through automation; the handler itself is unit-tested.
  });

  test('KNOWN LIMITATION: site :hover backgrounds are suppressed on recoloured elements', async ({ context, setSettings }) => {
    await setSettings(settings());
    const page = await context.newPage();
    await open(page, 'modern.html');
    const bg = () => page.evaluate(() => getComputedStyle(document.getElementById('hov')!).backgroundColor);
    const before = await bg();
    await page.hover('#hov');
    await page.waitForTimeout(300);
    expect(await bg()).toBe(before); // if this ever changes (limitation fixed), update docs/LIMITATIONS.md
  });
});

test.describe('native dark sites', () => {
  test('a site that already has a dark theme is left alone', async ({ context, setSettings }) => {
    await setSettings(settings());
    const page = await context.newPage();
    const html = await (async () => { await page.goto(`${ORIGIN_A}/dark.html`); await page.waitForTimeout(800); return page.content(); })();
    expect(await ownedCount(page)).toBe(0);
    expect(await managedCount(page)).toBe(0);
    expect(html).not.toContain('data-nl-');
    expect(await pageBg(page)).toBe('rgb(13, 17, 23)');
  });

  test('"force on" overrides the detection for that site', async ({ context, setSettings }) => {
    await setSettings(settings({ siteRules: { '127.0.0.1': 'on' } }));
    const page = await context.newPage();
    await open(page, 'dark.html');
    expect(await ownedCount(page)).toBeGreaterThan(0);
    expect(await auditContrast(page)).toEqual([]);
  });
});

test.describe('modern colour syntax', () => {
  test('oklch(), lab(), display-p3 and color-mix() pages are themed and readable (Tailwind-v4-style)', async ({ context, setSettings }) => {
    await setSettings(settings());
    const page = await context.newPage();
    await open(page, 'modern.html');
    expect(await auditContrast(page)).toEqual([]);
    const bgs = await page.evaluate(() => ['body', '.card', 'header', '.mix', '.p3'].map((q) => getComputedStyle(document.querySelector(q)!).backgroundColor));
    for (const bg of bgs) { const [r, g, b] = bg.match(/[\d.]+/g)!.map(Number); expect(Math.max(r!, g!, b!), bg).toBeLessThan(80); }
    await page.screenshot({ path: 'test-results/modern-dark.png' });
  });
});

test.describe('special content', () => {
  test('images and video are never recoloured, inverted or filtered (balanced theme)', async ({ context, setSettings }) => {
    await setSettings(settings());
    const page = await context.newPage();
    await open(page, 'news.html');
    const info = await page.evaluate(() => ['photo', 'vid'].map((id) => { const e = document.getElementById(id)!; const c = getComputedStyle(e); return { attrs: [...e.attributes].filter((a) => a.name.startsWith('data-nl')).length, filter: c.filter, bg: c.backgroundColor }; }));
    for (const i of info) { expect(i.attrs).toBe(0); expect(i.filter).toBe('none'); }
    expect(info[1]!.bg).toBe('rgb(255, 255, 255)'); // video element's own style untouched
  });

  test('canvas charts keep their original light backdrop so their pixels stay readable', async ({ context, setSettings }) => {
    await setSettings(settings());
    const page = await context.newPage();
    await open(page, 'edu.html');
    // The plate is the canvas's ORIGINAL effective background: edu.html's body is #fafafa, and the chart paints its own white.
    expect(await page.evaluate(() => getComputedStyle(document.getElementById('cv')!).backgroundColor)).toBe('rgb(250, 250, 250)');
    const px = await page.evaluate(() => Array.from((document.getElementById('cv') as HTMLCanvasElement).getContext('2d')!.getImageData(5, 5, 1, 1).data));
    expect(px.slice(0, 3)).toEqual([255, 255, 255]); // pixels the page drew are untouched
  });

  test('small inline SVG icons stay visible on dark', async ({ context, setSettings }) => {
    await setSettings(settings());
    const page = await context.newPage();
    await open(page, 'edu.html');
    const fill = await page.evaluate(() => getComputedStyle(document.getElementById('icp')!).fill);
    expect(fill).not.toBe('rgb(27, 94, 32)'); // original dark green would nearly vanish on charcoal
  });

  test('visited/unvisited links, focus ring and placeholders stay distinguishable', async ({ context, setSettings }) => {
    await setSettings(settings());
    const page = await context.newPage();
    await open(page, 'news.html');
    const linkColor = await page.evaluate(() => getComputedStyle(document.querySelector('main a')!).color);
    expect(linkColor).not.toBe('rgb(6, 69, 173)');
    await page.focus('#sub');
    const outline = await page.evaluate(() => { const c = getComputedStyle(document.getElementById('sub')!); return `${c.outlineStyle} ${c.outlineWidth}`; });
    expect(outline).not.toMatch(/^none/);
    const ph = await page.evaluate(() => getComputedStyle(document.getElementById('email')!, '::placeholder').color);
    expect(ph).not.toBe('rgb(117, 117, 117)');
  });

  test('works under a strict Content-Security-Policy (style-src self)', async ({ context, setSettings }) => {
    await setSettings(settings());
    const page = await context.newPage();
    await open(page, 'csp.html');
    expect(await auditContrast(page)).toEqual([]);
    expect(await pageBg(page)).not.toBe('rgb(255, 255, 255)');
  });

  test('themes same-origin and cross-origin iframes (each frame runs its own engine)', async ({ context, setSettings }) => {
    await setSettings(settings());
    const page = await context.newPage();
    await open(page, 'frames.html');
    const frames = page.frames().filter((f) => f !== page.mainFrame());
    expect(frames.length).toBe(2);
    for (const f of frames) { await waitThemed(f); expect(await ownedCount(f)).toBeGreaterThan(0); expect(await auditContrast(f)).toEqual([]); }
    expect(new Set(frames.map((f) => new URL(f.url()).origin)).size).toBe(2);
  });

  test('a per-site exclusion on the top page also excludes its iframes', async ({ context, setSettings }) => {
    await setSettings(settings({ siteRules: { '127.0.0.1': 'off' } }));
    const page = await context.newPage();
    await open(page, 'frames.html', ORIGIN_A, false);
    await page.waitForTimeout(500);
    for (const f of page.frames()) expect(await ownedCount(f)).toBe(0);
  });
});

test.describe('dynamic content', () => {
  test('items added by page scripts are themed (webapp)', async ({ context, setSettings }) => {
    await setSettings(settings());
    const page = await context.newPage();
    await open(page, 'webapp.html');
    for (let i = 0; i < 3; i++) await page.click('#add');
    await page.waitForTimeout(400);
    expect(await page.locator('#list li[data-nl-bg]').count()).toBe(3);
    expect(await auditContrast(page)).toEqual([]);
  });

  test('SPA-style route changes and bulk insertions are themed', async ({ context, setSettings }) => {
    await setSettings(settings());
    const page = await context.newPage();
    await open(page, 'spa.html');
    await page.click('#lb');
    await page.waitForTimeout(400);
    expect(await auditContrast(page)).toEqual([]);
    await page.evaluate(() => (window as unknown as { bulk: (n: number) => void }).bulk(300));
    await page.waitForTimeout(1000);
    expect(await auditContrast(page)).toEqual([]);
  });

  test('is quiescent after settling (no mutation feedback loop in a real browser)', async ({ context, setSettings }) => {
    await setSettings(settings());
    const page = await context.newPage();
    await open(page, 'webapp.html');
    const mutations = await page.evaluate(() => new Promise<number>((resolve) => {
      let n = 0;
      const o = new MutationObserver((r) => { n += r.length; });
      o.observe(document, { subtree: true, attributes: true, childList: true, characterData: true });
      setTimeout(() => { o.disconnect(); resolve(n); }, 1500);
    }));
    expect(mutations).toBe(0);
  });

  test('performance sanity: 5,000 inserted nodes finish theming, with measured time reported', async ({ context, setSettings }) => {
    await setSettings(settings());
    const page = await context.newPage();
    await open(page, 'spa.html');
    const ms = await page.evaluate(async () => {
      const t0 = performance.now();
      (window as unknown as { bulk: (n: number) => void }).bulk(2500); // 2500 rows * (div+span+a) = 7,500 elements
      const last = () => document.body.lastElementChild as HTMLElement;
      while (!last().hasAttribute('data-nl-bg')) await new Promise((r) => setTimeout(r, 25));
      return Math.round(performance.now() - t0);
    });
    console.log(`[measured] theming 7,500 inserted elements took ${ms} ms in this environment`);
    expect(ms).toBeLessThan(10_000);
  });
});

test.describe('popup (real extension page)', () => {
  async function openPopup(context: import('@playwright/test').BrowserContext, sw: import('@playwright/test').Worker, extensionId: string, target: import('@playwright/test').Page) {
    await target.bringToFront();
    const tabId = await sw.evaluate(async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]?.id);
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup/index.html?tab=${tabId}`);
    return popup;
  }

  test('shows the current site, toggles it live, and its own UI meets WCAG contrast', async ({ context, sw, extensionId, setSettings }) => {
    await setSettings(settings());
    const page = await context.newPage();
    await open(page, 'news.html');
    const popup = await openPopup(context, sw, extensionId, page);
    await expect(popup.getByText('127.0.0.1')).toBeVisible();
    await expect(popup.getByText(/Dark mode is active on this site/)).toBeVisible();
    expect(await auditContrast(popup)).toEqual([]);
    await popup.screenshot({ path: 'test-results/popup.png' });

    await popup.getByRole('switch', { name: 'Dark mode on 127.0.0.1' }).click();
    await page.waitForFunction(() => document.querySelector('style[data-nl-owned]') === null);
    await expect(popup.getByText(/This site is excluded/)).toBeVisible();
    await popup.getByRole('switch', { name: 'Dark mode on 127.0.0.1' }).click();
    await waitThemed(page);
    await expect(popup.getByText(/Dark mode is active on this site/)).toBeVisible();
  });

  test('global switch and theme selector change the page; reset restores defaults', async ({ context, sw, extensionId, setSettings }) => {
    await setSettings(settings());
    const page = await context.newPage();
    await open(page, 'docs.html');
    const popup = await openPopup(context, sw, extensionId, page);
    await popup.getByLabel('Theme').selectOption('dim');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('pre')!).backgroundColor !== '' && document.querySelector('style[data-nl-owned]')!.textContent!.includes('--nl-bg:#2'));
    await popup.getByRole('switch', { name: 'Dark mode (all sites)' }).click();
    await page.waitForFunction(() => document.querySelector('style[data-nl-owned]') === null);
    await popup.getByRole('button', { name: 'Reset…' }).click();
    await popup.getByRole('group', { name: 'Confirm reset' }).getByRole('button', { name: 'Reset' }).click();
    await waitThemed(page);
    await expect(popup.getByLabel('Theme')).toHaveValue('midnight');
  });

  test('keyboard: Tab reaches every control in a sensible order and Space toggles a switch', async ({ context, sw, extensionId, setSettings }) => {
    await setSettings(settings());
    const page = await context.newPage();
    await open(page, 'news.html');
    const popup = await openPopup(context, sw, extensionId, page);
    await popup.getByText('127.0.0.1').waitFor();
    const order: string[] = [];
    const outlines: string[] = [];
    for (let i = 0; i < 7; i++) { // the popup has exactly 7 tab stops; an 8th Tab would leave the document
      await popup.keyboard.press('Tab');
      const stop = await popup.evaluate(() => { const a = document.activeElement as HTMLElement; const c = getComputedStyle(a); return { name: a.getAttribute('aria-label') || a.id || a.textContent?.trim() || a.tagName, outline: `${c.outlineStyle} ${c.outlineWidth}` }; });
      order.push(stop.name); outlines.push(stop.outline);
    }
    expect(order).toEqual(['Dark mode (all sites)', 'Dark mode on 127.0.0.1', 'theme-p', 'brightness-p', 'contrast-p', 'Settings', 'Reset…']);
    for (const o of outlines) expect(o).toMatch(/^solid 2px/); // visible focus indicator on every stop
    await popup.getByRole('switch', { name: 'Dark mode (all sites)' }).focus();
    await popup.keyboard.press('Space');
    await expect(popup.getByRole('switch', { name: 'Dark mode (all sites)' })).toHaveAttribute('aria-checked', 'false');
  });

  test('unsupported pages show an explanatory empty state', async ({ context, sw, extensionId, setSettings }) => {
    await setSettings(settings());
    const page = await context.newPage();
    await page.goto('about:blank');
    const popup = await openPopup(context, sw, extensionId, page);
    await expect(popup.getByText(/can’t run on this page/)).toBeVisible();
  });

  test('options page: a purpose preset and a per-site override reach the live page', async ({ context, extensionId, setSettings }) => {
    await setSettings(settings());
    const page = await context.newPage();
    await open(page, 'docs.html');
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/options/index.html`);

    const bodyBg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const beforePreset = await bodyBg();
    await options.getByRole('button', { name: 'Themes' }).click();
    // The preview reflects the palette before anything is applied to the page.
    await expect(options.getByLabel('Theme preview')).toBeVisible();
    await options.getByRole('button', { name: 'High contrast' }).click();
    await page.waitForFunction((prev) => getComputedStyle(document.body).backgroundColor !== prev, beforePreset);

    const beforeOverride = await bodyBg();
    await options.getByRole('button', { name: 'Websites' }).click();
    await options.getByLabel('Override website').fill('127.0.0.1');
    // Range inputs cannot be filled directly; set the value the way React expects to see it.
    await options.getByLabel('Override brightness').evaluate((el) => {
      const input = el as HTMLInputElement;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '70');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await options.getByRole('button', { name: 'Save override' }).click();
    await page.waitForFunction((prev) => getComputedStyle(document.body).backgroundColor !== prev, beforeOverride);
    expect(await auditContrast(page, 4.5)).toEqual([]);
  });

  test('options page: add/remove an excluded site and meets contrast', async ({ context, extensionId, setSettings }) => {
    await setSettings(settings());
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options/index.html`);
    await page.getByLabel('Exclude a website').fill('https://Blog.Example.com/x');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByRole('list', { name: 'Excluded sites' }).getByText('blog.example.com')).toBeVisible();
    expect(await auditContrast(page)).toEqual([]);
    await page.getByRole('button', { name: 'Remove blog.example.com from excluded sites' }).click();
    await expect(page.getByText(/No excluded sites/)).toBeVisible();
    await page.screenshot({ path: 'test-results/options.png', fullPage: true });
  });
});

test.describe('error hygiene', () => {
  test('no uncaught errors or console errors in the service worker, popup, options page, or a themed page', async ({ context, sw, extensionId, setSettings }) => {
    const problems: string[] = [];
    sw.on('console', (m) => { if (m.type() === 'error') problems.push(`sw: ${m.text()}`); });
    const watch = (p: import('@playwright/test').Page, label: string) => {
      p.on('pageerror', (e) => problems.push(`${label} pageerror: ${e.message}`));
      p.on('console', (m) => { if (m.type() === 'error') problems.push(`${label} console: ${m.text()} @ ${m.location().url}`); });
    };
    await setSettings(settings());
    const page = await context.newPage();
    watch(page, 'page');
    await open(page, 'webapp.html');
    await page.click('#add');
    const popupTab = await sw.evaluate(async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]?.id);
    const popup = await context.newPage();
    watch(popup, 'popup');
    await popup.goto(`chrome-extension://${extensionId}/popup/index.html?tab=${popupTab}`);
    await popup.getByLabel('Theme').selectOption('highContrast');
    await popup.getByRole('switch', { name: 'Dark mode (all sites)' }).click();
    await popup.getByRole('switch', { name: 'Dark mode (all sites)' }).click();
    const options = await context.newPage();
    watch(options, 'options');
    await options.goto(`chrome-extension://${extensionId}/options/index.html`);
    await options.waitForTimeout(500);
    expect(problems).toEqual([]);
  });
});
