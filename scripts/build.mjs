import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { makeIcons } from './make-icons.mjs';
import { TARGETS, resolveTargets } from './build/targets.mjs';
import { buildManifest, validateManifest, validateManifestFiles } from './build/manifest.mjs';
import { safariDocumentation } from './build/safari-docs.mjs';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const staging = resolve(dist, '.staging');

function parseArgs(argv) {
  const requested = [];
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--target') {
      const value = argv[++index];
      if (!value) throw new Error('--target needs a value');
      requested.push(value);
    } else if (arg.startsWith('--target=')) {
      requested.push(arg.slice('--target='.length));
    } else if (arg === '--all') {
      // explicit default
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/build.mjs [--target chrome|edge|brave|opera|firefox|safari]... [--all]');
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return resolveTargets(requested);
}

/**
 * One shared JavaScript build feeds every target. Pages (popup/options) are a multi-page Vite
 * build; the content script and the background context are single-file IIFE bundles because
 * content scripts cannot be ES modules, and a classic bundle also runs as a Firefox/Safari
 * event page without `type: module`.
 */
async function buildSharedBundles() {
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });

  await build({
    configFile: false,
    root: resolve(root, 'src'),
    base: './',
    plugins: [react()],
    build: {
      outDir: staging,
      emptyOutDir: false,
      minify: true,
      rollupOptions: {
        input: {
          popup: resolve(root, 'src/popup/index.html'),
          options: resolve(root, 'src/options/index.html'),
        },
      },
    },
    logLevel: 'warn',
  });

  for (const [entry, file] of [
    ['src/content/index.ts', 'content.js'],
    ['src/background/index.ts', 'background.js'],
  ]) {
    await build({
      configFile: false,
      root,
      build: {
        outDir: staging,
        emptyOutDir: false,
        minify: true,
        lib: { entry: resolve(root, entry), formats: ['iife'], name: 'NightLens', fileName: () => file },
      },
      logLevel: 'warn',
    });
  }

  makeIcons(resolve(staging, 'icons'));
}

function writeTarget(target, version) {
  const outputDir = resolve(dist, target.output);
  mkdirSync(outputDir, { recursive: true });
  cpSync(staging, outputDir, { recursive: true });

  const manifest = buildManifest({ root, target, version });
  const problems = [
    ...validateManifest(manifest, target.id, target),
    ...validateManifestFiles(manifest, outputDir),
  ];
  if (problems.length > 0) {
    throw new Error(`Invalid ${target.id} manifest:\n  - ${problems.join('\n  - ')}`);
  }

  writeFileSync(resolve(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  if (target.documentation) {
    const documentationDir = resolve(dist, target.documentation);
    mkdirSync(documentationDir, { recursive: true });
    for (const [name, content] of Object.entries(safariDocumentation({ root, manifest, target }))) {
      writeFileSync(resolve(documentationDir, name), content);
    }
  }

  return {
    target: target.id,
    label: target.label,
    output: target.output.replace(/\\/g, '/'),
    manifestVersion: manifest.manifest_version,
    version: manifest.version,
    files: countFiles(outputDir),
    manifestSha256: createHash('sha256').update(JSON.stringify(manifest)).digest('hex').slice(0, 16),
  };
}

function countFiles(directory) {
  let count = 0;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(resolve(dir, entry.name));
      else count++;
    }
  };
  walk(directory);
  return count;
}

async function main() {
  const targets = parseArgs(process.argv.slice(2));
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });

  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  await buildSharedBundles();

  const report = [];
  for (const id of targets) report.push(writeTarget(TARGETS[id], pkg.version));

  rmSync(staging, { recursive: true, force: true });

  writeFileSync(
    resolve(dist, 'build-report.json'),
    `${JSON.stringify({ name: pkg.name, version: pkg.version, builtAt: new Date().toISOString(), targets: report }, null, 2)}\n`,
  );

  for (const entry of report) {
    console.log(`✓ ${entry.target.padEnd(8)} → dist/${entry.output} (${entry.files} files, manifest ${entry.manifestSha256})`);
  }
  if (targets.includes('safari') && !existsSync(resolve(dist, 'safari/documentation/README.md'))) {
    console.warn('! Safari documentation was not generated');
  }
  console.log(`NightLens ${pkg.version}: built ${targets.length} target(s) into ${dist}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
