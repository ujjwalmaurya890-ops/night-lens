import { useRef, useState } from 'react';
import { getBrowserApi } from '../../adapters/browser';
import { PREMIUM_THEME_META } from '../../engine/palette';
import type { Settings, ThemeId } from '../../shared/types';
import {
  CollapsiblePanel,
  Logo,
  SectionCard,
  SettingRow,
  Slider,
  Switch,
  THEME_LABELS,
} from '../../ui/components';
import {
  IconCheck,
  IconCheckCircle,
  IconClock,
  IconCpu,
  IconDownload,
  IconEye,
  IconInfo,
  IconKeyboard,
  IconLock,
  IconReset,
  IconUpload,
  IconZap,
} from '../../ui/icons';
import { browserCopy } from '../../ui/copy';

interface BaseSystemTabProps {
  settings: Settings;
  onChange: (updater: (s: Settings) => Settings, msg: string) => void;
}

export function AccessibilityTab({ settings, onChange }: BaseSystemTabProps) {
  return (
    <>
      <div className="page-header">
        <h1>Accessibility</h1>
        <p className="page-lead">
          NightLens is engineered around WCAG 2.2 readability, full keyboard control, and
          assistive technology support.
        </p>
      </div>

      <SectionCard icon={<IconEye size={15} />} title="Contrast & Readability">
        <SettingRow
          title="High contrast (7:1 AAA text)"
          description="Maximizes text luminance and emphasizes container borders"
          control={
            <Switch
              label="High contrast"
              checked={settings.accessibility.highContrast}
              onChange={(v) =>
                onChange(
                  (s) => ({
                    ...s,
                    accessibility: { ...s.accessibility, highContrast: v },
                  }),
                  v ? 'High contrast enabled.' : 'High contrast off.',
                )
              }
            />
          }
        />
        <hr className="divider" />
        <SettingRow
          title="Underline links"
          description="Ensures hyperlinks are distinguishable without relying solely on color"
          control={
            <Switch
              label="Underline links"
              checked={settings.accessibility.underlineLinks}
              onChange={(v) =>
                onChange(
                  (s) => ({
                    ...s,
                    accessibility: { ...s.accessibility, underlineLinks: v },
                  }),
                  v ? 'Link underlines on.' : 'Link underlines off.',
                )
              }
            />
          }
        />
        <hr className="divider" />
        <SettingRow
          title="Reduced motion"
          description="Minimizes page and NightLens UI animations while preserving clear state feedback"
          control={
            <Switch
              label="Reduced motion"
              checked={settings.accessibility.reducedMotion}
              onChange={(v) =>
                onChange(
                  (s) => ({
                    ...s,
                    accessibility: { ...s.accessibility, reducedMotion: v },
                  }),
                  v ? 'Reduced motion on.' : 'Reduced motion off.',
                )
              }
            />
          }
        />
        <p className="card-description">
          WCAG AA requires 4.5:1 contrast for body text and 3:1 for large text and
          controls; AAA requires 7:1. NightLens enforces AA across every recolored element
          and falls back to pure white/black when needed.
        </p>
      </SectionCard>

      <SectionCard title="Color Vision">
        <div className="field">
          <label htmlFor="color-blind-select" className="field-label">
            Color blind friendly mode
          </label>
          <select
            id="color-blind-select"
            value={settings.accessibility.colorBlindMode}
            onChange={(e) =>
              onChange(
                (s) => ({
                  ...s,
                  accessibility: {
                    ...s.accessibility,
                    colorBlindMode:
                      e.target.value as typeof s.accessibility.colorBlindMode,
                  },
                }),
                `Color blind mode: ${e.target.value}.`,
              )
            }
          >
            <option value="none">None (default)</option>
            <option value="protanopia">Protanopia (red-blind)</option>
            <option value="deuteranopia">Deuteranopia (green-blind)</option>
            <option value="tritanopia">Tritanopia (blue-blind)</option>
          </select>
          <p className="field-hint">
            Shifts link and accent hues to preserve clear perceptual separation.
          </p>
        </div>
      </SectionCard>

      <SectionCard icon={<IconKeyboard size={15} />} title="Keyboard & Screen Readers">
        <ul className="feature-list">
          <li>
            <span className="feature-list-icon">
              <IconCheck size={14} />
            </span>
            <span>
              Every interactive control is keyboard focusable with high-contrast 2px focus
              rings
            </span>
          </li>
          <li>
            <span className="feature-list-icon">
              <IconCheck size={14} />
            </span>
            <span>
              Global keyboard shortcut: <kbd className="kbd">Alt+Shift+D</kbd>
            </span>
          </li>
          <li>
            <span className="feature-list-icon">
              <IconCheck size={14} />
            </span>
            <span>
              Semantic ARIA switch states, polite/assertive live status regions, and
              descriptive labels
            </span>
          </li>
          <li>
            <span className="feature-list-icon">
              <IconCheck size={14} />
            </span>
            <span>
              Automatic support for OS <code>prefers-reduced-motion: reduce</code>
            </span>
          </li>
        </ul>
      </SectionCard>
    </>
  );
}

export function AutomationTab({ settings, onChange }: BaseSystemTabProps) {
  return (
    <>
      <div className="page-header">
        <h1>Automation</h1>
        <p className="page-lead">
          Sync NightLens automatically with your daily schedule or operating system
          appearance.
        </p>
      </div>

      <SectionCard icon={<IconClock size={15} />} title="Schedule">
        <SettingRow
          title="Enable scheduled dark mode"
          description="Activates dark mode automatically within your specified hours"
          control={
            <Switch
              label="Schedule"
              checked={settings.schedule.enabled}
              onChange={(enabled) =>
                onChange(
                  (s) => ({
                    ...s,
                    schedule: { ...s.schedule, enabled },
                  }),
                  enabled ? 'Schedule enabled.' : 'Schedule disabled.',
                )
              }
            />
          }
        />

        <CollapsiblePanel open={settings.schedule.enabled}>
          <div className="grid-2" style={{ paddingTop: 10 }}>
            <div className="field">
              <label htmlFor="schedule-start" className="field-label">
                Start (dark mode on)
              </label>
              <input
                id="schedule-start"
                type="time"
                value={settings.schedule.start}
                onChange={(e) =>
                  onChange(
                    (s) => ({
                      ...s,
                      schedule: { ...s.schedule, start: e.target.value },
                    }),
                    `Schedule start ${e.target.value}.`,
                  )
                }
              />
            </div>
            <div className="field">
              <label htmlFor="schedule-end" className="field-label">
                End (dark mode off)
              </label>
              <input
                id="schedule-end"
                type="time"
                value={settings.schedule.end}
                onChange={(e) =>
                  onChange(
                    (s) => ({
                      ...s,
                      schedule: { ...s.schedule, end: e.target.value },
                    }),
                    `Schedule end ${e.target.value}.`,
                  )
                }
              />
            </div>
          </div>
        </CollapsiblePanel>

        <p className="field-hint">
          Example: 22:00–07:00 enables dark mode overnight across midnight.
        </p>
      </SectionCard>

      <SectionCard title="System Integration">
        <SettingRow
          title="Follow system dark/light preference"
          description="Applies dark mode only when your OS appearance is set to dark"
          control={
            <Switch
              label="Follow system"
              checked={settings.schedule.followSystem}
              onChange={(followSystem) =>
                onChange(
                  (s) => ({
                    ...s,
                    schedule: { ...s.schedule, followSystem },
                  }),
                  followSystem
                    ? 'Following system appearance.'
                    : 'Not following system.',
                )
              }
            />
          }
        />
        <div className="field">
          <label htmlFor="automation-theme-select" className="field-label">
            Theme when following system
          </label>
          <select
            id="automation-theme-select"
            value={settings.theme}
            onChange={(e) =>
              onChange(
                (s) => ({ ...s, theme: e.target.value as ThemeId }),
                `Theme set to ${THEME_LABELS[e.target.value] ?? e.target.value}.`,
              )
            }
          >
            <option value="system">Only when system is dark (recommended)</option>
            {Object.entries(PREMIUM_THEME_META).map(([id, m]) => (
              <option key={id} value={id}>
                {m.label}
              </option>
            ))}
          </select>
          <p className="field-hint">
            When Follow System is enabled, NightLens stays dormant during daytime OS light
            mode.
          </p>
        </div>
      </SectionCard>

      <SectionCard
        title="Per-Website Memory"
        description="NightLens remembers each domain’s exclusion, force-on rule, and theme automatically on future visits."
      >
        <div className="row-start" style={{ flexWrap: 'wrap', gap: 8 }}>
          <span className="badge badge-active">
            <span className="badge-dot" aria-hidden="true" />
            {Object.keys(settings.siteRules).length} saved rules
          </span>
          <span className="badge badge-idle">Instant domain recall</span>
        </div>
      </SectionCard>
    </>
  );
}

export function PerformanceTab({ settings, onChange }: BaseSystemTabProps) {
  return (
    <>
      <div className="page-header">
        <h1>Performance</h1>
        <p className="page-lead">
          NightLens uses time-sliced DOM batching and color caching to stay fast on complex
          single-page applications.
        </p>
      </div>

      <SectionCard
        icon={<IconZap size={15} />}
        title="Engine Settings"
        spacing="stack-lg"
      >
        <SettingRow
          title="Cached color parsing"
          description="Memoizes computed color transformations across repeated DOM styles"
          control={
            <Switch
              label="Cache"
              checked={settings.performance.enableCache}
              onChange={(v) =>
                onChange(
                  (s) => ({
                    ...s,
                    performance: { ...s.performance, enableCache: v },
                  }),
                  v ? 'Cache enabled.' : 'Cache disabled.',
                )
              }
            />
          }
        />

        <Slider
          id="perf-elements-per-frame"
          label="Elements per frame"
          value={settings.performance.maxElementsPerFrame}
          limit={{ min: 100, max: 1000, step: 50 }}
          unit=""
          hint="Higher values finish initial theming faster; default 400 keeps frames responsive."
          onCommit={(maxElementsPerFrame) =>
            onChange(
              (s) => ({
                ...s,
                performance: { ...s.performance, maxElementsPerFrame },
              }),
              `Max elements set to ${maxElementsPerFrame}.`,
            )
          }
        />

        <Slider
          id="perf-debounce-ms"
          label="Debounce"
          value={settings.performance.debounceMs}
          limit={{ min: 50, max: 500, step: 25 }}
          unit="ms"
          hint="Coalesces rapid DOM mutations before re-evaluating changed elements."
          onCommit={(debounceMs) =>
            onChange(
              (s) => ({
                ...s,
                performance: { ...s.performance, debounceMs },
              }),
              `Debounce set to ${debounceMs}ms.`,
            )
          }
        />
      </SectionCard>

      <SectionCard icon={<IconCpu size={15} />} title="Developer Mode">
        <SettingRow
          title="Enable developer diagnostics"
          description={
            <>
              Annotates elements with <code>data-nl-dev</code> mapping metadata and console
              timing metrics
            </>
          }
          control={
            <Switch
              label="Developer mode"
              checked={settings.developerMode}
              onChange={(v) =>
                onChange(
                  (s) => ({ ...s, developerMode: v }),
                  v ? 'Developer mode on.' : 'Developer mode off.',
                )
              }
            />
          }
        />
      </SectionCard>

      <section className="card card-subtle stack">
        <span className="eyebrow">How the Engine Stays Fast</span>
        <ul className="feature-list">
          <li>
            <span className="feature-list-icon">
              <IconCheck size={14} />
            </span>
            <span>Single style recalculation per batch (strip → read → write)</span>
          </li>
          <li>
            <span className="feature-list-icon">
              <IconCheck size={14} />
            </span>
            <span>
              Set-deduplicated work queue paired with WeakSet element tracking
            </span>
          </li>
          <li>
            <span className="feature-list-icon">
              <IconCheck size={14} />
            </span>
            <span>
              Filtered MutationObserver watching only color-relevant mutations
            </span>
          </li>
          <li>
            <span className="feature-list-icon">
              <IconCheck size={14} />
            </span>
            <span>Open Shadow DOM per-root style isolation and SPA navigation hooks</span>
          </li>
        </ul>
      </section>
    </>
  );
}

export function PrivacyTab({
  settings,
  onExport,
  onImport,
  onReset,
}: {
  settings: Settings;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onReset: () => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <div className="page-header">
        <h1>Privacy &amp; Security</h1>
        <p className="page-lead">
          Zero telemetry, zero external servers, zero analytics. Every preference lives
          strictly on your device.
        </p>
      </div>

      <section className="card card-positive stack">
        <div className="card-title-group">
          <IconCheckCircle
            size={18}
            style={{ color: 'var(--success)', flexShrink: 0 }}
          />
          <h2>What NightLens Does NOT Do</h2>
        </div>
        <ul className="feature-list feature-list-positive">
          <li>
            <span className="feature-list-icon">
              <IconCheck size={14} />
            </span>
            <span>No browsing history reading or recording</span>
          </li>
          <li>
            <span className="feature-list-icon">
              <IconCheck size={14} />
            </span>
            <span>No analytics, telemetry, or crash reporting</span>
          </li>
          <li>
            <span className="feature-list-icon">
              <IconCheck size={14} />
            </span>
            <span>No outbound network requests or remote API connections</span>
          </li>
          <li>
            <span className="feature-list-icon">
              <IconCheck size={14} />
            </span>
            <span>No cloud account sync — browser profile local storage only</span>
          </li>
          <li>
            <span className="feature-list-icon">
              <IconCheck size={14} />
            </span>
            <span>No dynamic code execution or unsafe script evaluation</span>
          </li>
        </ul>
      </section>

      <SectionCard icon={<IconLock size={15} />} title="What Is Stored Locally">
        <p className="body-copy">
          Only your explicit preferences in <code>{browserCopy().storageNamespace}</code> under key{' '}
          <code>nightlens:settings</code>, automatically removed if you uninstall the
          extension:
        </p>
        <pre className="code-block">
          {`{\n  "schemaVersion": ${settings.schemaVersion},\n  "enabled": ${settings.enabled},\n  "theme": "${settings.theme}",\n  "brightness": ${settings.brightness},\n  "contrast": ${settings.contrast},\n  "siteRules": { /* ${Object.keys(settings.siteRules).length} configured hostnames */ }\n}`}
        </pre>
      </SectionCard>

      <SectionCard title="Permissions Explained">
        <div className="stack-xs">
          <div className="setting-row">
            <code>storage</code>
            <span className="card-description" style={{ textAlign: 'right' }}>
              Persist preferences locally on this device
            </span>
          </div>
          <hr className="divider" />
          <div className="setting-row">
            <code>alarms</code>
            <span className="card-description" style={{ textAlign: 'right' }}>
              Evaluate scheduled dark-mode hours once per minute
            </span>
          </div>
          <hr className="divider" />
          <div className="setting-row">
            <code>content_scripts</code>
            <span className="card-description" style={{ textAlign: 'right' }}>
              Apply dark palettes on http/https pages locally in-memory
            </span>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Backup & Restore">
        <div className="row-start" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button type="button" className="btn btn-accent" onClick={onExport}>
            <IconDownload size={14} />
            <span>Export settings</span>
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => importRef.current?.click()}
          >
            <IconUpload size={14} />
            <span>Import settings</span>
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            className="sr-only"
            tabIndex={-1}
            aria-label="Restore settings from JSON"
            onChange={onImport}
          />
        </div>
        <p className="field-hint">
          Export creates a portable JSON backup. Import sanitizes all fields and discards
          malformed keys.
        </p>
      </SectionCard>

      <div>
        {!confirmReset ? (
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => setConfirmReset(true)}
          >
            <IconReset size={14} />
            <span>Reset all settings…</span>
          </button>
        ) : (
          <div className="card row-wrap" role="group" aria-label="Confirm reset">
            <span className="body-copy">
              This restores default settings and clears all saved website rules. Continue?
            </span>
            <div className="row-start" style={{ gap: 8 }}>
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
                  onReset();
                }}
              >
                Reset everything
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export function AboutTab({ version }: { version: string }) {
  const info = getBrowserApi().info;
  return (
    <>
      <div className="card about-hero stack">
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Logo size={52} />
        </div>
        <div>
          <h1>NightLens</h1>
          <p className="card-description" style={{ marginTop: 4 }}>
            Intelligent dark mode for the modern web
          </p>
        </div>
        <div
          className="row-start"
          style={{ justifyContent: 'center', flexWrap: 'wrap', gap: 6 }}
        >
          <span className="badge badge-active">v{version}</span>
          <span className="badge badge-idle">Manifest V{info.manifestVersion ?? 3}</span>
          <span className="badge badge-off">Privacy-first</span>
          <span className="badge badge-off">{info.label}</span>
          <span className="badge badge-off">React 19 · TypeScript</span>
        </div>
      </div>

      <SectionCard title="Built for Everyday Precision" spacing="stack-lg">
        <div className="grid-2">
          <div className="stack-xs">
            <div className="heading-card">Per-Element Color Engine</div>
            <p className="card-description">
              Maps backgrounds, text, borders, and inline SVG icons while preserving WCAG
              AA contrast and protecting photos and videos.
            </p>
          </div>
          <div className="stack-xs">
            <div className="heading-card">Curated Theme System</div>
            <p className="card-description">
              10 designer palettes — including Midnight, AMOLED, Nord, and Dracula — plus
              custom palettes.
            </p>
          </div>
          <div className="stack-xs">
            <div className="heading-card">Granular Site Rules</div>
            <p className="card-description">
              Exact-hostname exclusions, force-dark overrides, per-domain themes, and
              sanitized custom CSS.
            </p>
          </div>
          <div className="stack-xs">
            <div className="heading-card">Distraction-Free Reading</div>
            <p className="card-description">
              Configurable column width, line spacing, and typography for long-form
              articles.
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Keyboard Shortcuts">
        <div className="setting-row">
          <span>Toggle NightLens globally</span>
          <kbd className="kbd">Alt+Shift+D</kbd>
        </div>
        <p className="field-hint">
          Customize shortcuts anytime at <code>{browserCopy().shortcutsLocation}</code>.
        </p>
      </SectionCard>

      <SectionCard title="Known Engine Limitations">
        <ul className="feature-list">
          <li>
            <span className="feature-list-icon">
              <IconInfo size={14} />
            </span>
            <span>
              CSS <code>:hover</code> background transitions on recolored elements are
              suppressed
            </span>
          </li>
          <li>
            <span className="feature-list-icon">
              <IconInfo size={14} />
            </span>
            <span>
              Literal CSS gradient stops are remapped; background images remain untouched to protect
              artwork
            </span>
          </li>
          <li>
            <span className="feature-list-icon">
              <IconInfo size={14} />
            </span>
            <span>
              Transparent dark raster logos may benefit from per-site exclusion
            </span>
          </li>
          <li>
            <span className="feature-list-icon">
              <IconInfo size={14} />
            </span>
            <span>Closed Shadow DOM roots cannot be inspected by extensions</span>
          </li>
        </ul>
      </SectionCard>
    </>
  );
}
