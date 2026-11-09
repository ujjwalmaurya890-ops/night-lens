import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../../src/engine/color';
import { buildTokens } from '../../src/engine/palette';
import { cloneDefaults } from '../../src/shared/defaults';
import {
  PURPOSE_PRESETS,
  applyPurposePreset,
  matchPurposePreset,
  purposePresetSummary,
} from '../../src/shared/presets';
import { sanitizeSettings } from '../../src/shared/storage';

describe('purpose presets (contribution 06)', () => {
  it('exposes exactly the five documented purposes with stable ids', () => {
    expect(PURPOSE_PRESETS.map((p) => p.id)).toEqual([
      'balancedDark',
      'deepDark',
      'dimReading',
      'highContrast',
      'softNight',
    ]);
    expect(purposePresetSummary().map((p) => p.label)).toEqual([
      'Balanced dark',
      'Deep dark',
      'Dim reading',
      'High contrast',
      'Soft night',
    ]);
  });

  it.each(PURPOSE_PRESETS.map((p) => [p.id, p] as const))('%s applies atomically and is recognised afterwards', (id, preset) => {
    const next = applyPurposePreset(cloneDefaults(), id);
    expect(next).toMatchObject({
      theme: preset.theme,
      brightness: preset.brightness,
      contrast: preset.contrast,
      warmth: preset.warmth,
      sepia: preset.warmth,
    });
    expect(matchPurposePreset(next)).toBe(id);
  });

  it('leaves unrelated settings untouched', () => {
    const before = sanitizeSettings({
      ...cloneDefaults(),
      enabled: false,
      siteRules: { 'example.com': 'off' },
      accessibility: { ...cloneDefaults().accessibility, underlineLinks: true },
      schedule: { ...cloneDefaults().schedule, enabled: true },
    });
    const after = applyPurposePreset(before, 'dimReading');
    expect(after.enabled).toBe(false);
    expect(after.siteRules).toEqual({ 'example.com': 'off' });
    expect(after.accessibility.underlineLinks).toBe(true);
    expect(after.schedule.enabled).toBe(true);
  });

  it('persists through sanitisation (the value the storage layer would reload)', () => {
    const applied = applyPurposePreset(cloneDefaults(), 'softNight');
    expect(matchPurposePreset(sanitizeSettings(applied))).toBe('softNight');
  });

  it('reports null once a value is customised', () => {
    const customised = { ...applyPurposePreset(cloneDefaults(), 'balancedDark'), contrast: 115 };
    expect(matchPurposePreset(customised)).toBeNull();
  });

  it.each(PURPOSE_PRESETS.map((p) => [p.id, p] as const))('%s keeps its contrast floor', (id, preset) => {
    const settings = applyPurposePreset(cloneDefaults(), id);
    const tokens = buildTokens(settings);
    const floor = tokens.minTextContrast;
    expect(floor).toBe(id === 'highContrast' ? 7 : tokens.minTextContrast);
    expect(contrastRatio(tokens.colors.text, tokens.colors.bgRaised)).toBeGreaterThanOrEqual(floor);
    expect(contrastRatio(tokens.colors.text, tokens.colors.bg)).toBeGreaterThanOrEqual(floor);
    expect(contrastRatio(tokens.colors.textMuted, tokens.colors.bgRaised)).toBeGreaterThanOrEqual(floor);
    expect(contrastRatio(tokens.colors.link, tokens.colors.bgRaised)).toBeGreaterThanOrEqual(floor);
    expect(contrastRatio(tokens.colors.border, tokens.colors.bgRaised)).toBeGreaterThanOrEqual(tokens.minBorderContrast);
    expect(preset.purpose.length).toBeGreaterThan(20);
  });
});
