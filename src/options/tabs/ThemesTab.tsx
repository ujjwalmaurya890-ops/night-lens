import { useRef, useState } from 'react';
import { exportTheme, importTheme } from '../../shared/storage';
import type { CustomTheme, Settings, ThemeId } from '../../shared/types';
import { SectionCard, ThemeGrid, THEME_LABELS } from '../../ui/components';
import { PURPOSE_PRESETS, applyPurposePreset, matchPurposePreset } from '../../shared/presets';
import { ThemePreview } from '../../ui/ThemePreview';
import type { Notice } from '../../ui/hooks';
import {
  IconChevronRight,
  IconPalette,
  IconPlus,
  IconSparkles,
  IconUpload,
} from '../../ui/icons';

interface ThemesTabProps {
  settings: Settings;
  siteThemes: [string, ThemeId][];
  onChange: (updater: (s: Settings) => Settings, msg: string) => void;
  onSetNotice: (n: Notice | null) => void;
  onNavigateSites: () => void;
}

export function ThemesTab({
  settings,
  siteThemes,
  onChange,
  onSetNotice,
  onNavigateSites,
}: ThemesTabProps) {
  const [customName, setCustomName] = useState('');
  const [customBg, setCustomBg] = useState('#14171d');
  const [customText, setCustomText] = useState('#e8eaf0');
  const [customAccent, setCustomAccent] = useState('#7ab7ff');
  const themeImportRef = useRef<HTMLInputElement>(null);

  const createCustomTheme = () => {
    if (!customName.trim()) {
      onSetNotice({ kind: 'error', text: 'Enter a theme name.' });
      return;
    }
    if (settings.customThemes.length >= 50) {
      onSetNotice({ kind: 'error', text: 'Too many custom themes.' });
      return;
    }
    const ct: CustomTheme = {
      id: `custom-${Date.now()}`,
      name: customName.trim(),
      bg: customBg,
      bgRaised: customBg,
      text: customText,
      textMuted: customText,
      accent: customAccent,
      link: customAccent,
      border: '#2a2d33',
      createdAt: Date.now(),
    };
    onChange(
      (s) => ({
        ...s,
        customThemes: [...s.customThemes, ct],
        theme: 'custom',
        activeCustomThemeId: ct.id,
      }),
      `Custom theme "${ct.name}" created.`,
    );
    setCustomName('');
  };

  const deleteCustomTheme = (id: string) => {
    onChange((s) => {
      const themes = s.customThemes.filter((t) => t.id !== id);
      const activeId = s.activeCustomThemeId === id ? null : s.activeCustomThemeId;
      const nextTheme: ThemeId = activeId
        ? s.theme
        : themes.length > 0
          ? 'custom'
          : 'balanced';
      return {
        ...s,
        customThemes: themes,
        activeCustomThemeId: activeId,
        theme: nextTheme,
      };
    }, 'Custom theme deleted.');
  };

  const handleExportTheme = (ct: CustomTheme) => {
    const json = exportTheme(ct);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nightlens-theme-${ct.name.replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportTheme = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = importTheme(reader.result as string);
      if (!result.ok) {
        onSetNotice({ kind: 'error', text: `Theme import failed: ${result.error}` });
        return;
      }
      const ct = {
        ...result.theme,
        id: `custom-${Date.now()}`,
        name: result.theme.name,
      };
      onChange(
        (s) => ({ ...s, customThemes: [...s.customThemes, ct] }),
        `Theme "${ct.name}" imported.`,
      );
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <>
      <div className="page-header">
        <h1>Themes</h1>
        <p className="page-lead">
          Choose from 10 curated dark palettes, classic presets, or craft your own custom
          palette. Themes switch live and can be assigned per domain.
        </p>
      </div>

      <SectionCard
        icon={<IconSparkles size={15} />}
        title="Purpose Presets"
        description="A palette plus the luminance and contrast calibration that suits a specific reading situation. Applied in one step and remembered across restarts."
      >
        <div className="preset-row" role="group" aria-label="Purpose presets">
          {PURPOSE_PRESETS.map((preset) => {
            const active = matchPurposePreset(settings) === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                className={`preset-chip ${active ? 'active' : ''}`}
                aria-pressed={active}
                aria-describedby={`purpose-${preset.id}-desc`}
                onClick={() => onChange((s) => applyPurposePreset(s, preset.id), `${preset.label} applied.`)}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        <ul className="purpose-preset-notes">
          {PURPOSE_PRESETS.map((preset) => (
            <li key={preset.id} id={`purpose-${preset.id}-desc`} className="field-hint">
              <strong>{preset.label}</strong> — {preset.purpose}
            </li>
          ))}
        </ul>
        <ThemePreview settings={settings} />
      </SectionCard>

      <SectionCard
        icon={<IconPalette size={15} />}
        title="Select Theme"
        spacing="stack-lg"
      >
        <ThemeGrid
          value={settings.theme}
          onChange={(theme) =>
            onChange(
              (s) => ({ ...s, theme }),
              `Theme set to ${THEME_LABELS[theme] ?? theme}.`,
            )
          }
        />
      </SectionCard>

      {settings.customThemes.length > 0 && (
        <SectionCard title={`Custom Themes (${settings.customThemes.length})`}>
          <div className="stack">
            {settings.customThemes.map((ct) => {
              const isCurrent =
                settings.theme === 'custom' && settings.activeCustomThemeId === ct.id;
              return (
                <div
                  key={ct.id}
                  className="row-wrap"
                  style={{
                    background: 'var(--surface-2)',
                    border: `1px solid ${isCurrent ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 12px',
                  }}
                >
                  <div className="row-start">
                    <div className="row-start" style={{ gap: 4 }}>
                      <span className="color-swatch" style={{ background: ct.bg }} />
                      <span className="color-swatch" style={{ background: ct.text }} />
                      <span className="color-swatch" style={{ background: ct.accent }} />
                    </div>
                    <div>
                      <div className="heading-card">{ct.name}</div>
                      <div className="card-description tabular">
                        {ct.bg} · {ct.text} · {ct.accent}
                      </div>
                    </div>
                  </div>
                  <div className="row-start" style={{ gap: 6 }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${isCurrent ? 'btn-accent' : ''}`}
                      onClick={() =>
                        onChange(
                          (s) => ({
                            ...s,
                            theme: 'custom',
                            activeCustomThemeId: ct.id,
                          }),
                          `Switched to ${ct.name}.`,
                        )
                      }
                    >
                      {isCurrent ? 'Active' : 'Use'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => handleExportTheme(ct)}
                    >
                      Export
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => deleteCustomTheme(ct.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      <SectionCard
        icon={<IconSparkles size={15} />}
        title="Create Custom Theme"
        spacing="stack-lg"
      >
        <div className="stack">
          <div className="field">
            <label htmlFor="ct-name" className="field-label">
              Theme name
            </label>
            <input
              id="ct-name"
              type="text"
              value={customName}
              placeholder="My Midnight Blue"
              onChange={(e) => setCustomName(e.target.value)}
              maxLength={50}
            />
          </div>

          <div className="grid-3">
            <div className="field">
              <label htmlFor="ct-bg-hex" className="field-label">
                Background
              </label>
              <div className="row-start" style={{ gap: 8 }}>
                <input
                  type="color"
                  aria-label="Background color picker"
                  value={customBg}
                  onChange={(e) => setCustomBg(e.target.value)}
                  className="color-input"
                />
                <input
                  id="ct-bg-hex"
                  type="text"
                  value={customBg}
                  onChange={(e) => setCustomBg(e.target.value)}
                  placeholder="#14171d"
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="ct-text-hex" className="field-label">
                Text
              </label>
              <div className="row-start" style={{ gap: 8 }}>
                <input
                  type="color"
                  aria-label="Text color picker"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  className="color-input"
                />
                <input
                  id="ct-text-hex"
                  type="text"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="#e8eaf0"
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="ct-accent-hex" className="field-label">
                Accent
              </label>
              <div className="row-start" style={{ gap: 8 }}>
                <input
                  type="color"
                  aria-label="Accent color picker"
                  value={customAccent}
                  onChange={(e) => setCustomAccent(e.target.value)}
                  className="color-input"
                />
                <input
                  id="ct-accent-hex"
                  type="text"
                  value={customAccent}
                  onChange={(e) => setCustomAccent(e.target.value)}
                  placeholder="#7ab7ff"
                />
              </div>
            </div>
          </div>

          <div
            className="custom-theme-preview"
            style={{ background: customBg, color: customText }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-base)' }}>
                {customName.trim() || 'Sample Article Heading'}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', opacity: 0.85, marginTop: 2 }}>
                Preview body text with an{' '}
                <span
                  style={{
                    color: customAccent,
                    textDecoration: 'underline',
                    fontWeight: 500,
                  }}
                >
                  interactive link
                </span>
                .
              </div>
            </div>
            <span
              className="custom-theme-pill"
              style={{ background: customAccent, color: '#08121f' }}
            >
              Accent
            </span>
          </div>

          <div className="row-wrap">
            <button
              type="button"
              className="btn btn-accent"
              onClick={createCustomTheme}
              disabled={!customName.trim()}
            >
              <IconPlus size={14} />
              <span>Create Theme</span>
            </button>

            <div className="row-start">
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => themeImportRef.current?.click()}
              >
                <IconUpload size={13} />
                <span>Import theme JSON</span>
              </button>
              <input
                ref={themeImportRef}
                type="file"
                accept=".json"
                className="sr-only"
                tabIndex={-1}
                aria-label="Import custom theme JSON"
                onChange={handleImportTheme}
              />
              <span className="field-hint">
                Supports portable NightLens theme files
              </span>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Per-Website Themes"
        action={
          <button type="button" className="link" onClick={onNavigateSites}>
            <span>Manage in Websites</span>
            <IconChevronRight size={13} />
          </button>
        }
        description="Assign distinct palettes to individual domains (for example, AMOLED on documentation and Soft Dark on news sites)."
      >
        {siteThemes.length === 0 ? (
          <div className="empty-state">
            <IconPalette size={15} />
            <span>No per-site themes configured yet. Assign them in the Websites tab.</span>
          </div>
        ) : (
          <ul className="sites">
            {siteThemes.map(([host, theme]) => (
              <li key={host}>
                <span>
                  <strong>{host}</strong>{' '}
                  <span className="muted">→ {THEME_LABELS[theme] ?? theme}</span>
                </span>
                <button
                  type="button"
                  className="btn btn-sm"
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
      </SectionCard>
    </>
  );
}
