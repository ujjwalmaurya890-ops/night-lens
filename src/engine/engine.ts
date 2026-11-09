import { WHITE, blend, colorKey, contrastRatio, ensureContrast, parseColor, relativeLuminance, TRANSPARENT, type RGB, type RGBA } from './color';
import { detectNativeDark } from './detect';
import { isColoredLink, mapBackground, mapBorder, mapBoxShadow, mapForeground, mapGradient, mapLinkColor } from './mapper';
import type { ThemeTokens } from './palette';
import { buildBaseCss } from './styles';

const SVG_NS = 'http://www.w3.org/2000/svg';
const OWNED = 'data-nl-owned';
const READY = 'data-nl-ready';
const DEV_ATTR = 'data-nl-dev';

const RULE_FOR = {
  'data-nl-fg': (k: string) => `[data-nl-fg="${k}"]{color:#${k} !important}`,
  'data-nl-bg': (k: string) => `[data-nl-bg="${k}"]{background-color:#${k} !important}`,
  'data-nl-bt': (k: string) => `[data-nl-bt="${k}"]{border-top-color:#${k} !important}`,
  'data-nl-br': (k: string) => `[data-nl-br="${k}"]{border-right-color:#${k} !important}`,
  'data-nl-bb': (k: string) => `[data-nl-bb="${k}"]{border-bottom-color:#${k} !important}`,
  'data-nl-bl': (k: string) => `[data-nl-bl="${k}"]{border-left-color:#${k} !important}`,
  'data-nl-fill': (k: string) => `[data-nl-fill="${k}"]{fill:#${k} !important}`,
  'data-nl-stroke': (k: string) => `[data-nl-stroke="${k}"]{stroke:#${k} !important}`,
  'data-nl-plate': (k: string) => `[data-nl-plate="${k}"]{background-color:#${k} !important}`,
  // Gradient/shadow declarations are emitted by setCssValue after validation.
  'data-nl-gradient': () => '',
  'data-nl-shadow': () => '',
} as const;
type ColorAttr = keyof typeof RULE_FOR;
const MANAGED_ATTRS = [...(Object.keys(RULE_FOR) as ColorAttr[]), 'data-nl-link'] as const;
const MANAGED_SELECTOR = [...MANAGED_ATTRS, READY].map((a) => `[${a}]`).join(',');
const SIDES = [
  ['borderTop', 'data-nl-bt'], ['borderRight', 'data-nl-br'], ['borderBottom', 'data-nl-bb'], ['borderLeft', 'data-nl-bl'],
] as const;

const SKIP_TAGS = new Set([
  'HEAD', 'SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'TEMPLATE', 'TITLE', 'BASE',
  'IMG', 'VIDEO', 'AUDIO', 'PICTURE', 'SOURCE', 'TRACK', 'IFRAME', 'OBJECT', 'EMBED', 'BR', 'WBR', 'MAP', 'AREA', 'PARAM',
]);
const CONTROL_TAGS = new Set(['input', 'select', 'textarea', 'button']);
const CODE_TAGS = new Set(['CODE', 'PRE', 'KBD', 'SAMP']);
const TABLE_TAGS = new Set(['TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD']);
const SVG_SHAPES = 'path,circle,ellipse,rect,polygon,polyline,line,text';
const STYLE_ATTR_RELEVANT = /color|background|border|fill|stroke|box-shadow/i;

const BATCH_SIZE = 400;
const SUBTREE_REPROCESS_LIMIT = 2000;
/** Attributes whose change can swap a site's colour system, observed on every element. */
const THEME_ATTRIBUTES = [
  'class', 'style', 'role',
  'data-theme', 'data-bs-theme', 'data-color-mode', 'data-color-scheme', 'data-mode', 'data-theme-mode',
] as const;
/** Bound for the gradient/shadow payload cache; it is dropped wholesale when exceeded. */
const MAX_CSS_VALUES = 4000;
const ICON_MAX_PX = 64;
const PLATE_MIN_W = 100;
const PLATE_MIN_H = 60;
const MAX_ICON_SHAPES = 80;
const MAX_RULES = 5000;
const DEBOUNCE_MS = 150;
const MIN_GRAPHIC_CONTRAST = 3;
const LIGHT_BG_LUMINANCE = 0.5;

export type EngineStatus = 'active' | 'native-dark';
export interface EngineConfig {
  tokens: ThemeTokens;
  skipNativeDarkCheck: boolean;
  readingMode?: { enabled: boolean; fontSize: number; lineHeight: number; maxWidth: number; fontFamily: string };
  customCSS?: string;
  accessibility?: { underlineLinks?: boolean; reducedMotion?: boolean; highContrast?: boolean };
  developerMode?: boolean;
  compatibility?: 'auto' | 'aggressive' | 'gentle' | 'mediaOnly';
  textSize?: number; // 80-130 percent for font scaling
  /** Performance tuning (from settings.performance); falls back to the constants below. */
  batchSize?: number;
  debounceMs?: number;
  enableCache?: boolean;
}
export interface EngineOptions {
  onStatus?: (status: EngineStatus) => void;
  onStats?: (stats: EngineStats) => void;
}

export interface EngineStats {
  processed: number;
  rules: number;
  duration: number;
  cacheHit: number;
}

interface BgInfo { rgb: RGB; orig: RGB; locked: boolean }
interface RootContext { root: Document | ShadowRoot; base: HTMLStyleElement; dyn: HTMLStyleElement; rules: Set<string>; dirty: boolean }
interface Read {
  el: Element;
  kind: 'element' | 'canvas' | 'svg';
  bg: RGBA | null;
  fg: RGBA | null;
  hasBgImage: boolean;
  gradient: string | null;
  boxShadow: string | null;
  borders: Array<{ attr: ColorAttr; color: RGBA }>;
  disabled: boolean;
  coloredLink: boolean;
  control: boolean;
  isCode: boolean;
  isTable: boolean;
  isModal: boolean;
  width: number;
  height: number;
  hasText: boolean;
  shapes: Array<{ el: Element; fill: RGBA | null; stroke: RGBA | null }>;
}

const parentOf = (el: Element): Element | null => el.parentElement ?? ((el.parentNode as ShadowRoot | null)?.host ?? null);
const opaque = (c: RGBA | RGB): RGB => ({ r: c.r, g: c.g, b: c.b });

/**
 * Fingerprint of every config input that can change rendered output. Used to make
 * update() a no-op when a storage notification carries an identical effective config
 * (for example, editing a site rule that does not affect this page).
 */
export function configSignature(config: EngineConfig): string {
  const t = config.tokens;
  const c = t.colors;
  return JSON.stringify([
    t.preset, t.minTextContrast, t.minBorderContrast, t.minControlBorderContrast, t.minDisabledContrast,
    t.neutralHue, t.neutralSat, t.bgL, t.bgMidL, t.textL, t.mutedL, t.accentHue ?? null, t.customId ?? null,
    c.bg, c.bgRaised, c.text, c.textMuted, c.link, c.linkVisited, c.border, c.focus, c.selectionBg, c.selectionText,
    config.skipNativeDarkCheck, config.readingMode ?? null, config.customCSS ?? '',
    config.accessibility ?? null, config.developerMode ?? false, config.compatibility ?? 'auto',
    config.textSize ?? 100, config.batchSize ?? null, config.debounceMs ?? null, config.enableCache ?? null,
  ]);
}

/**
 * Ref-counted history patching. Two ThemeEngine instances on one window (content script plus
 * tests, or an SPA that re-injects) must not chain their wrappers: the second would capture
 * the first's wrapper as "original" and restore it later, leaving the page permanently patched.
 */
interface HistoryPatch {
  callbacks: Set<() => void>;
  originalPush: History['pushState'];
  originalReplace: History['replaceState'];
  push: History['pushState'];
  replace: History['replaceState'];
}
const historyPatches = new WeakMap<Window, HistoryPatch>();

function acquireHistoryPatch(win: Window, onNavigate: () => void): void {
  const existing = historyPatches.get(win);
  if (existing) { existing.callbacks.add(onNavigate); return; }
  try {
    const history = win.history;
    const patch: HistoryPatch = {
      callbacks: new Set([onNavigate]),
      originalPush: history.pushState.bind(history),
      originalReplace: history.replaceState.bind(history),
      push: (...args: Parameters<History['pushState']>) => {
        patch.originalPush.apply(history, args);
        for (const callback of [...patch.callbacks]) callback();
      },
      replace: (...args: Parameters<History['replaceState']>) => {
        patch.originalReplace.apply(history, args);
        for (const callback of [...patch.callbacks]) callback();
      },
    };
    history.pushState = patch.push;
    history.replaceState = patch.replace;
    historyPatches.set(win, patch);
  } catch { /* locked-down history: navigation events remain the fallback */ }
}

function releaseHistoryPatch(win: Window, onNavigate: () => void): void {
  const patch = historyPatches.get(win);
  if (!patch) return;
  patch.callbacks.delete(onNavigate);
  if (patch.callbacks.size > 0) return;
  try {
    if (win.history.pushState === patch.push) win.history.pushState = patch.originalPush;
    if (win.history.replaceState === patch.replace) win.history.replaceState = patch.originalReplace;
  } catch { /* ignore */ }
  historyPatches.delete(win);
}

export class ThemeEngine {
  private running = false;
  private applied = false;
  private status: EngineStatus | null = null;
  private config!: EngineConfig;
  private contexts = new Map<Node, RootContext>();
  private queue = new Set<Element>();
  private processed = new WeakSet<Element>();
  private bgInfo = new WeakMap<Element, BgInfo>();
  private ownBg = new WeakSet<Element>();
  private scheduled = false;
  private frame: number | null = null;
  private cssValues = new Map<string, string>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private treeObserver: MutationObserver | null = null;
  private rootObserver: MutationObserver | null = null;
  private reevalTimer: ReturnType<typeof setTimeout> | null = null;
  private rescanTimer: ReturnType<typeof setTimeout> | null = null;
  private stats = { processed: 0, rules: 0, duration: 0, cacheHit: 0 };
  private seenColors = new Map<string, RGBA>(); // simple cache for parsed colors
  private navigationTimer: ReturnType<typeof setTimeout> | null = null;
  private lastUrl = '';
  private signature = '';
  /** Native-dark result is stable for a URL; recomputed on navigation and on page theme flips. */
  private nativeDarkCache: { url: string; dark: boolean } | null = null;

  constructor(private readonly doc: Document = document, private readonly win: Window = window, private readonly options: EngineOptions = {}) {}

  get isRunning(): boolean { return this.running; }
  getStatus(): EngineStatus | null { return this.status; }
  getStats(): EngineStats { return { ...this.stats }; }

  start(config: EngineConfig): void {
    if (this.running) this.stop();
    this.running = true;
    this.config = config;
    this.signature = configSignature(config);
    this.attachStyles();
    this.rootObserver = new MutationObserver(() => this.scheduleReevaluate());
    this.rootObserver.observe(this.doc.documentElement, { attributes: true, attributeFilter: [...THEME_ATTRIBUTES] });
    if (this.doc.body) this.rootObserver.observe(this.doc.body, { attributes: true, attributeFilter: [...THEME_ATTRIBUTES] });
    this.doc.addEventListener('load', this.onResourceLoad, true);
    this.win.addEventListener('load', this.onWindowLoad);
    this.doc.addEventListener('DOMContentLoaded', this.onReady);
    // SPA navigation detection
    this.lastUrl = this.win.location.href;
    this.win.addEventListener('popstate', this.onNavigation);
    this.win.addEventListener('hashchange', this.onNavigation);
    this.listenForNavigationApi();
    // Intercept pushState/replaceState (shared, ref-counted per window)
    acquireHistoryPatch(this.win, this.onNavigation);

    if (this.doc.readyState === 'loading') {
      this.beginApply();
    } else {
      this.evaluate({ forceDetect: true });
    }
    // Performance monitoring for dev builds
    if (config.developerMode && typeof performance !== 'undefined') {
      console.info('[NightLens] Engine started', { theme: config.tokens.preset, url: this.win.location.href });
    }
  }

  update(config: EngineConfig): void {
    if (!this.running) { this.start(config); return; }
    const signature = configSignature(config);
    // Storage notifications fire for every settings write, including ones that cannot affect
    // this page. Re-running a full pass would re-read every computed style for nothing.
    if (signature === this.signature) return;
    this.signature = signature;
    this.config = config;
    for (const ctx of this.contexts.values()) {
      ctx.base.textContent = buildBaseCss(config.tokens, {
        readingMode: config.readingMode,
        customCSS: config.customCSS,
        underlineLinks: config.accessibility?.underlineLinks,
        reduceMotion: config.accessibility?.reducedMotion,
        highContrast: config.accessibility?.highContrast,
        mediaOnly: config.compatibility === 'mediaOnly',
      });
      if (ctx.rules.size > MAX_RULES) { ctx.rules.clear(); ctx.dirty = true; }
    }
    // Handle text size immediately via base CSS
    this.evaluate();
    if (this.applied) this.rescanAll();
  }

  stop(): void {
    this.running = false;
    this.teardownApplied();
    this.rootObserver?.disconnect();
    this.rootObserver = null;
    this.doc.removeEventListener('load', this.onResourceLoad, true);
    this.win.removeEventListener('load', this.onWindowLoad);
    this.doc.removeEventListener('DOMContentLoaded', this.onReady);
    this.win.removeEventListener('popstate', this.onNavigation);
    this.win.removeEventListener('hashchange', this.onNavigation);
    releaseHistoryPatch(this.win, this.onNavigation);
    if (this.frame !== null && typeof this.win.cancelAnimationFrame === 'function') this.win.cancelAnimationFrame(this.frame);
    this.frame = null;
    this.scheduled = false;
    this.cssValues.clear();
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.reevalTimer = this.rescanTimer = this.navigationTimer = null;
    this.status = null;
    this.seenColors.clear();
    this.nativeDarkCache = null;
    this.lastUrl = '';
    this.signature = '';
    this.removeNavigationApiListeners();
  }

  // ---- lifecycle ---

  private onReady = (): void => { this.moveStylesToEnd(); this.evaluate({ forceDetect: true }); };
  private onWindowLoad = (): void => { this.moveStylesToEnd(); this.evaluate({ forceDetect: true }); this.scheduleRescan(); };
  private onResourceLoad = (ev: Event): void => {
    const t = ev.target as Element | null;
    if (t && t.localName === 'link') this.scheduleRescan();
  };
  private onNavigation = (): void => {
    if (this.win.location.href === this.lastUrl) return;
    this.lastUrl = this.win.location.href;
    if (this.navigationTimer) clearTimeout(this.navigationTimer);
    // A new URL may be a different theme (the site may even be natively dark now).
    this.nativeDarkCache = null;
    this.navigationTimer = this.after(200, () => { if (this.applied) { this.evaluate({ forceDetect: true }); this.rescanAll(); } else this.evaluate({ forceDetect: true }); });
  };

  /**
   * The Navigation API fires for SPAs that change content without touching history, and for
   * same-document traversals. It is optional: not every Chromium version exposes it.
   */
  private navigationApi: { addEventListener?: (type: string, cb: () => void) => void; removeEventListener?: (type: string, cb: () => void) => void } | null = null;
  private listenForNavigationApi(): void {
    try {
      const nav = (this.win as Window & { navigation?: ThemeEngine['navigationApi'] }).navigation;
      if (!nav?.addEventListener) return;
      this.navigationApi = nav;
      nav.addEventListener('navigatesuccess', this.onNavigation);
      nav.addEventListener('currententrychange', this.onNavigation);
    } catch { /* unsupported: popstate/hashchange remain */ }
  }
  private removeNavigationApiListeners(): void {
    try {
      this.navigationApi?.removeEventListener?.('navigatesuccess', this.onNavigation);
      this.navigationApi?.removeEventListener?.('currententrychange', this.onNavigation);
    } catch { /* ignore */ }
    this.navigationApi = null;
  }

  private after(ms: number, fn: () => void): ReturnType<typeof setTimeout> {
    const id = setTimeout(() => { this.timers.delete(id); fn(); }, ms);
    this.timers.add(id);
    return id;
  }
  private get debounceMs(): number { return this.config.debounceMs ?? DEBOUNCE_MS; }
  private get batchSize(): number {
    const base = this.config.batchSize ?? BATCH_SIZE;
    return this.config.compatibility === 'aggressive' ? Math.round(base * 1.5) : base;
  }

  private scheduleReevaluate(): void {
    if (this.reevalTimer) clearTimeout(this.reevalTimer);
    // Root-level class/style changes are how sites flip their own light/dark theme.
    this.reevalTimer = this.after(this.debounceMs, () => { this.evaluate({ forceDetect: true }); if (this.applied) this.rescanAll(); });
  }
  private scheduleRescan(): void {
    if (this.rescanTimer) clearTimeout(this.rescanTimer);
    this.rescanTimer = this.after(this.debounceMs, () => { if (this.applied) this.rescanAll(); });
  }

  private isNativeDark(forceDetect: boolean): boolean {
    if (this.config.skipNativeDarkCheck || !this.doc.body) return false;
    const url = this.win.location.href;
    if (!forceDetect && this.nativeDarkCache && this.nativeDarkCache.url === url) return this.nativeDarkCache.dark;
    this.detachDocStyles();
    let dark = false;
    try { dark = detectNativeDark(this.doc, this.win).dark; } finally { if (!dark) this.reattachDocStyles(); }
    this.nativeDarkCache = { url, dark };
    return dark;
  }

  private evaluate(options: { forceDetect?: boolean } = {}): void {
    if (!this.running) return;
    const native = this.isNativeDark(options.forceDetect === true);
    // Compatibility mode: gentle never forces on native dark
    if (this.config.compatibility === 'gentle' && native) {
      this.teardownApplied();
      this.emit('native-dark');
      return;
    }
    // mediaOnly: only dim media, don't recolor text
    if (native) {
      this.teardownApplied();
      this.emit('native-dark');
    } else {
      if (!this.applied) this.beginApply();
      this.emit('active');
    }
  }

  private emit(status: EngineStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.options.onStatus?.(status);
  }

  private beginApply(): void {
    if (this.applied) return;
    this.applied = true;
    this.attachStyles();
    this.treeObserver = new MutationObserver((records) => this.onMutations(records));
    this.observeRoot(this.doc);
    this.enqueueSubtree(this.doc);
  }

  private teardownApplied(): void {
    this.treeObserver?.disconnect();
    this.treeObserver = null;
    this.queue.clear();
    for (const root of [...this.contexts.keys()]) {
      this.stripWithin(root);
      this.detachContext(this.contexts.get(root)!);
    }
    this.doc.documentElement.removeAttribute(READY);
    this.contexts.clear();
    this.processed = new WeakSet();
    this.bgInfo = new WeakMap();
    this.ownBg = new WeakSet();
    this.applied = false;
  }

  // ---- stylesheet contexts ---

  private createContext(root: Document | ShadowRoot): RootContext {
    const mk = () => { const s = this.doc.createElement('style'); s.setAttribute(OWNED, ''); return s; };
    const ctx: RootContext = { root, base: mk(), dyn: mk(), rules: new Set(), dirty: false };
    ctx.base.textContent = buildBaseCss(this.config.tokens, {
      readingMode: this.config.readingMode,
      customCSS: this.config.customCSS,
      underlineLinks: this.config.accessibility?.underlineLinks,
      reduceMotion: this.config.accessibility?.reducedMotion,
      highContrast: this.config.accessibility?.highContrast,
      mediaOnly: this.config.compatibility === 'mediaOnly',
    });
    // Text size scaling via CSS variable
    if (this.config.textSize && this.config.textSize !== 100) {
      ctx.base.textContent += `\nhtml{font-size:${this.config.textSize}% !important}`;
    }
    this.contexts.set(root, ctx);
    this.attachContext(ctx);
    return ctx;
  }
  private attachContext(ctx: RootContext): void {
    const host: ParentNode = ctx.root === this.doc ? (this.doc.head ?? this.doc.documentElement) : ctx.root;
    if (!ctx.base.isConnected) host.append(ctx.base, ctx.dyn);
    ctx.dyn.textContent = [...ctx.rules].join('\n');
  }
  private detachContext(ctx: RootContext): void { ctx.base.remove(); ctx.dyn.remove(); }

  private attachStyles(): void {
    const ctx = this.contexts.get(this.doc) ?? this.createContext(this.doc);
    this.attachContext(ctx);
  }
  private detachDocStyles(): void { const c = this.contexts.get(this.doc); if (c) this.detachContext(c); }
  private reattachDocStyles(): void { const c = this.contexts.get(this.doc); if (c) this.attachContext(c); }
  private moveStylesToEnd(): void {
    const c = this.contexts.get(this.doc);
    if (c && this.running) this.doc.documentElement.append(c.base, c.dyn);
  }

  private attachRoot(root: ShadowRoot): void {
    if (this.contexts.has(root)) return;
    this.createContext(root);
    this.observeRoot(root);
  }
  private observeRoot(root: Node): void {
    this.treeObserver?.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'role', 'data-theme', 'data-color-mode'] });
  }

  private contextFor(el: Element): RootContext | null {
    const root = el.getRootNode();
    const existing = this.contexts.get(root);
    if (existing) return existing;
    if (root === this.doc) return this.createContext(this.doc);
    return null;
  }
  private addRule(el: Element, attr: ColorAttr, key: string): void {
    const ctx = this.contextFor(el);
    if (!ctx) return;
    let rule = RULE_FOR[attr](key);
    if (attr === 'data-nl-gradient' || attr === 'data-nl-shadow') {
      const property = attr === 'data-nl-gradient' ? 'background-image' : 'box-shadow';
      const value = this.cssValues.get(key);
      if (!value) return;
      rule = `[${attr}="${key}"]{${property}:${value} !important}`;
    }
    if (!ctx.rules.has(rule)) { ctx.rules.add(rule); ctx.dirty = true; this.stats.rules++; }
  }

  private setCssValue(el: Element, attr: 'data-nl-gradient' | 'data-nl-shadow', value: string): boolean {
    // Two independent 32-bit hashes keep attribute names small and collisions
    // practically impossible; values originate from computed CSS and are checked
    // by the browser before they can become generated declarations.
    let h1 = 0x811c9dc5;
    let h2 = 0x9e3779b9;
    for (let i = 0; i < value.length; i++) {
      h1 = Math.imul(h1 ^ value.charCodeAt(i), 0x01000193);
      h2 = Math.imul(h2 ^ value.charCodeAt(i), 0x85ebca6b);
    }
    const key = `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
    const property = attr === 'data-nl-gradient' ? 'background-image' : 'box-shadow';
    if (typeof CSS !== 'undefined' && !CSS.supports(property, value)) return false;
    if (this.cssValues.size > MAX_CSS_VALUES) this.cssValues.clear();
    this.cssValues.set(key, value);
    el.setAttribute(attr, key);
    this.addRule(el, attr, key);
    return true;
  }
  private flushRules(): void {
    for (const ctx of this.contexts.values()) {
      if (ctx.dirty) { ctx.dyn.textContent = [...ctx.rules].join('\n'); ctx.dirty = false; }
    }
  }
  private setColor(el: Element, attr: ColorAttr, color: RGBA): void {
    const key = colorKey(color);
    el.setAttribute(attr, key);
    this.addRule(el, attr, key);
  }

  // ---- traversal & queue ---

  private collect(start: Node, out: Element[], limit = Number.POSITIVE_INFINITY): void {
    const stack: Element[] = [];
    const pushChildren = (p: ParentNode) => { for (let c = p.lastElementChild; c; c = c.previousElementSibling) stack.push(c); };
    if (start.nodeType === 1) stack.push(start as Element); else pushChildren(start as ParentNode);
    while (stack.length && out.length < limit) {
      const el = stack.pop()!;
      if (SKIP_TAGS.has(el.tagName) || el.hasAttribute(OWNED)) continue;
      out.push(el);
      if (el.namespaceURI === SVG_NS) continue;
      if (el.shadowRoot) { this.attachRoot(el.shadowRoot); this.collect(el.shadowRoot, out, limit); }
      pushChildren(el);
    }
  }
  private enqueueSubtree(root: Node, limit?: number): void {
    const found: Element[] = [];
    this.collect(root, found, limit);
    for (const el of found) this.queue.add(el);
    this.schedule();
  }
  private rescanAll(): void {
    this.enqueueSubtree(this.doc);
  }

  private onMutations(records: MutationRecord[]): void {
    for (const rec of records) {
      if (rec.type === 'childList') {
        rec.addedNodes.forEach((n) => {
          // Insertions are queued in full (batching keeps the work time-sliced); capping here
          // would permanently leave the tail of a large append unthemed.
          if (n.nodeType === 1 && !(n as Element).hasAttribute(OWNED)) this.enqueueSubtree(n);
          // Iframes are handled by their own content script (all_frames).
        });
        continue;
      }
      const el = rec.target as Element;
      if (el === this.doc.documentElement || el === this.doc.body) continue;
      if (rec.attributeName === 'style' && !STYLE_ATTR_RELEVANT.test(el.getAttribute('style') ?? '')) continue;
      this.queue.add(el);
      if (rec.attributeName === 'class' && el.childElementCount > 0) {
        // Traverse once with a hard cap instead of counting the entire subtree
        // with querySelectorAll and then traversing it a second time.
        this.enqueueSubtree(el, SUBTREE_REPROCESS_LIMIT);
      }
    }
    // Do not retain style contexts for shadow hosts removed by an SPA.
    for (const [root, ctx] of this.contexts) {
      if (root !== this.doc && !(root as ShadowRoot).host.isConnected) {
        // Strip before dropping the context: a host that is re-attached later would otherwise
        // keep stale data-nl-* attributes whose generated rules no longer exist.
        this.stripWithin(root);
        this.detachContext(ctx);
        this.contexts.delete(root);
      }
    }
    this.schedule();
  }

  private schedule(): void {
    if (this.scheduled || !this.running || this.queue.size === 0) return;
    this.scheduled = true;
    const run = () => { this.frame = null; this.scheduled = false; this.flush(); };
    if (typeof this.win.requestAnimationFrame === 'function') this.frame = this.win.requestAnimationFrame(run); else this.after(16, run);
  }

  // ---- processing ---

  private flush(): void {
    if (!this.running || !this.applied) { this.queue.clear(); return; }
    const start = typeof performance !== 'undefined' ? performance.now() : 0;
    const batch: Element[] = [];
    for (const el of this.queue) { if (batch.length >= this.batchSize) break; batch.push(el); }
    for (const el of batch) this.queue.delete(el);
    this.doc.documentElement.setAttribute(READY, '');
    const items = batch.filter((el) => el.isConnected);
    for (const el of items) if (this.processed.has(el)) this.strip(el);
    const reads = items.map((el) => this.read(el));
    for (const r of reads) this.write(r);
    this.flushRules();
    this.stats.processed += items.length;
    this.stats.duration += typeof performance !== 'undefined' ? performance.now() - start : 0;
    if (this.config.developerMode && items.length > 0 && this.options.onStats) {
      this.options.onStats(this.getStats());
    }
    if (this.queue.size > 0) this.schedule();
  }

  /** Remove every extension-generated attribute inside a root (document or shadow root). */
  private stripWithin(root: Node): void {
    const container = root as Node & Pick<ParentNode, 'querySelectorAll'>;
    container.querySelectorAll(MANAGED_SELECTOR).forEach((el) => { this.strip(el); el.removeAttribute(READY); });
    container.querySelectorAll(`[${DEV_ATTR}]`).forEach((el) => el.removeAttribute(DEV_ATTR));
    if ((root as Document).documentElement) (root as Document).documentElement.removeAttribute(READY);
  }

  private strip(el: Element): void {
    for (const a of MANAGED_ATTRS) el.removeAttribute(a);
    el.removeAttribute(DEV_ATTR);
    if (el.localName === 'svg') el.querySelectorAll('[data-nl-fill],[data-nl-stroke]').forEach((s) => { s.removeAttribute('data-nl-fill'); s.removeAttribute('data-nl-stroke'); });
  }

  private color(v: string): RGBA | null {
    if (v === '') return { ...TRANSPARENT };
    if (this.config.enableCache === false) return parseColor(v);
    // Simple cache
    const cached = this.seenColors.get(v);
    if (cached) { this.stats.cacheHit++; return cached; }
    const parsed = parseColor(v);
    if (parsed) {
      if (this.seenColors.size > 2000) this.seenColors.clear();
      this.seenColors.set(v, parsed);
    }
    return parsed;
  }

  private read(el: Element): Read {
    const cs = this.win.getComputedStyle(el);
    const isSvg = el.namespaceURI === SVG_NS && el.localName === 'svg';
    const kind: Read['kind'] = isSvg ? 'svg' : el.localName === 'canvas' ? 'canvas' : 'element';
    // Geometry is only consulted for canvas/SVG plates. Calling getBoundingClientRect for every
    // element would force a layout query per node and buys nothing for ordinary elements.
    let width = 0, height = 0;
    if (kind !== 'element') {
      const rect = el.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      if (!width || !height) { width = parseFloat(el.getAttribute('width') ?? ''); height = parseFloat(el.getAttribute('height') ?? ''); }
    }
    const r: Read = {
      el, kind, bg: null, fg: null, hasBgImage: false, gradient: null, boxShadow: null, borders: [], disabled: false, coloredLink: false,
      control: CONTROL_TAGS.has(el.localName), isCode: CODE_TAGS.has(el.tagName), isTable: TABLE_TAGS.has(el.tagName),
      isModal: false,
      width, height, hasText: false, shapes: [],
    };
    // Detect modal/notification via aria
    try {
      r.isModal = el.getAttribute('role') === 'dialog' || el.getAttribute('role') === 'alertdialog' || el.classList.contains('modal') || el.classList.contains('notification');
    } catch { /* ignore */ }

    if (kind === 'canvas') return r;
    if (kind === 'svg') {
      r.hasText = el.querySelector('text') !== null;
      if (width <= ICON_MAX_PX && height <= ICON_MAX_PX) {
        el.querySelectorAll(SVG_SHAPES).forEach((s, i) => {
          if (i >= MAX_ICON_SHAPES) return;
          const scs = this.win.getComputedStyle(s);
          r.shapes.push({ el: s, fill: parseColor(scs.fill), stroke: parseColor(scs.stroke) });
        });
      }
      return r;
    }
    r.bg = this.color(cs.backgroundColor);
    r.hasBgImage = cs.backgroundImage !== '' && cs.backgroundImage !== 'none';
    r.fg = cs.color === '' ? null : this.color(cs.color);
    if (r.hasBgImage) r.gradient = mapGradient(cs.backgroundImage, this.config.tokens);
    if (cs.boxShadow && cs.boxShadow !== 'none') r.boxShadow = mapBoxShadow(cs.boxShadow, this.config.tokens);

    for (const [prop, attr] of SIDES) {
      const w = parseFloat((cs as unknown as Record<string, string>)[`${prop}Width`] ?? '0');
      const style = (cs as unknown as Record<string, string>)[`${prop}Style`] ?? '';
      const color = this.color((cs as unknown as Record<string, string>)[`${prop}Color`] ?? '');
      if (w > 0 && style !== 'none' && style !== 'hidden' && color && color.a > 0) r.borders.push({ attr, color });
    }
    try { r.disabled = el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true'; } catch { r.disabled = false; }
    r.coloredLink = el.localName === 'a' && el.hasAttribute('href') && !!r.fg && isColoredLink(r.fg);
    return r;
  }

  private propagateCanvasBackground(el: Element, mapped: RGBA): void {
    const html = this.doc.documentElement;
    if (el === this.doc.body && !this.ownBg.has(html)) this.setColor(html, 'data-nl-bg', mapped);
  }

  private infoFor(el: Element | null): BgInfo {
    for (let cur = el; cur; cur = parentOf(cur)) {
      const i = this.bgInfo.get(cur);
      if (i) return i;
    }
    return { rgb: this.config.tokens.colors.bg, orig: WHITE, locked: false };
  }

  private write(r: Read): void {
    const { el } = r;
    const t = this.config.tokens;
    const parent = this.infoFor(parentOf(el));
    this.processed.add(el);

    if (this.config.compatibility === 'mediaOnly') {
      this.bgInfo.set(el, parent);
      return;
    }

    if (r.kind === 'canvas') {
      this.bgInfo.set(el, parent);
      const big = r.width >= PLATE_MIN_W && r.height >= PLATE_MIN_H;
      if (big && relativeLuminance(parent.orig) > LIGHT_BG_LUMINANCE) this.setColor(el, 'data-nl-plate', { ...parent.orig, a: 1 });
      return;
    }
    if (r.kind === 'svg') {
      this.bgInfo.set(el, parent);
      if (r.shapes.length > 0 && !parent.locked) {
        for (const s of r.shapes) {
          for (const [paint, attr] of [[s.fill, 'data-nl-fill'], [s.stroke, 'data-nl-stroke']] as const) {
            if (!paint || paint.a === 0) continue;
            const mapped = ensureContrast(mapForeground(opaque(paint), t), parent.rgb, MIN_GRAPHIC_CONTRAST);
            this.setColor(s.el, attr, { ...mapped, a: 1 });
          }
        }
      } else if (r.hasText && r.width >= PLATE_MIN_W && r.height >= PLATE_MIN_H && relativeLuminance(parent.orig) > LIGHT_BG_LUMINANCE) {
        this.setColor(el, 'data-nl-plate', { ...parent.orig, a: 1 });
      }
      return;
    }

    this.ownBg.delete(el);
    let { rgb, orig, locked } = parent;

    // Handle code blocks with special care – preserve syntax highlighting hues but ensure contrast
    const isCodeBlock = r.isCode;

    if (r.bg === null) {
      locked = true;
    } else if (r.hasBgImage) {
      if (r.gradient && this.setCssValue(el, 'data-nl-gradient', r.gradient)) {
        // Gradient stops are now dark, so descendants can be themed normally.
        // Non-gradient images remain locked to avoid putting light text over an
        // image that previously relied on a dark text color.
        if (r.bg.a > 0) {
          const mapped = mapBackground(r.bg, t);
          this.setColor(el, 'data-nl-bg', mapped);
          this.ownBg.add(el);
          rgb = blend(mapped, parent.rgb);
          orig = blend(r.bg, parent.orig);
        }
        locked = false;
      } else {
        locked = true;
        if (r.bg.a > 0) { rgb = blend(r.bg, parent.rgb); orig = blend(r.bg, parent.orig); }
      }
    } else if (r.bg.a > 0) {
      const mapped = mapBackground(r.bg, t);
      this.setColor(el, 'data-nl-bg', mapped);
      this.ownBg.add(el);
      this.propagateCanvasBackground(el, mapped);
      rgb = blend(mapped, parent.rgb);
      orig = blend(r.bg, parent.orig);
      if (r.bg.a >= 0.95) locked = false;
    }
    this.bgInfo.set(el, { rgb, orig, locked });

    if (el === this.doc.documentElement && !this.ownBg.has(el) && !locked) {
      const key = this.doc.body?.getAttribute('data-nl-bg') ?? colorKey({ ...t.colors.bg, a: 1 });
      el.setAttribute('data-nl-bg', key);
      this.addRule(el, 'data-nl-bg', key);
    }
    if (locked) return;

    if (r.fg) {
      // Input fields and form controls need special handling: ensure cursor visibility
      let base: RGB;
      if (r.coloredLink) {
        base = mapLinkColor(opaque(r.fg), t);
      } else if (isCodeBlock && !parent.locked) {
        // Preserve hue for syntax colors but ensure readability
        base = mapForeground(opaque(r.fg), t);
      } else {
        base = mapForeground(opaque(r.fg), t);
      }
      const visible = r.fg.a < 1 ? blend({ ...base, a: r.fg.a }, rgb) : base;
      const min = r.disabled ? t.minDisabledContrast : t.minTextContrast;
      // For high contrast accessibility, enforce stricter
      const effectiveMin = this.config.accessibility?.highContrast ? Math.max(min, 7) : min;
      this.setColor(el, 'data-nl-fg', { ...ensureContrast(visible, rgb, effectiveMin), a: 1 });
      if (r.coloredLink) el.setAttribute('data-nl-link', '');
    }
    for (const b of r.borders) {
      const mapped = mapBorder(opaque(b.color), t);
      const min = r.control ? t.minControlBorderContrast : t.minBorderContrast;
      const effectiveMin = this.config.accessibility?.highContrast ? Math.max(min, 3) : min;
      const final = contrastRatio(mapped, rgb) >= effectiveMin ? mapped : ensureContrast(mapped, rgb, effectiveMin);
      this.setColor(el, b.attr, { ...final, a: 1 });
    }
    if (r.boxShadow) this.setCssValue(el, 'data-nl-shadow', r.boxShadow);

    // Developer mode: annotate element with original vs mapped info
    if (this.config.developerMode) {
      try {
        const origBg = r.bg ? `${r.bg.r},${r.bg.g},${r.bg.b}` : 'none';
        const mappedBg = rgb ? `${Math.round(rgb.r)},${Math.round(rgb.g)},${Math.round(rgb.b)}` : 'inherit';
        el.setAttribute(DEV_ATTR, `orig:${origBg}|mapped:${mappedBg}`);
      } catch { /* ignore */ }
    }

    // Handle tables: ensure header distinct
    if (r.isTable && el.tagName === 'TH') {
      // Already handled via bg/fg mapping, but ensure bold
    }

    // Handle tooltips and dropdowns: they often have absolute positioning
    // Already handled via standard mapping
  }

  /** For debugging: dump current element mapping */
  debugElement(el: Element): { original: string; mapped: string; contrast: number } | null {
    const bgInfo = this.bgInfo.get(el);
    if (!bgInfo) return null;
    const cs = this.win.getComputedStyle(el);
    const contrast = contrastRatio({ r: 255, g: 255, b: 255 }, bgInfo.rgb);
    return { original: cs.backgroundColor, mapped: `rgb(${Math.round(bgInfo.rgb.r)}, ${Math.round(bgInfo.rgb.g)}, ${Math.round(bgInfo.rgb.b)})`, contrast };
  }
}
