import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio, parseColor } from '../../src/engine/color';

const css = readFileSync(resolve(process.cwd(), 'src/ui/ui.css'), 'utf8');
const styleDir = resolve(process.cwd(), 'src/ui/styles');
const allUiCss = [
  css,
  ...readdirSync(styleDir)
    .filter((f) => f.endsWith('.css'))
    .map((f) => readFileSync(join(styleDir, f), 'utf8')),
].join('\n');

const vars = Object.fromEntries(
  [...css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})/g)].map((m) => [
    m[1]!,
    parseColor(m[2]!)!,
  ]),
);
const ratio = (a: string, b: string) => contrastRatio(vars[a]!, vars[b]!);

describe('NightLens own UI contrast (WCAG 2.2 AA), computed from src/ui/ui.css', () => {
  it('parsed the design tokens', () => expect(Object.keys(vars).length).toBeGreaterThanOrEqual(14));

  it.each([
    ['text', 'bg'],
    ['text', 'surface'],
    ['text', 'surface-2'],
    ['text', 'surface-3'],
    ['text-secondary', 'bg'],
    ['text-secondary', 'surface'],
    ['text-secondary', 'surface-2'],
    ['text-secondary', 'surface-3'],
    ['text-muted', 'bg'],
    ['text-muted', 'surface'],
    ['text-muted', 'surface-2'],
    ['text-tertiary', 'bg'],
    ['text-tertiary', 'surface'],
    ['accent', 'surface'],
    ['accent', 'bg'],
    ['accent', 'surface-2'],
    ['danger', 'surface'],
    ['danger', 'bg'],
    ['danger', 'surface-2'],
    ['success', 'bg'],
    ['success', 'surface'],
    ['success', 'surface-2'],
    ['warning', 'bg'],
    ['warning', 'surface'],
    ['warning', 'surface-2'],
    ['on-accent', 'accent'],
    ['on-accent', 'accent-strong'],
  ])('text %s on %s >= 4.5:1', (fg, bg) => {
    expect(ratio(fg!, bg!)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['control-border', 'surface'],
    ['control-border', 'bg'],
    ['control-border', 'surface-2'],
    ['control-border', 'surface-3'],
    ['focus', 'bg'],
    ['focus', 'surface'],
    ['focus', 'surface-2'],
    ['accent', 'surface-2'],
  ])('non-text %s against %s >= 3:1', (fg, bg) => {
    expect(ratio(fg!, bg!)).toBeGreaterThanOrEqual(3);
  });

  it('respects reduced motion', () => expect(css).toMatch(/prefers-reduced-motion:\s*reduce/));
  it('has a visible keyboard focus style', () => expect(css).toMatch(/:focus-visible\s*\{[^}]*outline/));

  it('defines centralized typography and motion system tokens', () => {
    for (const token of [
      '--font-display:',
      '--font-sans:',
      '--font-mono:',
      '--text-xs:',
      '--text-sm:',
      '--text-base:',
      '--text-xl:',
      '--duration-instant:',
      '--duration-fast:',
      '--duration-normal:',
      '--duration-panel:',
      '--duration-slow:',
      '--ease-standard:',
      '--ease-enter:',
      '--ease-exit:',
    ]) {
      expect(allUiCss).toContain(token);
    }
  });

  it('contains zero !important overrides and zero external network URLs in UI CSS', () => {
    expect(allUiCss).not.toContain('!important');
    expect(allUiCss).not.toMatch(/url\(\s*['"]?https?:/i);
  });
});
