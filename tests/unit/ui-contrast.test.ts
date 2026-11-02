import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio, parseColor } from '../../src/engine/color';

const css = readFileSync(resolve(process.cwd(), 'src/ui/ui.css'), 'utf8');
const vars = Object.fromEntries([...css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})/g)].map((m) => [m[1]!, parseColor(m[2]!)!]));
const ratio = (a: string, b: string) => contrastRatio(vars[a]!, vars[b]!);

describe('NightLens own UI contrast (WCAG 2.2 AA), computed from src/ui/ui.css', () => {
  it('parsed the design tokens', () => expect(Object.keys(vars).length).toBeGreaterThanOrEqual(10));
  it.each([['text', 'bg'], ['text', 'surface'], ['text', 'surface-2'], ['text-muted', 'bg'], ['text-muted', 'surface'], ['accent', 'surface'], ['accent', 'bg'], ['danger', 'surface'], ['danger', 'bg'], ['success', 'bg'], ['success', 'surface'], ['on-accent', 'accent']])('text %s on %s >= 4.5:1', (fg, bg) => {
    expect(ratio(fg!, bg!)).toBeGreaterThanOrEqual(4.5);
  });
  it.each([['control-border', 'surface'], ['control-border', 'bg'], ['control-border', 'surface-2'], ['focus', 'bg'], ['focus', 'surface'], ['focus', 'surface-2'], ['accent', 'surface-2']])('non-text %s against %s >= 3:1', (fg, bg) => {
    expect(ratio(fg!, bg!)).toBeGreaterThanOrEqual(3);
  });
  it('respects reduced motion', () => expect(css).toMatch(/prefers-reduced-motion:\s*reduce/));
  it('has a visible keyboard focus style', () => expect(css).toMatch(/:focus-visible\s*\{[^}]*outline/));
});
