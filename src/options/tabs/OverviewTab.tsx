import type { FormEvent } from 'react';
import { PREMIUM_THEME_META, themePreviewColors } from '../../engine/palette';
import type { Settings } from '../../shared/types';
import {
  AppearanceControls,
  PresetChips,
  SectionCard,
  THEME_LABELS,
} from '../../ui/components';
import {
  IconChevronRight,
  IconGlobe,
  IconLayers,
  IconPlus,
  IconShield,
  IconSliders,
} from '../../ui/icons';

interface OverviewTabProps {
  settings: Settings;
  excluded: string[];
  forced: string[];
  input: string;
  inputError: string;
  onInputChange: (v: string) => void;
  onAddExcluded: (e: FormEvent) => void;
  onRemoveRule: (host: string) => void;
  onChange: (updater: (s: Settings) => Settings, msg: string) => void;
  onNavigateTab: (tab: 'themes' | 'sites') => void;
}

export function OverviewTab({
  settings,
  excluded,
  forced,
  input,
  inputError,
  onInputChange,
  onAddExcluded,
  onRemoveRule,
  onChange,
  onNavigateTab,
}: OverviewTabProps) {
  const warmth = settings.warmth ?? settings.sepia;
  const activePreview = themePreviewColors(settings.theme);

  return (
    <>
      <div className="page-header">
        <h1>Welcome to NightLens</h1>
        <p className="page-lead">
          Intelligent dark mode that respects every website’s hierarchy and contrast.
          Engineered for reading comfort, visual clarity, and local-only privacy.
        </p>
      </div>

      <div className="grid-2">
        <div className="card stack">
          <div className="row">
            <span className="eyebrow">Active Theme</span>
            <button
              type="button"
              className="link"
              onClick={() => onNavigateTab('themes')}
            >
              <span>Explore</span>
              <IconChevronRight size={13} />
            </button>
          </div>
          <div className="row-start" style={{ gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: activePreview.bg,
                border: `1.5px solid ${activePreview.accent}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: activePreview.text,
                fontWeight: 700,
                fontSize: 13,
                flexShrink: 0,
              }}
              aria-hidden="true"
            >
              Aa
            </div>
            <div>
              <div className="heading-card">
                {THEME_LABELS[settings.theme] ?? settings.theme}
              </div>
              <div className="card-description">
                {PREMIUM_THEME_META[settings.theme]?.description ??
                  'Balanced custom configuration'}
              </div>
            </div>
          </div>
        </div>

        <div className="card stack">
          <span className="eyebrow">Workspace Summary</span>
          <div className="stats-strip" style={{ marginTop: 2 }}>
            <div className="stat-tile">
              <div className="stat-value">{excluded.length + forced.length}</div>
              <div className="stat-label">Site rules</div>
            </div>
            <div className="stat-tile">
              <div className="stat-value">{settings.customThemes.length}</div>
              <div className="stat-label">Custom themes</div>
            </div>
            <div className="stat-tile">
              <div className="stat-value">
                {Object.keys(settings.customCSS).length}
              </div>
              <div className="stat-label">Custom CSS</div>
            </div>
          </div>
        </div>
      </div>

      <SectionCard
        icon={<IconSliders size={15} />}
        title="Appearance at a glance"
        spacing="stack-lg"
      >
        <AppearanceControls
          settings={settings}
          onChange={onChange}
          showSepia
        />
        <div className="stack-xs">
          <span className="field-label">Quick presets</span>
          <PresetChips
            current={{
              brightness: settings.brightness,
              contrast: settings.contrast,
              warmth,
            }}
            onSelect={(p) =>
              onChange(
                (s) => ({
                  ...s,
                  brightness: p.brightness,
                  contrast: p.contrast,
                  warmth: p.warmth,
                  sepia: p.warmth,
                }),
                `${p.label ?? 'Quick'} preset applied.`,
              )
            }
          />
        </div>
        <p className="card-description">
          Text contrast never drops below WCAG AA (4.5:1; 7:1 in High Contrast) where
          achievable. Adjustments apply live across all open tabs.
        </p>
      </SectionCard>

      <SectionCard icon={<IconLayers size={15} />} title="Current Behavior">
        <div className="stack-xs">
          <div className="setting-row">
            <span className="muted">Global dark mode</span>
            <span
              className={`badge ${settings.enabled ? 'badge-active' : 'badge-off'}`}
            >
              {settings.enabled ? 'On' : 'Off'}
            </span>
          </div>
          <hr className="divider" />
          <div className="setting-row">
            <span className="muted">Selected theme</span>
            <span className="heading-card">
              {THEME_LABELS[settings.theme] ?? settings.theme}
            </span>
          </div>
          <hr className="divider" />
          <div className="setting-row">
            <span className="muted">Automatic schedule</span>
            <span
              className={`badge ${settings.schedule.enabled ? 'badge-warn' : 'badge-off'}`}
            >
              {settings.schedule.enabled
                ? `${settings.schedule.start}–${settings.schedule.end}`
                : 'Off'}
            </span>
          </div>
          <hr className="divider" />
          <div className="setting-row">
            <span className="muted">Reading mode</span>
            <span
              className={`badge ${settings.readingMode.enabled ? 'badge-active' : 'badge-off'}`}
            >
              {settings.readingMode.enabled ? 'On' : 'Off'}
            </span>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        icon={<IconGlobe size={15} />}
        title="Sites"
        ariaLabel="Site exclusions and data"
        action={
          <button
            type="button"
            className="link"
            onClick={() => onNavigateTab('sites')}
          >
            <span>All website rules</span>
            <IconChevronRight size={13} />
          </button>
        }
        description={
          <>
            Rules inherit to subdomains, and the closest matching hostname wins. Ports,
            schemes and paths are ignored.
          </>
        }
      >
        <form className="form-inline" onSubmit={onAddExcluded} noValidate>
          <div className="field">
            <label htmlFor="exclude-input-overview" className="field-label">
              Exclude a website
            </label>
            <input
              id="exclude-input-overview"
              type="text"
              value={input}
              placeholder="example.com"
              aria-invalid={inputError !== ''}
              aria-describedby="exclude-error-overview"
              onChange={(e) => onInputChange(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary">
            <IconPlus size={14} />
            <span>Add</span>
          </button>
        </form>

        {inputError ? (
          <div id="exclude-error-overview" className="status error" role="alert">
            {inputError}
          </div>
        ) : null}

        {excluded.length === 0 ? (
          <div className="empty-state">
            <IconShield size={15} />
            <span>
              No excluded sites. Use the toolbar popup or the form above to add one.
            </span>
          </div>
        ) : (
          <ul className="sites" aria-label="Excluded sites">
            {excluded.map((h) => (
              <li key={h}>
                <span className="hostname-text" style={{ fontSize: 'var(--text-xs)' }}>
                  {h}
                </span>
                <button
                  type="button"
                  className="btn btn-sm"
                  aria-label={`Remove ${h} from excluded sites`}
                  onClick={() => onRemoveRule(h)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="card-description">
          NightLens stores only these settings, in this browser’s local extension storage:
          on/off, theme, brightness, contrast, warmth, and the hostnames you excluded or
          forced on. It does not read or record your browsing history, send anything to a
          server, or use analytics.
        </p>
      </SectionCard>
    </>
  );
}
