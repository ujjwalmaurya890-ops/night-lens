import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TARGETS, resolveTargets } from './build/targets.mjs';
import { zipDirectory } from './build/zip.mjs';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const artifacts = resolve(root, 'artifacts');

function parseArgs(argv) {
  const requested = [];
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === '--target') requested.push(argv[++index]);
    else if (argv[index].startsWith('--target=')) requested.push(argv[index].slice('--target='.length));
  }
  return resolveTargets(requested);
}

const requested = parseArgs(process.argv.slice(2));
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
mkdirSync(artifacts, { recursive: true });

const manifest = [];
let failed = false;

for (const id of requested) {
  const target = TARGETS[id];
  const directory = resolve(dist, target.output);
  if (!existsSync(resolve(directory, 'manifest.json'))) {
    failed = true;
    console.error(`✗ ${id}: not built yet. Run: npm run build:${id}`);
    continue;
  }
  const archiveName = `nightlens-${id}-${pkg.version}.zip`;
  const { buffer, entries } = zipDirectory(directory);
  writeFileSync(resolve(artifacts, archiveName), buffer);
  const sha256 = createHash('sha256').update(buffer).digest('hex').slice(0, 16);
  manifest.push({ target: id, archive: archiveName, files: entries.length, bytes: buffer.length, sha256 });
  console.log(`✓ ${archiveName} · ${entries.length} files · ${(buffer.length / 1024).toFixed(0)} KB · sha256:${sha256}`);
}

if (manifest.length > 0) {
  writeFileSync(
    resolve(artifacts, 'checksums.json'),
    `${JSON.stringify({ version: pkg.version, generatedAt: new Date().toISOString(), archives: manifest }, null, 2)}\n`,
  );
}

if (failed) process.exitCode = 1;
else console.log(`\n${manifest.length} archive(s) in artifacts/. Safari archives are converter input, not installers.`);
