import { useState, type FormEvent } from 'react';
import { MAX_SITE_RULES } from '../../shared/defaults';
import { hostnameFromUserInput } from '../../shared/hostname';
import {
  THEME_IDS,
  type CompatibilityMode,
  type Settings,
  type ThemeId,
} from '../../shared/types';
import { EmptyState, SectionCard, THEME_LABELS } from '../../ui/components';
import { SiteOverrideEditor } from './SiteOverrideEditor';
import type { Notice } from '../../ui/hooks';
import {
  IconClose,
  IconCode,
  IconGlobe,
  IconLayers,
  IconSearch,
  IconShield,
  IconSliders,
  IconSparkles,
  IconTrash,
} from '../../ui/icons';

interface WebsitesTabProps {
  settings: Settings;
  excluded: string[];
  forced: string[];
  siteThemes: [string, ThemeId][];
  input: string;
  inputError: string;
  onInputChange: (v: string) => void;
  onAddExcluded: (e: FormEvent) => void;
  onRemoveRule: (host: string) => void;
  onChange: (updater: (s: Settings) => Settings, msg: string) => void;
  onSetNotice: (n: Notice | null) => void;
}

export function WebsitesTab({
  settings,
  excluded,
  forced,
  siteThemes,
  input,
  inputError,
  onInputChange,
  onAddExcluded,
  onRemoveRule,
  onChange,
  onSetNotice,
}: WebsitesTabProps) {
  const [searchSites, setSearchSites] = useState('');
  const [ruleHost, setRuleHost] = useState('');
  const [ruleMode, setRuleMode] = useState<'on' | 'off'>('on');
  const [ruleError, setRuleError] = useState('');
  const [themeHost, setThemeHost] = useState('');
  const [themePick, setThemePick] = useState<ThemeId>('midnight');
  const [themeError, setThemeError] = useState('');
  const [compHost, setCompHost] = useState('');
  const [compMode, setCompMode] = useState<CompatibilityMode>('gentle');
  const [compError, setCompError] = useState('');
  const [cssInput, setCssInput] = useState('');
  const [cssHost, setCssHost] = useState('');
  const [confirmResetAll, setConfirmResetAll] = useState(false);

  const query = searchSites.trim().toLowerCase();
  const filteredExcluded = excluded.filter((h) => h.includes(query));
  const filteredForced = forced.filter((h) => h.includes(query));

  const addRule = (e: FormEvent) => {
    e.preventDefault();
    const host = hostnameFromUserInput(ruleHost);
    if (!host) {
      setRuleError('Enter a website address such as example.com.');
      return;
    }
    if (
      Object.keys(settings.siteRules).length >= MAX_SITE_RULES &&
      !(host in settings.siteRules)
    ) {
      setRuleError('Too many site rules.');
      return;
    }
    setRuleError('');
    setRuleHost('');
    onChange(
      (s) => ({ ...s, siteRules: { ...s.siteRules, [host]: ruleMode } }),
      ruleMode === 'off'
        ? `${host} is now excluded.`
        : `Dark mode is forced on for ${host}.`,
    );
  };

  const assignTheme = (e: FormEvent) => {
    e.preventDefault();
    const host = hostnameFromUserInput(themeHost);
    if (!host) {
      setThemeError('Enter a website address such as example.com.');
      return;
    }
    setThemeError('');
    setThemeHost('');
    onChange(
      (s) => ({ ...s, siteThemes: { ...s.siteThemes, [host]: themePick } }),
      `${host} now uses the ${THEME_LABELS[themePick] ?? themePick} theme.`,
    );
  };

  const saveCompat = (e: FormEvent) => {
    e.preventDefault();
    const host = hostnameFromUserInput(compHost);
    if (!host) {
      setCompError('Enter a website address such as example.com.');
      return;
    }
    setCompError('');
    setCompHost('');
    onChange(
      (s) => ({ ...s, compatibility: { ...s.compatibility, [host]: compMode } }),
      `Compatibility profile "${compMode}" saved for ${host}.`,
    );
  };

  return (
    <>
      <div className="page-header">
        <h1>Website Management</h1>
        <p className="page-lead">
          Configure per-domain exclusions, forced theming, palettes, and rendering
          profiles. A rule for <code>example.com</code> also covers its subdomains;
          the closest matching hostname wins.
        </p>
      </div>

      <SectionCard
        icon={<IconGlobe size={15} />}
        title="Add Website Rule"
        spacing="stack-lg"
        description="Rules inherit to subdomains, with exact-host rules taking priority. Ports, schemes and paths are ignored."
      >
        <form className="form-inline" onSubmit={onAddExcluded} noValidate>
          <div className="field">
            <label htmlFor="exclude-input" className="field-label">
              Exclude a website
            </label>
            <input
              id="exclude-input"
              type="text"
              value={input}
              placeholder="example.com"
              aria-invalid={inputError !== ''}
              aria-describedby="exclude-error"
              onChange={(e) => onInputChange(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary">
            Add to excluded
          </button>
        </form>
        {/* Rendered only when there is something to announce: an always-present empty
            role="alert" region is noise for screen readers. */}
        {inputError ? (
          <div id="exclude-error" className="status error" role="alert">
            {inputError}
          </div>
        ) : null}

        <hr className="divider" />

        <form className="form-inline" onSubmit={addRule} noValidate>
          <div className="field">
            <label htmlFor="rule-input" className="field-label">
              Website
            </label>
            <input
              id="rule-input"
              type="text"
              value={ruleHost}
              placeholder="example.com"
              aria-invalid={ruleError !== ''}
              aria-describedby="rule-error"
              onChange={(e) => setRuleHost(e.target.value)}
            />
          </div>
          <div className="field form-field-fixed">
            <label htmlFor="rule-mode" className="field-label">
              Action
            </label>
            <select
              id="rule-mode"
              value={ruleMode}
              onChange={(e) => setRuleMode(e.target.value as 'on' | 'off')}
            >
              <option value="on">Force dark on</option>
              <option value="off">Exclude</option>
            </select>
          </div>
          <button type="submit" className="btn">
            Apply rule
          </button>
        </form>
        {/* Rendered only when there is something to announce: an always-present empty
            role="alert" region is noise for screen readers. */}
        {ruleError ? (
          <div id="rule-error" className="status error" role="alert">
            {ruleError}
          </div>
        ) : null}

        <hr className="divider" />

        <form className="form-inline" onSubmit={assignTheme} noValidate>
          <div className="field">
            <label htmlFor="theme-host" className="field-label">
              Assign theme to website
            </label>
            <input
              id="theme-host"
              type="text"
              value={themeHost}
              placeholder="example.com"
              aria-invalid={themeError !== ''}
              aria-describedby="theme-error"
              onChange={(e) => setThemeHost(e.target.value)}
            />
          </div>
          <div className="field form-field-fixed">
            <label htmlFor="theme-pick" className="field-label">
              Theme
            </label>
            <select
              id="theme-pick"
              value={themePick}
              onChange={(e) => setThemePick(e.target.value as ThemeId)}
            >
              {THEME_IDS.map((t) => (
                <option key={t} value={t}>
                  {THEME_LABELS[t] ?? t}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-accent">
            Assign
          </button>
        </form>
        {/* Rendered only when there is something to announce: an always-present empty
            role="alert" region is noise for screen readers. */}
        {themeError ? (
          <div id="theme-error" className="status error" role="alert">
            {themeError}
          </div>
        ) : null}

        {siteThemes.length > 0 && (
          <ul className="sites" aria-label="Per-site themes">
            {siteThemes.map(([host, theme]) => (
              <li key={host}>
                <span>
                  <strong>{host}</strong>{' '}
                  <span className="muted">→ {THEME_LABELS[theme] ?? theme}</span>
                </span>
                <button
                  type="button"
                  className="btn btn-sm"
                  aria-label={`Remove theme for ${host}`}
                  onClick={() =>
                    onChange(
                      (s) => {
                        const r = { ...s.siteThemes };
                        delete r[host];
                        return { ...s, siteThemes: r };
                      },
                      `Removed per-site theme for ${host}.`,
                    )
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <hr className="divider" />

        <div className="field">
          <label htmlFor="search-sites-input" className="field-label">
            Search sites
          </label>
          <div className="input-icon-wrap">
            <span className="input-icon-leading">
              <IconSearch size={14} />
            </span>
            <input
              id="search-sites-input"
              type="text"
              value={searchSites}
              placeholder="Filter excluded or forced hostnames…"
              onChange={(e) => setSearchSites(e.target.value)}
            />
            {searchSites && (
              <button
                type="button"
                className="input-clear-btn"
                aria-label="Clear site search"
                onClick={() => setSearchSites('')}
              >
                <IconClose size={13} />
              </button>
            )}
          </div>
        </div>

        <div className="stack">
          <div className="row-start">
            <h3>Excluded sites</h3>
            <span className="badge badge-off">{excluded.length}</span>
          </div>
          {filteredExcluded.length === 0 ? (
            <EmptyState
              icon={<IconShield size={14} />}
              title={excluded.length === 0 ? 'No excluded sites' : 'No matching excluded sites'}
              description={
                excluded.length === 0
                  ? 'Use the toolbar popup or the form above to exclude a website.'
                  : 'Try a different search term.'
              }
            />
          ) : (
            <ul className="sites" aria-label="Excluded sites">
              {filteredExcluded.map((h) => (
                <li key={h}>
                  <span>{h}</span>
                  <button
                    type="button"
                    className="btn btn-sm"
                    aria-label={`Remove ${h}`}
                    onClick={() => onRemoveRule(h)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="stack">
          <div className="row-start">
            <h3>Forced on</h3>
            <span className="badge badge-active">{forced.length}</span>
          </div>
          {filteredForced.length === 0 ? (
            <EmptyState
              icon={<IconSparkles size={14} />}
              title={forced.length === 0 ? 'No forced sites' : 'No matching forced sites'}
              description={
                forced.length === 0
                  ? 'Sites that already look dark are left alone unless forced on.'
                  : 'Try a different search term.'
              }
            />
          ) : (
            <ul className="sites" aria-label="Forced sites">
              {filteredForced.map((h) => (
                <li key={h}>
                  <span>{h}</span>
                  <button
                    type="button"
                    className="btn btn-sm"
                    aria-label={`Remove ${h}`}
                    onClick={() => onRemoveRule(h)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SectionCard>

      <SectionCard
        icon={<IconLayers size={15} />}
        title="Compatibility Profiles"
        description="Tune engine aggressiveness for complex web apps. Gentle avoids restyling dark surfaces; Aggressive themes more eagerly; Media-only dims bright media without recoloring surfaces."
      >
        <form className="form-inline" onSubmit={saveCompat} noValidate>
          <div className="field">
            <label htmlFor="comp-host" className="field-label">
              Website for profile
            </label>
            <input
              id="comp-host"
              type="text"
              value={compHost}
              placeholder="example.com"
              aria-invalid={compError !== ''}
              aria-describedby="comp-error"
              onChange={(e) => setCompHost(e.target.value)}
            />
          </div>
          <div className="field form-field-fixed">
            <label htmlFor="comp-mode" className="field-label">
              Profile
            </label>
            <select
              id="comp-mode"
              value={compMode}
              onChange={(e) => setCompMode(e.target.value as CompatibilityMode)}
            >
              <option value="auto">Auto</option>
              <option value="gentle">Gentle</option>
              <option value="aggressive">Aggressive</option>
              <option value="mediaOnly">Media only</option>
            </select>
          </div>
          <button type="submit" className="btn btn-accent">
            Save profile
          </button>
        </form>
        {/* Rendered only when there is something to announce: an always-present empty
            role="alert" region is noise for screen readers. */}
        {compError ? (
          <div id="comp-error" className="status error" role="alert">
            {compError}
          </div>
        ) : null}
        {Object.keys(settings.compatibility).length === 0 ? (
          <div className="empty-state">
            <IconLayers size={14} />
            <span>No custom profiles. All sites use automatic handling.</span>
          </div>
        ) : (
          <ul className="sites">
            {Object.entries(settings.compatibility).map(([host, mode]) => (
              <li key={host}>
                <span>
                  <strong>{host}</strong> <span className="muted">→ {mode}</span>
                </span>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() =>
                    onChange(
                      (s) => {
                        const c = { ...s.compatibility };
                        delete c[host];
                        return { ...s, compatibility: c };
                      },
                      `Reset compatibility for ${host}.`,
                    )
                  }
                >
                  Reset
                </button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        icon={<IconCode size={15} />}
        title="Custom CSS per Website"
        description={
          <>
            Inject sanitized domain-specific CSS after NightLens theming. Remote{' '}
            <code>url()</code>, <code>@import</code>, and <code>javascript:</code> are
            blocked automatically to protect privacy.
          </>
        }
      >
        <div className="field">
          <label htmlFor="css-host-input" className="field-label">
            Hostname
          </label>
          <input
            id="css-host-input"
            type="text"
            value={cssHost}
            placeholder="example.com"
            onChange={(e) => setCssHost(e.target.value)}
          />
        </div>
        <div className="field">
          <div className="row">
            <label htmlFor="css-body-input" className="field-label">
              CSS rules
            </label>
            <span className="field-hint tabular">
              {cssInput.length.toLocaleString()} / 20,000
            </span>
          </div>
          <textarea
            id="css-body-input"
            value={cssInput}
            placeholder="body { letter-spacing: 0.01em; }"
            rows={4}
            onChange={(e) => setCssInput(e.target.value)}
            maxLength={20000}
          />
        </div>
        <div>
          <button
            type="button"
            className="btn btn-accent"
            disabled={!cssHost.trim() || !cssInput.trim()}
            onClick={() => {
              const host = hostnameFromUserInput(cssHost);
              if (!host) {
                onSetNotice({ kind: 'error', text: 'Invalid hostname.' });
                return;
              }
              onChange(
                (s) => ({
                  ...s,
                  customCSS: { ...s.customCSS, [host]: cssInput },
                }),
                `Custom CSS saved for ${host}.`,
              );
              setCssHost('');
              setCssInput('');
            }}
          >
            Save CSS
          </button>
        </div>
        {Object.keys(settings.customCSS).length > 0 && (
          <ul className="sites">
            {Object.entries(settings.customCSS).map(([host, css]) => (
              <li
                key={host}
                style={{ flexDirection: 'column', alignItems: 'stretch' }}
              >
                <div className="row">
                  <strong>{host}</strong>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() =>
                      onChange(
                        (s) => {
                          const c = { ...s.customCSS };
                          delete c[host];
                          return { ...s, customCSS: c };
                        },
                        `Removed CSS for ${host}.`,
                      )
                    }
                  >
                    <IconTrash size={12} />
                    <span>Remove</span>
                  </button>
                </div>
                <pre className="code-block" style={{ marginTop: 6 }}>
                  {css.slice(0, 200)}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SiteOverrideEditor settings={settings} onChange={onChange} onSetNotice={onSetNotice} />

      <SectionCard
        title="Saved Overrides"
        description="Overrides currently stored. Clearing one falls back to your global appearance settings."
      >
        {Object.keys(settings.siteOverrides).length === 0 ? (
          <EmptyState
            icon={<IconSliders size={14} />}
            title="No domain overrides configured"
            description="Use the form above to give one website its own theme or calibration."
          />
        ) : (
          <ul className="sites">
            {Object.entries(settings.siteOverrides).map(([host, ov]) => (
              <li key={host}>
                <span className="tabular">
                  <strong>{host}</strong>{' '}
                  <span className="muted">
                    → B:{ov.brightness ?? '–'} C:{ov.contrast ?? '–'} W:
                    {ov.warmth ?? '–'}
                  </span>
                </span>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() =>
                    onChange(
                      (s) => {
                        const o = { ...s.siteOverrides };
                        delete o[host];
                        return { ...s, siteOverrides: o };
                      },
                      `Removed override for ${host}.`,
                    )
                  }
                >
                  Clear
                </button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Reset Website Preferences"
        description="Remove all site rules, theme assignments, visual overrides, compatibility profiles, and custom CSS. Global appearance settings are kept."
      >
        {!confirmResetAll ? (
          <button type="button" className="btn btn-danger" onClick={() => setConfirmResetAll(true)}>
            Reset website preferences…
          </button>
        ) : (
          <div className="row-start" role="group" aria-label="Confirm website preference reset">
            <button type="button" className="btn" onClick={() => setConfirmResetAll(false)}>Cancel</button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                setConfirmResetAll(false);
                onChange(
                  (s) => ({ ...s, siteRules: {}, siteThemes: {}, siteOverrides: {}, compatibility: {}, customCSS: {} }),
                  'All website preferences were reset.',
                );
              }}
            >
              Reset websites
            </button>
          </div>
        )}
      </SectionCard>
    </>
  );
}
