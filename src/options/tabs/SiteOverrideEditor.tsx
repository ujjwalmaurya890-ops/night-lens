import { useState, type FormEvent } from 'react';
import { LIMITS, MAX_SITE_OVERRIDES } from '../../shared/defaults';
import { hostnameFromUserInput } from '../../shared/hostname';
import { THEME_IDS, type Settings, type SiteOverride, type ThemeId } from '../../shared/types';
import { SectionCard, THEME_LABELS } from '../../ui/components';
import type { Notice } from '../../ui/hooks';
import { IconSliders } from '../../ui/icons';

interface SiteOverrideEditorProps {
  settings: Settings;
  onChange: (updater: (s: Settings) => Settings, msg: string) => void;
  onSetNotice: (n: Notice | null) => void;
}

type Draft = {
  host: string;
  theme: '' | ThemeId;
  brightness: number;
  contrast: number;
  warmth: number;
};

const draftFromSettings = (settings: Settings): Draft => ({
  host: '',
  theme: '',
  brightness: settings.brightness,
  contrast: settings.contrast,
  warmth: settings.warmth ?? settings.sepia,
});

const NUMBER_FIELDS = [
  { key: 'brightness', label: 'Brightness', limit: LIMITS.brightness },
  { key: 'contrast', label: 'Contrast', limit: LIMITS.contrast },
  { key: 'warmth', label: 'Warmth', limit: LIMITS.warmth },
] as const;

/**
 * Creates and edits per-domain overrides. Only values that actually differ from the global
 * configuration are stored, so an override survives later global changes to unrelated sliders.
 */
export function SiteOverrideEditor({ settings, onChange, onSetNotice }: SiteOverrideEditorProps) {
  const [draft, setDraft] = useState<Draft>(() => draftFromSettings(settings));
  const [error, setError] = useState('');

  const globalWarmth = settings.warmth ?? settings.sepia;
  const atCapacity = Object.keys(settings.siteOverrides).length >= MAX_SITE_OVERRIDES;

  const setField = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const host = hostnameFromUserInput(draft.host);
    if (!host) {
      setError('Enter a website address such as example.com.');
      return;
    }
    if (atCapacity && !(host in settings.siteOverrides)) {
      setError(`You already have ${MAX_SITE_OVERRIDES} site overrides. Remove one first.`);
      return;
    }

    const override: SiteOverride = {};
    if (draft.theme) override.theme = draft.theme;
    if (draft.brightness !== settings.brightness) override.brightness = draft.brightness;
    if (draft.contrast !== settings.contrast) override.contrast = draft.contrast;
    if (draft.warmth !== globalWarmth) override.warmth = draft.warmth;

    if (Object.keys(override).length === 0) {
      setError('Change at least one value, or clear the override instead.');
      return;
    }

    setError('');
    setDraft(draftFromSettings(settings));
    onChange(
      (s) => ({ ...s, siteOverrides: { ...s.siteOverrides, [host]: override } }),
      `Override saved for ${host}.`,
    );
    onSetNotice({ kind: 'ok', text: `${host} now uses its own appearance settings.` });
  };

  return (
    <SectionCard
      icon={<IconSliders size={15} />}
      title="Per-Website Overrides"
      description="Domain-specific theme, brightness, contrast, and warmth layered atop your global configuration. The nearest matching domain wins, and subdomains inherit unless they have their own entry."
    >
      <form className="stack" onSubmit={submit} aria-describedby={error ? 'override-error' : undefined}>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="override-host" className="field-label">
              Override website
            </label>
            <input
              id="override-host"
              type="text"
              value={draft.host}
              placeholder="docs.example.com"
              onChange={(e) => setField('host', e.target.value)}
              aria-invalid={error ? true : undefined}
            />
          </div>
          <div className="field">
            <label htmlFor="override-theme" className="field-label">
              Override theme
            </label>
            <select
              id="override-theme"
              value={draft.theme}
              onChange={(e) => setField('theme', e.target.value as '' | ThemeId)}
            >
              <option value="">Inherit global theme</option>
              {THEME_IDS.map((theme) => (
                <option key={theme} value={theme}>
                  {THEME_LABELS[theme] ?? theme}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid-3">
          {NUMBER_FIELDS.map(({ key, label, limit }) => (
            <div className="field" key={key}>
              <div className="slider-row">
                <label htmlFor={`override-${key}`} className="field-label">
                  Override {label.toLowerCase()}
                </label>
                <span className="slider-value">{draft[key]}%</span>
              </div>
              <input
                id={`override-${key}`}
                type="range"
                min={limit.min}
                max={limit.max}
                step={limit.step}
                value={draft[key]}
                aria-valuetext={`${draft[key]} percent`}
                onChange={(e) => setField(key, Number(e.target.value))}
                onDoubleClick={() => setField(key, key === 'warmth' ? globalWarmth : settings[key])}
              />
            </div>
          ))}
        </div>

        {error && (
          <p id="override-error" className="field-error" role="alert">
            {error}
          </p>
        )}

        <div className="row-start">
          <button type="submit" className="btn btn-accent">
            Save override
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              // Reset the draft back to the current global values.
              setDraft(draftFromSettings(settings));
              setError('');
            }}
          >
            Reset fields
          </button>
        </div>
        <p className="field-hint">
          Only values that differ from your global settings are stored. Double-click a slider to
          snap it back to the global value.
        </p>
      </form>
    </SectionCard>
  );
}
