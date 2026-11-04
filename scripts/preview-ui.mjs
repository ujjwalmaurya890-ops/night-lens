// Local interactive UI preview server for NightLens Popup & Settings pages.
// Runs outside Chrome by providing an in-memory chrome.* API shim in dev mode only;
// production extension bundles in dist/ never include this file.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

const CHROME_SHIM = `
<script>
(function () {
  if (window.chrome && window.chrome.storage && window.chrome.storage.local) return;
  const KEY = 'nightlens:settings';
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('nightlens-ui-preview') : null;
  let state = window.__nlPreviewState || {};
  const storageListeners = new Set();
  const messageListeners = new Set();

  if (channel) {
    channel.onmessage = (ev) => {
      if (ev.data && ev.data.type === 'storage') {
        const oldVal = state[KEY];
        state[KEY] = ev.data.value;
        storageListeners.forEach((fn) => fn({ [KEY]: { oldValue: oldVal, newValue: ev.data.value } }, 'local'));
        emitTabStatus(ev.data.value);
      }
    };
  }

  function computeStatus(s) {
    const host = 'docs.nightlens.dev';
    const mode = (s && s.siteRules && s.siteRules[host]) || null;
    if (s && s.enabled === false) return { hostname: host, status: 'globally-off', siteMode: mode };
    if (mode === 'off') return { hostname: host, status: 'excluded', siteMode: 'off' };
    return { hostname: host, status: 'active', siteMode: mode };
  }

  function emitTabStatus(s) {
    const payload = Object.assign({ type: 'nightlens/status-changed' }, computeStatus(s));
    messageListeners.forEach((fn) => fn(payload, { tab: { id: 1 }, frameId: 0 }, function () {}));
  }

  window.chrome = {
    runtime: {
      id: 'nightlens-preview',
      getManifest: () => ({ version: '1.0.0' }),
      openOptionsPage: () => { window.open('/options/index.html', '_blank'); },
      sendMessage: async () => undefined,
      onMessage: {
        addListener: (fn) => messageListeners.add(fn),
        removeListener: (fn) => messageListeners.delete(fn),
      },
    },
    tabs: {
      query: async () => [{ id: 1, active: true }],
      sendMessage: async () => computeStatus(state[KEY]),
    },
    storage: {
      local: {
        get: async (k) => (typeof k === 'string' ? { [k]: state[k] } : { ...state }),
        set: async (items) => {
          const oldVal = state[KEY];
          Object.assign(state, items);
          if (KEY in items) {
            const next = items[KEY];
            storageListeners.forEach((fn) => fn({ [KEY]: { oldValue: oldVal, newValue: next } }, 'local'));
            emitTabStatus(next);
            if (channel) channel.postMessage({ type: 'storage', value: next });
          }
        },
      },
      onChanged: {
        addListener: (fn) => storageListeners.add(fn),
        removeListener: (fn) => storageListeners.delete(fn),
      },
    },
  };
})();
</script>
`;

const STUDIO_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>NightLens — UI & Motion Design System Preview</title>
  <style>
    :root {
      --bg: #0b0d12;
      --surface: #14171f;
      --surface-2: #1d222e;
      --border: #272d3b;
      --text: #f1f3f8;
      --muted: #9ea6b8;
      --accent: #7ab7ff;
      --on-accent: #08121f;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--bg);
      color: var(--text);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex;
      flex-direction: column;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 18px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      flex-wrap: wrap;
    }
    .title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    .pill-tag {
      font-size: 11px;
      font-weight: 500;
      color: var(--muted);
      background: var(--surface-2);
      border: 1px solid var(--border);
      padding: 2px 8px;
      border-radius: 999px;
    }
    .tabs {
      display: inline-flex;
      gap: 4px;
      background: var(--bg);
      padding: 3px;
      border-radius: 10px;
      border: 1px solid var(--border);
    }
    .tabs button {
      border: 0;
      background: transparent;
      color: var(--muted);
      font: inherit;
      font-size: 12px;
      font-weight: 500;
      padding: 6px 12px;
      border-radius: 7px;
      cursor: pointer;
      transition: background 160ms, color 160ms;
    }
    .tabs button:hover { color: var(--text); }
    .tabs button.active {
      background: var(--accent);
      color: var(--on-accent);
      font-weight: 600;
    }
    main {
      flex: 1;
      display: flex;
      min-height: 0;
    }
    .studio-split {
      flex: 1;
      display: grid;
      grid-template-columns: 420px minmax(0, 1fr);
      gap: 0;
      min-height: calc(100vh - 53px);
    }
    .popup-stage {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 24px 16px;
      border-right: 1px solid var(--border);
      background: radial-gradient(circle at 50% 0%, rgba(122,183,255,0.07), transparent 65%);
    }
    .stage-caption {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 12px;
    }
    .popup-frame {
      width: 380px;
      height: 580px;
      border: 1px solid var(--border);
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 18px 44px rgba(0,0,0,0.55);
      background: #0f1116;
    }
    .options-frame {
      width: 100%;
      height: calc(100vh - 53px);
      border: 0;
      background: #0f1116;
    }
    .single-view {
      flex: 1;
      display: flex;
      align-items: stretch;
      justify-content: center;
    }
    .hidden { display: none !important; }
    @media (max-width: 960px) {
      .studio-split { grid-template-columns: 1fr; }
      .popup-stage { border-right: 0; border-bottom: 1px solid var(--border); }
    }
  </style>
</head>
<body>
  <header>
    <div class="title">
      <span>NightLens UI Studio</span>
      <span class="pill-tag">Popup + Settings Synchronized Live</span>
    </div>
    <div class="tabs" role="tablist" aria-label="Preview layout">
      <button type="button" class="active" data-mode="split">Side-by-Side</button>
      <button type="button" data-mode="popup">Popup Only</button>
      <button type="button" data-mode="options">Settings Page</button>
    </div>
  </header>
  <main>
    <div id="view-split" class="studio-split">
      <div class="popup-stage">
        <div class="stage-caption">Extension Toolbar Popup (380px)</div>
        <iframe class="popup-frame" src="./popup/index.html" title="NightLens Popup"></iframe>
      </div>
      <iframe class="options-frame" src="./options/index.html" title="NightLens Settings"></iframe>
    </div>
    <div id="view-popup" class="single-view hidden">
      <div class="popup-stage" style="border:0; width:100%">
        <div class="stage-caption">Extension Toolbar Popup (380px)</div>
        <iframe class="popup-frame" src="./popup/index.html" title="NightLens Popup Standalone"></iframe>
      </div>
    </div>
    <div id="view-options" class="single-view hidden">
      <iframe class="options-frame" src="./options/index.html" title="NightLens Settings Standalone"></iframe>
    </div>
  </main>
  <script>
    const buttons = document.querySelectorAll('[data-mode]');
    const views = {
      split: document.getElementById('view-split'),
      popup: document.getElementById('view-popup'),
      options: document.getElementById('view-options'),
    };
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode');
        buttons.forEach((b) => b.classList.toggle('active', b === btn));
        Object.entries(views).forEach(([k, el]) => el.classList.toggle('hidden', k !== mode));
      });
    });
  </script>
</body>
</html>`;

const server = await createServer({
  configFile: false,
  root: resolve(root, 'src'),
  server: {
    host: '0.0.0.0',
    port: Number(process.env.PORT || 5173),
    allowedHosts: true,
  },
  plugins: [
    react(),
    {
      name: 'nightlens-preview-studio',
      transformIndexHtml(html) {
        return html.replace('<head>', `<head>${CHROME_SHIM}`);
      },
      configureServer(srv) {
        srv.middlewares.use((req, res, next) => {
          const url = req.url?.split('?')[0];
          if (url === '/' || url === '/index.html') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(STUDIO_HTML);
            return;
          }
          next();
        });
      },
    },
  ],
});

await server.listen();
server.printUrls();
