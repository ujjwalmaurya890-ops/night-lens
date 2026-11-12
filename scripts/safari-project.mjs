import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * Wraps the Safari web extension in an Xcode project using Apple's own converter.
 *
 * Apple ships no cross-platform packager: `safari-web-extension-converter` is part of Xcode and
 * only runs on macOS. This script therefore refuses to pretend it succeeded elsewhere, and prints
 * the exact command to run on a Mac instead of producing a fake `.xcodeproj`.
 */
const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'dist/safari/browser-extension');
const projectLocation = resolve(root, 'dist/safari');

if (process.platform !== 'darwin') {
  console.error('Safari packaging requires macOS with Xcode installed.');
  console.error('This machine reports platform:', process.platform);
  console.error('');
  console.error('On a Mac, run:');
  console.error(`  xcrun safari-web-extension-converter ${source} \\`);
  console.error(`    --project-location ${projectLocation} \\`);
  console.error('    --app-name "NightLens" --bundle-identifier app.nightlens.safari \\');
  console.error('    --macos-only --no-open --no-prompt');
  console.error('');
  console.error('The converted web extension is already built; see docs/SAFARI_INSTALL.md.');
  process.exitCode = 1;
} else if (!existsSync(source)) {
  console.error('dist/safari/browser-extension is missing. Run: npm run build:safari');
  process.exitCode = 1;
} else {
  const result = spawnSync(
    'xcrun',
    [
      'safari-web-extension-converter',
      source,
      '--project-location',
      projectLocation,
      '--app-name',
      'NightLens',
      '--bundle-identifier',
      'app.nightlens.safari',
      '--macos-only',
      '--no-open',
      '--no-prompt',
    ],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) {
    console.error('safari-web-extension-converter failed.');
    process.exitCode = result.status ?? 1;
  } else {
    console.log(`Xcode project written to ${projectLocation}`);
  }
}
