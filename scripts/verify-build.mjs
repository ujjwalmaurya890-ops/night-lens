import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { TARGETS, resolveTargets } from './build/targets.mjs';
import { validateManifest, validateManifestFiles } from './build/manifest.mjs';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');

function parseArgs(argv) {
  const requested = [];
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === '--target') requested.push(argv[++index]);
    else if (argv[index].startsWith('--target=')) requested.push(argv[index].slice('--target='.length));
  }
  return resolveTargets(requested);
}

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

/** Local file references used by the built popup/options HTML. */
function htmlReferences(html) {
  const refs = new Set();
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const value = match[1];
    if (!value || value.startsWith('data:') || value.startsWith('#')) continue;
    if (/^[a-z]+:/i.test(value)) {
      refs.add(`REMOTE:${value}`);
      continue;
    }
    refs.add(value.replace(/^\.\//, ''));
  }
  return [...refs];
}

function verifyTarget(id) {
  const target = TARGETS[id];
  const directory = resolve(dist, target.output);
  const problems = [];

  if (!existsSync(directory)) return [`${id}: build output ${target.output} is missing`];
  const manifestPath = resolve(directory, 'manifest.json');
  if (!existsSync(manifestPath)) return [`${id}: manifest.json is missing`];

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    return [`${id}: manifest.json is not valid JSON (${error.message})`];
  }

  problems.push(...validateManifest(manifest, id, target));
  problems.push(...validateManifestFiles(manifest, directory));

  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  if (manifest.version !== pkg.version) {
    problems.push(`${id}: manifest version ${manifest.version} != package.json ${pkg.version}`);
  }

  for (const [page, file] of [
    ['popup', manifest.action?.default_popup],
    ['options', manifest.options_ui?.page],
  ]) {
    if (!file) continue;
    const htmlPath = resolve(directory, file);
    if (!existsSync(htmlPath)) continue;
    const html = readFileSync(htmlPath, 'utf8');
    for (const reference of htmlReferences(html)) {
      if (reference.startsWith('REMOTE:')) {
        problems.push(`${id}: ${page} page loads a remote resource (${reference.slice(7)})`);
        continue;
      }
      if (!existsSync(resolve(dirname(htmlPath), reference))) {
        problems.push(`${id}: ${page} page references missing file "${reference}"`);
      }
    }
  }

  const files = walk(directory);
  const forbidden = [
    ['eval(', /\beval\s*\(/],
    ['new Function(', /new\s+Function\s*\(/],
    ['XMLHttpRequest', /\bXMLHttpRequest\b/],
    ['importScripts(', /\bimportScripts\s*\(/],
    ['source map', /sourceMappingURL=/],
  ];
  for (const file of files) {
    if (!file.endsWith('.js')) continue;
    const text = readFileSync(file, 'utf8');
    for (const [label, pattern] of forbidden) {
      if (pattern.test(text)) problems.push(`${id}: ${file.slice(dist.length + 1)} contains ${label}`);
    }
  }

  const maps = files.filter((file) => file.endsWith('.map'));
  if (maps.length > 0) problems.push(`${id}: source maps leaked into the bundle`);

  const totalBytes = files.reduce((sum, file) => sum + statSync(file).size, 0);
  return { problems, manifest, files: files.length, totalBytes };
}

const requested = parseArgs(process.argv.slice(2));
let failed = false;

for (const id of requested) {
  const result = verifyTarget(id);
  if (Array.isArray(result)) {
    failed = true;
    console.error(`✗ ${id}: ${result.join('; ')}`);
    continue;
  }
  if (result.problems.length > 0) {
    failed = true;
    console.error(`✗ ${result.problems.join('\n✗ ')}`);
    continue;
  }
  const kb = (result.totalBytes / 1024).toFixed(0);
  console.log(
    `✓ ${id.padEnd(8)} manifest v${result.manifest.manifest_version} · ${result.files} files · ${kb} KB · permissions ${JSON.stringify(result.manifest.permissions)}`,
  );
}

if (failed) {
  console.error('\nBuild verification failed.');
  process.exitCode = 1;
} else {
  console.log(`\nVerified ${requested.length} target(s).`);
}
