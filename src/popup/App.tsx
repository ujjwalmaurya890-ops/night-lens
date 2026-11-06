import { useState } from 'react';
import { LIMITS } from '../shared/defaults';
import type { SiteStatus, ThemeId } from '../shared/types';
import {
  AppearanceControls,
  CollapsiblePanel,
  Logo,
  PresetChips,
  Slider,
  StatusLine,
  Switch,
  ThemeGrid,
  ThemeSelect,
  THEME_LABELS,
} from '../ui/components';
import { usePageStatus, useSettings } from '../ui/hooks';
import {
  IconAlertCircle,
  IconCheckCircle,
  IconChevronDown,
  IconClock,
  IconGlobe,
  IconInfo,
  IconKeyboard,
  IconMoon,
  IconPalette,
  IconReset,
  IconSettings,
  IconShield,
  IconSliders,
  IconSparkles,
} from '../ui/icons';

const STATUS_META: Record<
  SiteStatus,
  {
    badge: string;
    badgeTone: 'badge-active' | 'badge-off' | 'badge-warn' | 'badge-idle';
    barTone: 'active' | 'neutral' | 'warn';
    description: string;
  }
> = {
  active: {
    badge: 'Active',
    badgeTone: 'badge-active',
    barTone: 'active',
    description: 'Dark mode is active on this site.',
  },
  'globally-off': {
    badge: 'Off',
    badgeTone: 'badge-off',
    barTone: 'neutral',
    description: 'NightLens is turned off everywhere.',
  },
  excluded: {
    badge: 'Excluded',
    badgeTone: 'badge-off',
    barTone: 'neutral',
    description: 'This site is excluded.',
  },
  'native-dark': {
    badge: 'Native dark',
    badgeTone: 'badge-idle',
    barTone: 'neutral',
    description: 'This site already looks dark, so NightLens left it alone.',
  },
  'waiting-for-system': {
    badge: 'System light',
    badgeTone: 'badge-warn',
    barTone: 'warn',
    description: 'Waiting for your system to use dark appearance.',
  },
  'scheduled-off': {
    badge: 'Scheduled',
    badgeTone: 'badge-warn',
    barTone: 'warn',
    description: 'Scheduled off — waiting for your dark hours.',
  },
};

const QUICK_THEME_FAVORITES: { id: ThemeId; label: string }[] = [
  { id: 'midnight', label: 'Midnight' },
  { id: 'amoled', label: 'AMOLED' },
  { id: 'nord', label: 'Nord' },
  { id: 'dracula', label: 'Dracula' },
  { id: 'oledNight', label: 'OLED' },
];

export function App() {
  const { settings, ready, notice, change, reset } = useSettings();
  const page = usePageStatus();
  const [confirmReset, setConfirmReset] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const host = page.state === 'ready' ? page.hostname : null;
  const siteControlsAvailable = page.state === 'ready' && host !== null;
  const siteOn = page.state === 'ready' ? page.siteMode !== 'off' : false;
  const isEnabled = settings.enabled;
  const warmth = settings.warmth ?? settings.sepia;

  const setSiteMode = (mode: 'on' | 'off' | null) => {
    if (!host) return;
    const text =
      mode === 'off'
        ? `${host} is now excluded.`
        : mode === 'on'
          ? `Dark mode is forced on for ${host}.`
          : `${host} is back on automatic.`;
    void change((s) => {
      const rules = { ...s.siteRules };
      if (mode === null) delete rules[host];
      else rules[host] = mode;
      return { ...s, siteRules: rules };
    }, text);
  };

  const isActive = page.state === 'ready' && page.status === 'active';
  const statusMeta = page.state === 'ready' ? STATUS_META[page.status] : null;
  const version = chrome.runtime.getManifest?.()?.version ?? '1.0.0';

  return (
    <main
      className="popup-shell shell-enter"
      aria-busy={!ready}
      data-reduced-motion={settings.accessibility.reducedMotion ? 'true' : undefined}
    >
      <header className="popup-header">
        <div className="row">
          <h1 className="popup-brand-title">
            <Logo size={28} />
            <span>NightLens</span>
          </h1>
          <div className="popup-power-group">
            <span
              id="global-label"
              className="popup-power-state"
              data-active={isEnabled ? 'true' : 'false'}
            >
              {isEnabled ? 'On' : 'Off'}
            </span>
            <Switch
              label="Dark mode (all sites)"
              checked={settings.enabled}
              onChange={(enabled) =>
                void change(
                  (s) => ({ ...s, enabled }),
                  enabled ? 'Dark mode turned on.' : 'Dark mode turned off everywhere.',
                )
              }
            />
          </div>
        </div>

        <CollapsiblePanel open={!isEnabled}>
          <div style={{ paddingTop: 10 }}>
            <div className="notice-banner notice-banner-warn">
              <IconAlertCircle size={15} style={{ marginTop: 1, flexShrink: 0 }} />
              <span>NightLens is disabled everywhere. Turn it on above to apply dark mode.</span>
            </div>
          </div>
        </CollapsiblePanel>
      </header>

      <div className="popup-body">
        {/* Current Website Control Card */}
        <section
          className={`card card-compact stack stagger-1 ${isActive ? 'card-active' : ''}`}
          aria-labelledby="site-heading"
        >
          <div className="row">
            <h2 id="site-heading" className="eyebrow">
              Current website
            </h2>
            {statusMeta && (
              <span className={`badge ${statusMeta.badgeTone}`}>
                <span className="badge-dot" aria-hidden="true" />
                {statusMeta.badge}
              </span>
            )}
          </div>

          {page.state === 'loading' && (
            <div className="site-status-bar pulse-subtle">
              <IconGlobe size={14} />
              <span>Checking this page…</span>
            </div>
          )}

          {page.state === 'unsupported' && (
            <div className="notice-banner notice-banner-info">
              <IconInfo size={15} style={{ marginTop: 1, flexShrink: 0 }} />
              <span>
                NightLens can’t run on this page. Browser pages, the Chrome Web Store, local
                files and PDF viewers are not supported. If you just installed or updated
                NightLens, reload the tab.
              </span>
            </div>
          )}

          {page.state === 'ready' && statusMeta && (
            <div className="stack">
              <div className="site-domain-row">
                <div className="site-domain-meta">
                  <div className="hostname-text">{host ?? 'Unknown site'}</div>
                  <div className="site-mode-caption">
                    {page.siteMode === 'on'
                      ? 'Forced on'
                      : page.siteMode === 'off'
                        ? 'Excluded rule'
                        : 'Automatic mode'}
                    {page.status === 'native-dark' ? ' · Native dark theme' : ''}
                  </div>
                </div>
                <Switch
                  label={`Dark mode on ${host ?? 'this site'}`}
                  checked={siteOn}
                  disabled={!siteControlsAvailable || !settings.enabled}
                  onChange={(on) => setSiteMode(on ? null : 'off')}
                />
              </div>

              <div
                id="site-status"
                className="site-status-bar"
                data-status={statusMeta.barTone}
              >
                {page.status === 'active' ? (
                  <IconCheckCircle size={14} style={{ flexShrink: 0 }} />
                ) : page.status === 'excluded' ? (
                  <IconShield size={14} style={{ flexShrink: 0 }} />
                ) : page.status === 'scheduled-off' ? (
                  <IconClock size={14} style={{ flexShrink: 0 }} />
                ) : (
                  <IconMoon size={14} style={{ flexShrink: 0 }} />
                )}
                <span>{statusMeta.description}</span>
              </div>

              {page.status === 'native-dark' && (
                <button
                  type="button"
                  className="btn btn-accent btn-sm btn-block"
                  onClick={() => setSiteMode('on')}
                >
                  <IconSparkles size={13} />
                  <span>Force dark mode on this site</span>
                </button>
              )}

              {page.siteMode === 'on' && (
                <div>
                  <button
                    type="button"
                    className="link"
                    onClick={() => setSiteMode(null)}
                  >
                    Back to automatic for this site
                  </button>
                </div>
              )}

              {page.siteMode === 'off' && (
                <button
                  type="button"
                  className="btn btn-sm btn-block"
                  onClick={() => setSiteMode(null)}
                >
                  Re-enable for this site
                </button>
              )}
            </div>
          )}
        </section>

        {/* Theme Selection Card */}
        <section className="card card-compact stack stagger-2" aria-labelledby="popup-theme-heading">
          <div className="card-header">
            <div className="card-title-group">
              <span className="card-icon">
                <IconPalette size={14} />
              </span>
              <h3 id="popup-theme-heading">Color Palette</h3>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-expanded={showThemes}
              onClick={() => setShowThemes((v) => !v)}
            >
              <span>{showThemes ? 'Hide' : 'Browse'}</span>
              <IconChevronDown size={14} className="chevron-icon" data-open={showThemes} />
            </button>
          </div>

          <ThemeSelect
            id="theme-p"
            value={settings.theme}
            onChange={(theme) =>
              void change(
                (s) => ({ ...s, theme }),
                `Theme set to ${THEME_LABELS[theme] ?? theme}.`,
              )
            }
          />

          {!showThemes && (
            <div className="preset-row" role="group" aria-label="Favorite themes">
              {QUICK_THEME_FAVORITES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`preset-chip ${settings.theme === p.id ? 'active' : ''}`}
                  aria-pressed={settings.theme === p.id}
                  onClick={() =>
                    void change(
                      (s) => ({ ...s, theme: p.id }),
                      `Theme set to ${p.label}.`,
                    )
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          <CollapsiblePanel open={showThemes}>
            <div style={{ paddingTop: 4 }}>
              <ThemeGrid
                value={settings.theme}
                onChange={(theme) =>
                  void change(
                    (s) => ({ ...s, theme }),
                    `Theme set to ${THEME_LABELS[theme] ?? theme}.`,
                  )
                }
              />
            </div>
          </CollapsiblePanel>
        </section>

        {/* Adjustments & Quick Presets Card */}
        <section
          className="card card-compact stack stagger-3"
          aria-labelledby="popup-adjustments-heading"
        >
          <div className="card-header">
            <div className="card-title-group">
              <span className="card-icon">
                <IconSliders size={14} />
              </span>
              <h3 id="popup-adjustments-heading">Adjustments</h3>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-expanded={showAdvanced}
              onClick={() => setShowAdvanced((v) => !v)}
            >
              <span>{showAdvanced ? 'Less' : 'More'}</span>
              <IconChevronDown size={14} className="chevron-icon" data-open={showAdvanced} />
            </button>
          </div>

          <AppearanceControls
            settings={settings}
            onChange={(u, m) => void change(u, m)}
            slidersOnly
          />

          <div className="stack-xs" style={{ paddingTop: 2 }}>
            <span className="field-label">Quick presets</span>
            <PresetChips
              current={{
                brightness: settings.brightness,
                contrast: settings.contrast,
                warmth,
              }}
              onSelect={(p) =>
                void change(
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

          <CollapsiblePanel open={showAdvanced}>
            <div className="stack" style={{ paddingTop: 10 }}>
              <hr className="divider" />
              <Slider
                id="warmth-p"
                label="Warmth"
                value={warmth}
                limit={LIMITS.warmth}
                onCommit={(nextWarmth) =>
                  void change(
                    (s) => ({ ...s, warmth: nextWarmth, sepia: nextWarmth }),
                    `Warmth set to ${nextWarmth}%.`,
                  )
                }
              />

              <div className="field">
                <span className="field-label">Keyboard shortcut</span>
                <div className="shortcut-bar">
                  <span className="row-start" style={{ gap: 6 }}>
                    <IconKeyboard size={14} />
                    <span>Toggle NightLens</span>
                  </span>
                  <kbd className="kbd">Alt+Shift+D</kbd>
                </div>
                <p className="field-hint">
                  Change it at chrome://extensions/shortcuts. The shortcut toggles the global switch.
                </p>
              </div>

              <div className="field">
                <span className="field-label">Website exclusion</span>
                <p className="field-hint">
                  Use the website switch above to exclude the current domain. Excluded domains
                  remain untouched unless forced on.
                </p>
              </div>
            </div>
          </CollapsiblePanel>
        </section>

        <StatusLine notice={notice} />

        {/* Footer Controls */}
        <footer className="popup-footer stagger-4">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-label="Settings"
            onClick={() => void chrome.runtime.openOptionsPage()}
          >
            <IconSettings size={14} />
            <span>Settings</span>
          </button>

          <div className="row-start" style={{ gap: 6 }}>
            {settings.schedule.enabled && (
              <span className="badge badge-warn">Scheduled</span>
            )}
            {settings.developerMode && (
              <span className="badge badge-idle">Dev</span>
            )}
            {!confirmReset ? (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setConfirmReset(true)}
              >
                <IconReset size={13} />
                <span>Reset…</span>
              </button>
            ) : (
              <span className="row-start" style={{ gap: 6 }} role="group" aria-label="Confirm reset">
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setConfirmReset(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    setConfirmReset(false);
                    void reset();
                  }}
                >
                  Reset
                </button>
              </span>
            )}
          </div>
        </footer>

        <div className="popup-meta-footer">
          NightLens v{version} · Privacy-first · No tracking
        </div>
      </div>
    </main>
  );
}
