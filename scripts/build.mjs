import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { makeIcons } from './make-icons.mjs';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// 1. Popup + options pages (multi-page app, module scripts are allowed by MV3's default CSP).
await build({
  configFile: false, root: resolve(root, 'src'), base: './', plugins: [react()],
  build: {
    outDir: dist, emptyOutDir: false, minify: true,
    rollupOptions: { input: { popup: resolve(root, 'src/popup/index.html'), options: resolve(root, 'src/options/index.html') } },
  },
  logLevel: 'warn',
});

// 2. Content script and service worker: single-file IIFE bundles (content scripts cannot be ES modules).
for (const [entry, file] of [['src/content/index.ts', 'content.js'], ['src/background/index.ts', 'background.js']]) {
  await build({
    configFile: false, root,
    build: {
      outDir: dist, emptyOutDir: false, minify: true,
      lib: { entry: resolve(root, entry), formats: ['iife'], name: 'NightLens', fileName: () => file },
    },
    logLevel: 'warn',
  });
}

// 3. Manifest (version comes from package.json) and icons.
const manifest = JSON.parse(readFileSync(resolve(root, 'src/manifest.json'), 'utf8'));
manifest.version = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version;
writeFileSync(resolve(dist, 'manifest.json'), JSON.stringify(manifest, null, 2));
makeIcons(resolve(dist, 'icons'));
console.log('NightLens built to', dist);
