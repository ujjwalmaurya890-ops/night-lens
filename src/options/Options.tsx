import { useState, type FormEvent } from 'react';
import { MAX_SITE_RULES } from '../shared/defaults';
import { hostnameFromUserInput } from '../shared/hostname';
import { exportSettings, validateImport, exportTheme, importTheme } from '../shared/storage';
import { AppearanceControls, Logo, PresetChips, StatusLine, Switch, ThemeGrid, THEME_LABELS } from '../ui/components';
import { useSettings } from '../ui/hooks';
import { PREMIUM_THEME_META } from '../engine/palette';
import { THEME_IDS, type CustomTheme, type CompatibilityMode, type ThemeId } from '../shared/types';

type Tab = 'overview' | 'appearance' | 'themes' | 'sites' | 'accessibility' | 'automation' | 'performance' | 'privacy' | 'about';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '◇' },
  { id: 'appearance', label: 'Appearance', icon: '◐' },
  { id: 'themes', label: 'Themes', icon: '◈' },
  { id: 'sites', label: 'Websites', icon: '⬡' },
  { id: 'accessibility', label: 'Accessibility', icon: '♿' },
  { id: 'automation', label: 'Automation', icon: '⏰' },
  { id: 'performance', label: 'Performance', icon: '⚡' },
  { id: 'privacy', label: 'Privacy', icon: '🔒' },
  { id: 'about', label: 'About', icon: 'ℹ' },
];

export function Options() {
  const { settings, notice, change, reset, setNotice } = useSettings();
  const [tab, setTab] = useState<Tab>('overview');
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customBg, setCustomBg] = useState('#14171d');
  const [customText, setCustomText] = useState('#e8eaf0');
  const [customAccent, setCustomAccent] = useState('#7ab7ff');
  const [cssInput, setCssInput] = useState('');
  const [cssHost, setCssHost] = useState('');
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

  const excluded = Object.entries(settings.siteRules).filter(([, m]) => m === 'off').map(([h]) => h).sort();
  const forced = Object.entries(settings.siteRules).filter(([, m]) => m === 'on').map(([h]) => h).sort();
  const siteThemes = Object.entries(settings.siteThemes).sort(([a], [b]) => a.localeCompare(b));
  const filteredExcluded = excluded.filter((h) => h.includes(searchSites.toLowerCase()));

  const addExcluded = (e: FormEvent) => {
    e.preventDefault();
    const host = hostnameFromUserInput(input);
    if (!host) { setInputError('Enter a website address such as example.com.'); return; }
    if (Object.keys(settings.siteRules).length >= MAX_SITE_RULES && !(host in settings.siteRules)) { setInputError('Too many site rules.'); return; }
    setInputError('');
    setInput('');
    void change((s) => ({ ...s, siteRules: { ...s.siteRules, [host]: 'off' } }), `${host} is now excluded.`);
  };
  const removeRule = (host: string) => void change((s) => { const r = { ...s.siteRules }; delete r[host]; return { ...s, siteRules: r }; }, `${host} removed.`);

  const addRule = (e: FormEvent) => {
    e.preventDefault();
    const host = hostnameFromUserInput(ruleHost);
    if (!host) { setRuleError('Enter a website address such as example.com.'); return; }
    if (Object.keys(settings.siteRules).length >= MAX_SITE_RULES && !(host in settings.siteRules)) { setRuleError('Too many site rules.'); return; }
    setRuleError('');
    setRuleHost('');
    void change((s) => ({ ...s, siteRules: { ...s.siteRules, [host]: ruleMode } }), ruleMode === 'off' ? `${host} is now excluded.` : `Dark mode is forced on for ${host}.`);
  };

  const assignTheme = (e: FormEvent) => {
    e.preventDefault();
    const host = hostnameFromUserInput(themeHost);
    if (!host) { setThemeError('Enter a website address such as example.com.'); return; }
    setThemeError('');
    setThemeHost('');
    void change((s) => ({ ...s, siteThemes: { ...s.siteThemes, [host]: themePick } }), `${host} now uses the ${THEME_LABELS[themePick] ?? themePick} theme.`);
  };

  const saveCompat = (e: FormEvent) => {
    e.preventDefault();
    const host = hostnameFromUserInput(compHost);
    if (!host) { setCompError('Enter a website address such as example.com.'); return; }
    setCompError('');
    setCompHost('');
    void change((s) => ({ ...s, compatibility: { ...s.compatibility, [host]: compMode } }), `Compatibility profile "${compMode}" saved for ${host}.`);
  };

  const createCustomTheme = () => {
    if (!customName.trim()) { setNotice({ kind: 'error', text: 'Enter a theme name.' }); return; }
    if (settings.customThemes.length >= 50) { setNotice({ kind: 'error', text: 'Too many custom themes.' }); return; }
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
    void change((s) => ({ ...s, customThemes: [...s.customThemes, ct], theme: 'custom' as any, activeCustomThemeId: ct.id }), `Custom theme "${ct.name}" created.`);
    setCustomName('');
  };

  const deleteCustomTheme = (id: string) => {
    void change((s) => {
      const themes = s.customThemes.filter((t) => t.id !== id);
      const activeId = s.activeCustomThemeId === id ? null : s.activeCustomThemeId;
      const theme = activeId ? s.theme : (themes.length > 0 ? 'custom' as any : 'balanced' as any);
      return { ...s, customThemes: themes, activeCustomThemeId: activeId, theme: activeId ? theme : (themes.length ? theme : 'balanced') };
    }, 'Custom theme deleted.');
  };

  const handleExport = () => {
    const json = exportSettings(settings);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `nightlens-settings-${new Date().toISOString().slice(0,10)}.json`; a.click();
    URL.revokeObjectURL(url);
    setNotice({ kind: 'ok', text: 'Settings exported.' });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = validateImport(reader.result as string);
      if (!result.ok) { setNotice({ kind: 'error', text: `Import failed: ${result.error}` }); return; }
      void change(() => result.settings, 'Settings imported.');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportTheme = (ct: CustomTheme) => {
    const json = exportTheme(ct);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `nightlens-theme-${ct.name.replace(/\s+/g,'-')}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportTheme = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = importTheme(reader.result as string);
      if (!result.ok) { setNotice({ kind: 'error', text: `Theme import failed: ${result.error}` }); return; }
      const ct = { ...result.theme, id: `custom-${Date.now()}`, name: result.theme.name };
      void change((s) => ({ ...s, customThemes: [...s.customThemes, ct] }), `Theme "${ct.name}" imported.`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="dashboard">
      {/* Top bar */}
      <header style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(10,10,14,0.85)', backdropFilter: 'blur(12px) saturate(1.2)', borderBottom: '1px solid var(--border)', padding: '12px 20px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Logo size={32} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 }}>NightLens</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Premium Dark Mode · v{chrome.runtime.getManifest?.()?.version ?? '0.1.0'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: settings.enabled ? 'var(--success)' : 'var(--text-muted)', background: settings.enabled ? 'var(--success-soft)' : 'var(--surface)', border: `1px solid ${settings.enabled ? 'rgba(52,211,153,0.2)' : 'var(--border)'}`, padding: '6px 10px', borderRadius: 999 }}>
              <span>{settings.enabled ? '●' : '○'}</span> {settings.enabled ? 'Enabled' : 'Disabled'}
            </div>
            <Switch label="Dark mode (all sites)" checked={settings.enabled} onChange={(enabled) => void change((s) => ({ ...s, enabled }), enabled ? 'Dark mode on.' : 'Dark mode off.')} />
          </div>
        </div>
      </header>

      <div style={{ display: 'flex', maxWidth: 1200, margin: '0 auto', width: '100%', flex: 1 }}>
        {/* Sidebar */}
        <nav className="sidebar" style={{ position: 'sticky', top: 57, height: 'calc(100vh - 57px)', overflowY: 'auto' }}>
          <div className="sidebar-section">Settings</div>
          {TABS.map((t) => (
            <button key={t.id} type="button" className={`sidebar-item ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              <span style={{ fontSize: 13 }}>{t.icon}</span> {t.label}
            </button>
          ))}
          <div className="divider" style={{ margin: '12px 0' }} />
          <div className="sidebar-section">Actions</div>
          <button type="button" className="sidebar-item" onClick={handleExport}><span>⬇</span> Export settings</button>
          <label className="sidebar-item" style={{ cursor: 'pointer' }}>
            <span>⬆</span> Import settings
            <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
          </label>
        </nav>

        {/* Main */}
        <main style={{ flex: 1, minWidth: 0, padding: 24, maxWidth: 760 }}>
          {tab === 'overview' && (
            <div className="stack-xl animate-in">
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 700 }}>Welcome to NightLens</h1>
                <p className="muted" style={{ marginTop: 6, lineHeight: 1.6 }}>Premium intelligent dark mode that respects every website’s design. Crafted for comfort, readability, and privacy.</p>
              </div>

              <div className="grid-2">
                <div className="card">
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Active Theme</div>
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: PREMIUM_THEME_META[settings.theme]?.preview.bg ?? '#14171d', border: '1px solid var(--border)' }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{PREMIUM_THEME_META[settings.theme]?.label ?? settings.theme}</div>
                      <div className="muted" style={{ fontSize: 11 }}>{PREMIUM_THEME_META[settings.theme]?.description ?? 'Custom configuration'}</div>
                    </div>
                  </div>
                </div>
                <div className="card">
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Quick Stats</div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 16 }}>
                    <div><div style={{ fontSize: 20, fontWeight: 700 }}>{excluded.length + forced.length}</div><div className="muted" style={{ fontSize: 11 }}>Site rules</div></div>
                    <div><div style={{ fontSize: 20, fontWeight: 700 }}>{settings.customThemes.length}</div><div className="muted" style={{ fontSize: 11 }}>Custom themes</div></div>
                    <div><div style={{ fontSize: 20, fontWeight: 700 }}>{Object.keys(settings.customCSS).length}</div><div className="muted" style={{ fontSize: 11 }}>Custom CSS</div></div>
                  </div>
                </div>
              </div>

              <section className="card stack">
                <h2>Appearance at a glance</h2>
                <AppearanceControls settings={settings} onChange={(u, m) => void change(u, m)} showSepia />
                <PresetChips onSelect={(p) => void change((s) => ({ ...s, brightness: p.brightness, contrast: p.contrast, warmth: p.warmth, sepia: p.warmth }) as any, `Preset applied`)} />
                <p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.6 }}>Text contrast never drops below WCAG AA (4.5:1; 7:1 in High contrast) where achievable. Adjustments are live across all tabs.</p>
              </section>

              <section className="card stack">
                <h2>Current Behavior</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                  <div className="row"><span className="muted">Global dark mode</span><span className={`badge ${settings.enabled ? 'badge-active' : 'badge-off'}`}>{settings.enabled ? 'On' : 'Off'}</span></div>
                  <div className="row"><span className="muted">Theme</span><span>{PREMIUM_THEME_META[settings.theme]?.label ?? settings.theme}</span></div>
                  <div className="row"><span className="muted">Schedule</span><span className={`badge ${settings.schedule.enabled ? 'badge-warn' : 'badge-off'}`}>{settings.schedule.enabled ? `${settings.schedule.start}–${settings.schedule.end}` : 'Off'}</span></div>
                  <div className="row"><span className="muted">Reading mode</span><span className={`badge ${settings.readingMode.enabled ? 'badge-active' : 'badge-off'}`}>{settings.readingMode.enabled ? 'On' : 'Off'}</span></div>
                </div>
              </section>

              {/* Legacy-compatible site management mini-section for tests */}
              <section className="card stack" aria-label="Legacy site management">
                <h2>Sites</h2>
                <p className="muted" style={{ margin: 0, fontSize: 12 }}>Rules match the exact hostname. <code>example.com</code> does not cover <code>www.example.com</code> or <code>docs.example.com</code>; add each one you want. Ports, schemes and paths are ignored.</p>
                <form className="row" onSubmit={addExcluded} noValidate style={{ alignItems: 'flex-end' }}>
                  <div className="field" style={{ flex: 1 }}>
                    <label htmlFor="exclude-input-overview" className="field-label">Exclude a website</label>
                    <input id="exclude-input-overview" type="text" value={input} placeholder="example.com" aria-describedby="exclude-error-overview" onChange={(e) => setInput(e.target.value)} />
                  </div>
                  <button type="submit" className="btn btn-primary">Add</button>
                </form>
                <div id="exclude-error-overview" className="status error" role="alert">{inputError}</div>
                {excluded.length > 0 && (
                  <ul className="sites" aria-label="Excluded sites">
                    {excluded.map((h) => <li key={h}><span>{h}</span><button type="button" className="btn btn-sm" aria-label={`Remove ${h} from excluded sites`} onClick={() => removeRule(h)}>Remove</button></li>)}
                  </ul>
                )}
                <p className="muted" style={{ margin: 0, fontSize: 11 }}>NightLens stores only these settings, in this browser’s local extension storage: on/off, theme, brightness, contrast, warmth, and the hostnames you excluded or forced on. It does not read or record your browsing history, send anything to a server, or use analytics.</p>
              </section>
            </div>
          )}

          {tab === 'appearance' && (
            <div className="stack-xl animate-in">
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 700 }}>Appearance</h1>
                <p className="muted" style={{ marginTop: 4 }}>Fine-tune how NightLens transforms every website. Changes apply instantly.</p>
              </div>

              <section className="card stack">
                <h2>Brightness & Contrast</h2>
                <AppearanceControls settings={settings} onChange={(u, m) => void change(u, m)} showSepia />
              </section>

              <section className="card stack">
                <h2>Typography</h2>
                <div className="stack">
                  <div className="field">
                    <label className="field-label">Font preference</label>
                    <select value={settings.fontFamily} onChange={(e) => void change((s) => ({ ...s, fontFamily: e.target.value }), `Font set to ${e.target.value}`)}>
                      <option value="system">System default</option>
                      <option value="inter">Inter (clean sans)</option>
                      <option value="sf">SF Pro (Apple)</option>
                      <option value="serif">Serif (reading)</option>
                    </select>
                  </div>
                  <div className="field">
                    <div className="row"><label className="field-label">Link color accent</label><span className="muted" style={{ fontSize: 11 }}>{(settings as any).accentHue ?? 225}°</span></div>
                    <input type="range" min={0} max={360} step={5} value={(settings as any).accentHue ?? 225} onChange={(e) => void change((s) => ({ ...s, accentHue: Number(e.target.value) } as any), `Accent hue ${e.target.value}°`)} />
                  </div>
                </div>
              </section>

              <section className="card stack">
                <h2>Reading Mode</h2>
                <p className="muted" style={{ margin: 0, fontSize: 12 }}>Distraction-free reading with adjustable typography and spacing. When enabled, navigation and ads are visually hidden.</p>
                <div className="row"><span>Enable reading mode</span><Switch label="Reading mode" checked={settings.readingMode.enabled} onChange={(enabled) => void change((s) => ({ ...s, readingMode: { ...s.readingMode, enabled } }), enabled ? 'Reading mode on.' : 'Reading mode off.')} /></div>
                {settings.readingMode.enabled && (
                  <div className="stack animate-in" style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                    <div className="field">
                      <div className="row"><label className="field-label">Font size</label><span className="slider-value">{settings.readingMode.fontSize}%</span></div>
                      <input type="range" min={80} max={140} step={5} value={settings.readingMode.fontSize} onChange={(e) => void change((s) => ({ ...s, readingMode: { ...s.readingMode, fontSize: Number(e.target.value) } }), `Reading font size ${e.target.value}%`)} />
                    </div>
                    <div className="field">
                      <div className="row"><label className="field-label">Line height</label><span className="slider-value">{settings.readingMode.lineHeight}%</span></div>
                      <input type="range" min={120} max={200} step={10} value={settings.readingMode.lineHeight} onChange={(e) => void change((s) => ({ ...s, readingMode: { ...s.readingMode, lineHeight: Number(e.target.value) } }), `Line height ${e.target.value}%`)} />
                    </div>
                    <div className="field">
                      <div className="row"><label className="field-label">Max width</label><span className="slider-value">{settings.readingMode.maxWidth}px</span></div>
                      <input type="range" min={600} max={900} step={50} value={settings.readingMode.maxWidth} onChange={(e) => void change((s) => ({ ...s, readingMode: { ...s.readingMode, maxWidth: Number(e.target.value) } }), `Max width ${e.target.value}px`)} />
                    </div>
                    <div className="field">
                      <label className="field-label">Font family</label>
                      <select value={settings.readingMode.fontFamily} onChange={(e) => void change((s) => ({ ...s, readingMode: { ...s.readingMode, fontFamily: e.target.value as any } }), `Reading font ${e.target.value}`)}>
                        <option value="system">System</option>
                        <option value="serif">Serif (Georgia)</option>
                        <option value="sans">Sans (Inter)</option>
                        <option value="dyslexic">OpenDyslexic</option>
                      </select>
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}

          {tab === 'themes' && (
            <div className="stack-xl animate-in">
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 700 }}>Themes</h1>
                <p className="muted" style={{ marginTop: 4 }}>Choose from 10 premium presets or create your own. Themes switch instantly and can be customized per website.</p>
              </div>

              <section className="card stack">
                <h2>Select Theme</h2>
                <ThemeGrid value={settings.theme} onChange={(theme) => void change((s) => ({ ...s, theme }), `Theme set to ${theme}.`)} />
              </section>

              {settings.customThemes.length > 0 && (
                <section className="card stack">
                  <h2>Custom Themes ({settings.customThemes.length})</h2>
                  <div className="stack">
                    {settings.customThemes.map((ct) => (
                      <div key={ct.id} className="row" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
                        <div className="row-start">
                          <div style={{ display: 'flex', gap: 4 }}>
                            <div className="color-swatch" style={{ background: ct.bg }} />
                            <div className="color-swatch" style={{ background: ct.text }} />
                            <div className="color-swatch" style={{ background: ct.accent }} />
                          </div>
                          <div style={{ marginLeft: 8 }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{ct.name}</div>
                            <div className="muted" style={{ fontSize: 11 }}>{ct.bg} · {ct.text} · {ct.accent}</div>
                          </div>
                        </div>
                        <div className="row-start" style={{ gap: 6 }}>
                          <button type="button" className="btn btn-sm" onClick={() => void change((s) => ({ ...s, theme: 'custom' as any, activeCustomThemeId: ct.id }), `Switched to ${ct.name}.`)}>Use</button>
                          <button type="button" className="btn btn-sm" onClick={() => handleExportTheme(ct)}>Export</button>
                          <button type="button" className="btn btn-sm btn-danger" onClick={() => deleteCustomTheme(ct.id)}>Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="card stack">
                <h2>Create Custom Theme</h2>
                <div className="stack">
                  <div className="field">
                    <label htmlFor="ct-name" className="field-label">Theme name</label>
                    <input id="ct-name" type="text" value={customName} placeholder="My Midnight Blue" onChange={(e) => setCustomName(e.target.value)} maxLength={50} />
                  </div>
                  <div className="grid-3">
                    <div className="field">
                      <label className="field-label">Background</label>
                      <div className="row-start">
                        <input type="color" value={customBg} onChange={(e) => setCustomBg(e.target.value)} className="color-input" />
                        <input type="text" value={customBg} onChange={(e) => setCustomBg(e.target.value)} style={{ flex: 1 }} placeholder="#14171d" />
                      </div>
                    </div>
                    <div className="field">
                      <label className="field-label">Text</label>
                      <div className="row-start">
                        <input type="color" value={customText} onChange={(e) => setCustomText(e.target.value)} className="color-input" />
                        <input type="text" value={customText} onChange={(e) => setCustomText(e.target.value)} style={{ flex: 1 }} placeholder="#e8eaf0" />
                      </div>
                    </div>
                    <div className="field">
                      <label className="field-label">Accent</label>
                      <div className="row-start">
                        <input type="color" value={customAccent} onChange={(e) => setCustomAccent(e.target.value)} className="color-input" />
                        <input type="text" value={customAccent} onChange={(e) => setCustomAccent(e.target.value)} style={{ flex: 1 }} placeholder="#7ab7ff" />
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1, height: 48, borderRadius: 10, background: customBg, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: customText, fontWeight: 600 }}>Aa Preview</div>
                    <div style={{ flex: 1, height: 48, borderRadius: 10, background: customBg, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: customAccent, fontWeight: 600, textDecoration: 'underline' }}>Link</div>
                  </div>
                  <button type="button" className="btn btn-accent" onClick={createCustomTheme} disabled={!customName.trim()}>Create Theme</button>
                  <div className="row" style={{ marginTop: 8 }}>
                    <label className="btn btn-sm" style={{ cursor: 'pointer' }}>
                      Import theme JSON
                      <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportTheme} />
                    </label>
                    <span className="muted" style={{ fontSize: 11 }}>Supports portable theme files from other NightLens users.</span>
                  </div>
                </div>
              </section>

              <section className="card stack">
                <h2>Per-Website Themes</h2>
                <p className="muted" style={{ margin: 0, fontSize: 12 }}>Assign a different theme to each website. The popup’s theme selector applies to the current site when this is configured.</p>
                {siteThemes.length === 0 ? <p className="muted" style={{ fontSize: 12 }}>No per-site themes yet. Set them from the “Websites” tab.</p> : (
                  <ul className="sites">
                    {siteThemes.map(([host, theme]) => (
                      <li key={host}>
                        <span><strong>{host}</strong> <span className="muted">→ {theme}</span></span>
                        <button type="button" className="btn btn-sm" onClick={() => void change((s) => { const r = { ...s.siteThemes }; delete r[host]; return { ...s, siteThemes: r }; }, `Removed per-site theme for ${host}`)}>Remove</button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}

          {tab === 'sites' && (
            <div className="stack-xl animate-in">
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 700 }}>Website Management</h1>
                <p className="muted" style={{ marginTop: 4 }}>Control NightLens per website. Rules use exact hostname matching — example.com does not cover www.example.com.</p>
              </div>

              <section className="card stack">
                <h2>Add Website Rule</h2>
                <p className="muted" style={{ margin: 0, fontSize: 12 }}>Rules match the exact hostname. Ports, schemes and paths are ignored.</p>
                <form className="row" onSubmit={addExcluded} noValidate style={{ alignItems: 'flex-end' }}>
                  <div className="field" style={{ flex: 1 }}>
                    <label htmlFor="exclude-input" className="field-label">Exclude a website</label>
                    <input id="exclude-input" type="text" value={input} placeholder="example.com" aria-invalid={inputError !== ''} aria-describedby="exclude-error" onChange={(e) => setInput(e.target.value)} />
                  </div>
                  <button type="submit" className="btn btn-primary">Add to excluded</button>
                </form>
                <div id="exclude-error" className="status error" role="alert">{inputError}</div>

                <form className="row" onSubmit={addRule} noValidate style={{ alignItems: 'flex-end' }}>
                  <div className="field" style={{ flex: 1 }}>
                    <label htmlFor="rule-input" className="field-label">Website</label>
                    <input id="rule-input" type="text" value={ruleHost} placeholder="example.com" aria-invalid={ruleError !== ''} aria-describedby="rule-error" onChange={(e) => setRuleHost(e.target.value)} />
                  </div>
                  <div className="field" style={{ width: 150 }}>
                    <label htmlFor="rule-mode" className="field-label">Action</label>
                    <select id="rule-mode" value={ruleMode} onChange={(e) => setRuleMode(e.target.value as 'on' | 'off')}>
                      <option value="on">Force dark on</option>
                      <option value="off">Exclude</option>
                    </select>
                  </div>
                  <button type="submit" className="btn">Apply rule</button>
                </form>
                <div id="rule-error" className="status error" role="alert">{ruleError}</div>

                <form className="row" onSubmit={assignTheme} noValidate style={{ alignItems: 'flex-end' }}>
                  <div className="field" style={{ flex: 1 }}>
                    <label htmlFor="theme-host" className="field-label">Assign theme to website</label>
                    <input id="theme-host" type="text" value={themeHost} placeholder="example.com" aria-invalid={themeError !== ''} aria-describedby="theme-error" onChange={(e) => setThemeHost(e.target.value)} />
                  </div>
                  <div className="field" style={{ width: 170 }}>
                    <label htmlFor="theme-pick" className="field-label">Theme</label>
                    <select id="theme-pick" value={themePick} onChange={(e) => setThemePick(e.target.value as ThemeId)}>
                      {THEME_IDS.map((t) => <option key={t} value={t}>{THEME_LABELS[t] ?? t}</option>)}
                    </select>
                  </div>
                  <button type="submit" className="btn btn-accent">Assign</button>
                </form>
                <div id="theme-error" className="status error" role="alert">{themeError}</div>
                {siteThemes.length > 0 && (
                  <ul className="sites" aria-label="Per-site themes">
                    {siteThemes.map(([host, theme]) => (
                      <li key={host}>
                        <span><strong>{host}</strong> <span className="muted">→ {THEME_LABELS[theme] ?? theme}</span></span>
                        <button type="button" className="btn btn-sm" aria-label={`Remove theme for ${host}`} onClick={() => void change((s) => { const r = { ...s.siteThemes }; delete r[host]; return { ...s, siteThemes: r }; }, `Removed per-site theme for ${host}`)}>Remove</button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="field">
                  <label className="field-label">Search sites</label>
                  <input type="text" value={searchSites} placeholder="Filter excluded/forced sites..." onChange={(e) => setSearchSites(e.target.value)} />
                </div>

                <h3 style={{ fontSize: 13, fontWeight: 600, marginTop: 8 }}>Excluded sites <span className="badge badge-off" style={{ marginLeft: 6 }}>{excluded.length}</span></h3>
                {filteredExcluded.length === 0 ? <p className="muted" style={{ fontSize: 12 }}>{excluded.length === 0 ? 'No excluded sites. Use the toolbar popup or the form above.' : 'No matches.'}</p> : (
                  <ul className="sites" aria-label="Excluded sites">{filteredExcluded.map((h) => <li key={h}><span>{h}</span><button type="button" className="btn btn-sm" aria-label={`Remove ${h}`} onClick={() => removeRule(h)}>Remove</button></li>)}</ul>
                )}

                <h3 style={{ fontSize: 13, fontWeight: 600 }}>Forced on <span className="badge badge-active" style={{ marginLeft: 6 }}>{forced.length}</span></h3>
                {forced.length === 0 ? <p className="muted" style={{ fontSize: 12 }}>None. Sites that already look dark are left alone unless you force them on.</p> : (
                  <ul className="sites" aria-label="Forced sites">{forced.map((h) => <li key={h}><span>{h}</span><button type="button" className="btn btn-sm" aria-label={`Remove ${h}`} onClick={() => removeRule(h)}>Remove</button></li>)}</ul>
                )}
              </section>

              <section className="card stack">
                <h2>Compatibility Profiles</h2>
                <p className="muted" style={{ fontSize: 12, margin: 0 }}>Choose rendering behavior for problematic sites. Gentle never forces dark on natively dark pages; Aggressive themes more eagerly; Media-Only only dims media.</p>
                <form className="row" onSubmit={saveCompat} noValidate style={{ alignItems: 'flex-end' }}>
                  <div className="field" style={{ flex: 1 }}>
                    <label htmlFor="comp-host" className="field-label">Website for profile</label>
                    <input id="comp-host" type="text" value={compHost} placeholder="example.com" aria-invalid={compError !== ''} aria-describedby="comp-error" onChange={(e) => setCompHost(e.target.value)} />
                  </div>
                  <div className="field" style={{ width: 160 }}>
                    <label htmlFor="comp-mode" className="field-label">Profile</label>
                    <select id="comp-mode" value={compMode} onChange={(e) => setCompMode(e.target.value as CompatibilityMode)}>
                      <option value="auto">Auto</option>
                      <option value="gentle">Gentle</option>
                      <option value="aggressive">Aggressive</option>
                      <option value="mediaOnly">Media only</option>
                    </select>
                  </div>
                  <button type="submit" className="btn btn-accent">Save profile</button>
                </form>
                <div id="comp-error" className="status error" role="alert">{compError}</div>
                {Object.keys(settings.compatibility).length === 0 ? <p className="muted" style={{ fontSize: 12 }}>No custom profiles. All sites use automatic handling.</p> : (
                  <ul className="sites">
                    {Object.entries(settings.compatibility).map(([host, mode]) => (
                      <li key={host}><span><strong>{host}</strong> → {mode}</span><button type="button" className="btn btn-sm" onClick={() => void change((s) => { const c = { ...s.compatibility }; delete c[host]; return { ...s, compatibility: c }; }, `Reset compatibility for ${host}`)}>Reset</button></li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="card stack">
                <h2>Custom CSS per Website</h2>
                <p className="muted" style={{ fontSize: 12, margin: 0 }}>Advanced: inject domain-specific CSS after NightLens theming. Validate carefully — invalid CSS is discarded for safety. No @import or javascript: allowed.</p>
                <div className="field">
                  <label className="field-label">Hostname</label>
                  <input type="text" value={cssHost} placeholder="example.com" onChange={(e) => setCssHost(e.target.value)} />
                </div>
                <div className="field">
                  <label className="field-label">CSS (max 20,000 chars)</label>
                  <textarea value={cssInput} placeholder="body { letter-spacing: 0.02em; }" rows={4} onChange={(e) => setCssInput(e.target.value)} maxLength={20000} />
                </div>
                <button type="button" className="btn btn-accent" disabled={!cssHost.trim() || !cssInput.trim()} onClick={() => {
                  const host = hostnameFromUserInput(cssHost);
                  if (!host) { setNotice({ kind: 'error', text: 'Invalid hostname.' }); return; }
                  void change((s) => ({ ...s, customCSS: { ...s.customCSS, [host]: cssInput } }), `Custom CSS saved for ${host}`);
                  setCssHost(''); setCssInput('');
                }}>Save CSS</button>
                {Object.keys(settings.customCSS).length > 0 && (
                  <ul className="sites">
                    {Object.entries(settings.customCSS).map(([host, css]) => (
                      <li key={host} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                        <div className="row"><strong>{host}</strong><button type="button" className="btn btn-sm btn-danger" onClick={() => void change((s) => { const c = { ...s.customCSS }; delete c[host]; return { ...s, customCSS: c }; }, `Removed CSS for ${host}`)}>Remove</button></div>
                        <pre style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, fontSize: 11, overflow: 'auto', maxHeight: 80, margin: '6px 0 0' }}>{css.slice(0, 200)}</pre>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="card stack">
                <h2>Per-Website Overrides</h2>
                <p className="muted" style={{ fontSize: 12, margin: 0 }}>Fine-tune brightness/contrast for specific sites. Overrides apply on top of your global settings and per-site theme.</p>
                {Object.keys(settings.siteOverrides).length === 0 ? <p className="muted" style={{ fontSize: 12 }}>No overrides.</p> : (
                  <ul className="sites">
                    {Object.entries(settings.siteOverrides).map(([host, ov]) => (
                      <li key={host}><span>{host} → b{ov.brightness ?? '-'} c{ov.contrast ?? '-'} w{ov.warmth ?? '-'}</span><button type="button" className="btn btn-sm" onClick={() => void change((s) => { const o = { ...s.siteOverrides }; delete o[host]; return { ...s, siteOverrides: o }; }, `Removed override for ${host}`)}>Clear</button></li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}

          {tab === 'accessibility' && (
            <div className="stack-xl animate-in">
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 700 }}>Accessibility</h1>
                <p className="muted" style={{ marginTop: 4 }}>NightLens prioritizes readability. All themes meet WCAG contrast requirements.</p>
              </div>

              <section className="card stack">
                <h2>Contrast & Readability</h2>
                <div className="row"><span>High contrast (7:1 text)</span><Switch label="High contrast" checked={settings.accessibility.highContrast} onChange={(v) => void change((s) => ({ ...s, accessibility: { ...s.accessibility, highContrast: v } }), v ? 'High contrast enabled.' : 'High contrast off.')} /></div>
                <div className="row"><span>Underline links</span><Switch label="Underline links" checked={settings.accessibility.underlineLinks} onChange={(v) => void change((s) => ({ ...s, accessibility: { ...s.accessibility, underlineLinks: v } }), v ? 'Link underlines on.' : 'Link underlines off.')} /></div>
                <div className="row"><span>Reduced motion</span><Switch label="Reduced motion" checked={settings.accessibility.reducedMotion} onChange={(v) => void change((s) => ({ ...s, accessibility: { ...s.accessibility, reducedMotion: v } }), v ? 'Reduced motion on.' : 'Reduced motion off.')} /></div>
                <p className="muted" style={{ fontSize: 12, margin: 0, lineHeight: 1.6 }}>WCAG AA requires 4.5:1 for normal text, 3:1 for large text. AAA requires 7:1. NightLens guarantees AA everywhere achievable, and falls back to white/black when the background makes 7:1 impossible.</p>
              </section>

              <section className="card stack">
                <h2>Color Vision</h2>
                <div className="field">
                  <label className="field-label">Color blind friendly mode</label>
                  <select value={settings.accessibility.colorBlindMode} onChange={(e) => void change((s) => ({ ...s, accessibility: { ...s.accessibility, colorBlindMode: e.target.value as any } }), `Color blind mode: ${e.target.value}`)}>
                    <option value="none">None (default)</option>
                    <option value="protanopia">Protanopia (red-blind)</option>
                    <option value="deuteranopia">Deuteranopia (green-blind)</option>
                    <option value="tritanopia">Tritanopia (blue-blind)</option>
                  </select>
                  <p className="field-hint">Adjusts link and accent hues to be distinguishable for common forms of color blindness. Themes are chosen to maximize distinctiveness.</p>
                </div>
              </section>

              <section className="card stack">
                <h2>Keyboard & Screen Readers</h2>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                  <li>All controls are keyboard navigable with visible focus rings</li>
                  <li>Toggle shortcut: <kbd style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px', fontSize: 11, fontFamily: 'var(--font-mono)' }}>Alt+Shift+D</kbd></li>
                  <li>Labels are screen-reader friendly (aria-checked, aria-label, role=switch)</li>
                  <li>Reduced motion respects <code>prefers-reduced-motion: reduce</code></li>
                </ul>
              </section>
            </div>
          )}

          {tab === 'automation' && (
            <div className="stack-xl animate-in">
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 700 }}>Automation</h1>
                <p className="muted" style={{ marginTop: 4 }}>Let NightLens adapt to your system and schedule automatically.</p>
              </div>

              <section className="card stack">
                <h2>Schedule</h2>
                <div className="row"><span>Enable scheduled dark mode</span><Switch label="Schedule" checked={settings.schedule.enabled} onChange={(enabled) => void change((s) => ({ ...s, schedule: { ...s.schedule, enabled } }), enabled ? 'Schedule enabled.' : 'Schedule disabled.')} /></div>
                {settings.schedule.enabled && (
                  <div className="grid-2 animate-in">
                    <div className="field">
                      <label className="field-label">Start (dark mode on)</label>
                      <input type="time" value={settings.schedule.start} onChange={(e) => void change((s) => ({ ...s, schedule: { ...s.schedule, start: e.target.value } }), `Schedule start ${e.target.value}`)} />
                    </div>
                    <div className="field">
                      <label className="field-label">End (dark mode off)</label>
                      <input type="time" value={settings.schedule.end} onChange={(e) => void change((s) => ({ ...s, schedule: { ...s.schedule, end: e.target.value } }), `Schedule end ${e.target.value}`)} />
                    </div>
                  </div>
                )}
                <p className="muted" style={{ fontSize: 11, margin: 0 }}>Example: 22:00–07:00 enables dark mode overnight. Supports overnight ranges that cross midnight.</p>
              </section>

              <section className="card stack">
                <h2>System Integration</h2>
                <div className="row"><span>Follow system dark/light preference</span><Switch label="Follow system" checked={settings.schedule.followSystem} onChange={(followSystem) => void change((s) => ({ ...s, schedule: { ...s.schedule, followSystem } }), followSystem ? 'Following system appearance.' : 'Not following system.')} /></div>
                <div className="field">
                  <label className="field-label">Theme when following system</label>
                  <select value={settings.theme} onChange={(e) => void change((s) => ({ ...s, theme: e.target.value as any }), `Theme set to ${e.target.value}`)}>
                    <option value="system">Only when system is dark (recommended)</option>
                    {Object.entries(PREMIUM_THEME_META).map(([id, m]) => <option key={id} value={id}>{m.label}</option>)}
                  </select>
                  <p className="field-hint">When “Follow System” or theme “Follow System” is set, NightLens waits for your OS to report dark mode before applying.</p>
                </div>
              </section>

              <section className="card stack">
                <h2>Per-Website Automation</h2>
                <p className="muted" style={{ fontSize: 12, margin: 0 }}>NightLens remembers each website’s exclusion/force status and restores it on every visit. Configure rules in the Websites tab or via the popup.</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span className="badge badge-active">Remembers • {Object.keys(settings.siteRules).length} rules</span>
                  <span className="badge badge-idle">Auto-restores per domain</span>
                </div>
              </section>
            </div>
          )}

          {tab === 'performance' && (
            <div className="stack-xl animate-in">
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 700 }}>Performance</h1>
                <p className="muted" style={{ marginTop: 4 }}>NightLens is designed to remain lightweight even on large pages.</p>
              </div>

              <section className="card stack">
                <h2>Engine Settings</h2>
                <div className="row"><span>Cached color parsing</span><Switch label="Cache" checked={settings.performance.enableCache} onChange={(v) => void change((s) => ({ ...s, performance: { ...s.performance, enableCache: v } }), v ? 'Cache enabled.' : 'Cache disabled.')} /></div>
                <div className="field">
                  <div className="row"><label className="field-label">Elements per frame</label><span className="slider-value">{settings.performance.maxElementsPerFrame}</span></div>
                  <input type="range" min={100} max={1000} step={50} value={settings.performance.maxElementsPerFrame} onChange={(e) => void change((s) => ({ ...s, performance: { ...s.performance, maxElementsPerFrame: Number(e.target.value) } }), `Max elements ${e.target.value}`)} />
                  <p className="field-hint">Higher = faster initial theming but more main-thread blocking. Default 400 is balanced.</p>
                </div>
                <div className="field">
                  <div className="row"><label className="field-label">Debounce (ms)</label><span className="slider-value">{settings.performance.debounceMs}ms</span></div>
                  <input type="range" min={50} max={500} step={25} value={settings.performance.debounceMs} onChange={(e) => void change((s) => ({ ...s, performance: { ...s.performance, debounceMs: Number(e.target.value) } }), `Debounce ${e.target.value}ms`)} />
                </div>
              </section>

              <section className="card stack">
                <h2>Developer Mode</h2>
                <div className="row"><span>Enable developer overlays</span><Switch label="Developer mode" checked={settings.developerMode} onChange={(v) => void change((s) => ({ ...s, developerMode: v }), v ? 'Developer mode on.' : 'Developer mode off.')} /></div>
                <p className="muted" style={{ fontSize: 11, margin: 0 }}>When on, NightLens adds <code>data-nl-dev</code> attributes with original/mapped color info and logs performance stats to the console. Only use while debugging a site.</p>
              </section>

              <section className="card" style={{ background: 'var(--bg-elevated)' }}>
                <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>How it stays fast</h3>
                <ul style={{ margin: '8px 0 0', paddingLeft: 16, fontSize: 12, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                  <li>One style recalculation per batch (strip → read → write)</li>
                  <li>Set-deduplicated queue + WeakSet for processed elements</li>
                  <li>MutationObserver filtered to color-relevant changes only</li>
                  <li>Shadow DOM handled with per-root contexts, closed roots skipped</li>
                  <li>Duplicate rule prevention (max 5000 rules, then reset)</li>
                  <li>SPA navigation detected via history patching + popstate/hashchange</li>
                </ul>
              </section>
            </div>
          )}

          {tab === 'privacy' && (
            <div className="stack-xl animate-in">
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 700 }}>Privacy & Security</h1>
                <p className="muted" style={{ marginTop: 4 }}>Privacy-first. Everything stays on your device.</p>
              </div>

              <section className="card stack" style={{ borderColor: 'var(--success)', background: 'var(--success-soft)' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: 'var(--success)' }}>✓</span> What NightLens Does NOT Do</h2>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.7 }}>
                  <li>No browsing history collection</li>
                  <li>No analytics, telemetry, or tracking</li>
                  <li>No external network requests (no fetch/XHR/WebSocket)</li>
                  <li>No advertising</li>
                  <li>No sync to cloud — local storage only</li>
                  <li>No unsafe eval or dynamic code</li>
                </ul>
              </section>

              <section className="card stack">
                <h2>What Is Stored</h2>
                <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                  Only your settings, in <code>chrome.storage.local</code> under key <code>nightlens:settings</code>: on/off, theme, sliders, and hostnames you excluded or forced on. Local to this browser profile, removed when you uninstall.
                </p>
                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, fontSize: 11, fontFamily: 'var(--font-mono)', overflow: 'auto' }}>
                  <div>{`{`}</div>
                  <div style={{ paddingLeft: 12 }}>{`"schemaVersion": ${settings.schemaVersion},`}</div>
                  <div style={{ paddingLeft: 12 }}>{`"enabled": ${settings.enabled},`}</div>
                  <div style={{ paddingLeft: 12 }}>{`"theme": "${settings.theme}",`}</div>
                  <div style={{ paddingLeft: 12 }}>{`"brightness": ${settings.brightness},`}</div>
                  <div style={{ paddingLeft: 12 }}>{`"siteRules": { ...${Object.keys(settings.siteRules).length} hostnames }`}</div>
                  <div>{`}`}</div>
                </div>
              </section>

              <section className="card stack">
                <h2>Permissions Explained</h2>
                <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                  <div className="row" style={{ alignItems: 'flex-start' }}><strong>storage</strong><span className="muted" style={{ textAlign: 'right', maxWidth: 360 }}>Save settings locally in the browser. No other data access.</span></div>
                  <div className="divider" />
                  <div className="row" style={{ alignItems: 'flex-start' }}><strong>alarms</strong><span className="muted" style={{ textAlign: 'right', maxWidth: 360 }}>Check schedule every minute to enable/disable by time window.</span></div>
                  <div className="divider" />
                  <div className="row" style={{ alignItems: 'flex-start' }}><strong>content_scripts</strong><span className="muted" style={{ textAlign: 'right', maxWidth: 360 }}>Apply dark theme on all http/https pages you visit. Inherent to a page-restyling extension.</span></div>
                </div>
              </section>

              <section className="card stack">
                <h2>Backup & Restore</h2>
                <div className="row" style={{ gap: 8 }}>
                  <button type="button" className="btn btn-accent" onClick={handleExport}>Export settings</button>
                  <label className="btn" style={{ cursor: 'pointer' }}>
                    Import settings
                    <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
                  </label>
                </div>
                <p className="muted" style={{ fontSize: 11, margin: 0 }}>Export creates a portable JSON file with all your preferences, themes, and site rules. Import validates structure and discards invalid fields.</p>
              </section>

              <div>
                {!confirmReset ? <button type="button" className="btn btn-danger" onClick={() => setConfirmReset(true)}>Reset all settings…</button> : (
                  <span className="row" style={{ justifyContent: 'flex-start' }} role="group" aria-label="Confirm reset">
                    <span style={{ fontSize: 12 }}>This also clears all site rules. Continue?</span>
                    <button type="button" className="btn btn-sm" onClick={() => setConfirmReset(false)}>Cancel</button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => { setConfirmReset(false); void reset(); }}>Reset everything</button>
                  </span>
                )}
              </div>
            </div>
          )}

          {tab === 'about' && (
            <div className="stack-xl animate-in">
              <div className="card" style={{ textAlign: 'center', padding: 28 }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                  <Logo size={48} />
                </div>
                <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.04em' }}>NightLens</h1>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Premium intelligent dark mode for the web</div>
                <div style={{ marginTop: 12, display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span className="badge badge-active">v{chrome.runtime.getManifest?.()?.version ?? '0.1.0'}</span>
                  <span className="badge badge-off">Privacy-first</span>
                  <span className="badge badge-idle">Manifest V3</span>
                  <span className="badge badge-off">React 19 · Vite</span>
                </div>
              </div>

              <section className="card stack">
                <h2>What Makes NightLens Premium</h2>
                <div className="grid-2" style={{ fontSize: 12, lineHeight: 1.6 }}>
                  <div>
                    <strong>Intelligent Engine</strong>
                    <div className="muted">Per-element color mapping with WCAG contrast guarantees, shadow DOM, iframe, and SPA support.</div>
                  </div>
                  <div>
                    <strong>10 Premium Themes</strong>
                    <div className="muted">Midnight, AMOLED, Nord, Dracula and more — each tuned for readability.</div>
                  </div>
                  <div>
                    <strong>Per-Site Control</strong>
                    <div className="muted">Exclude, force, theme, and tweak every domain individually.</div>
                  </div>
                  <div>
                    <strong>Reading Mode</strong>
                    <div className="muted">Distraction-free typography with adjustable width and serifs.</div>
                  </div>
                </div>
              </section>

              <section className="card stack">
                <h2>Keyboard Shortcuts</h2>
                <div className="row"><span>Toggle NightLens</span><kbd style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderBottomWidth: 2, borderRadius: 6, padding: '4px 8px', fontSize: 12, fontFamily: 'var(--font-mono)' }}>Alt+Shift+D</kbd></div>
                <p className="muted" style={{ fontSize: 11, margin: 0 }}>Customizable in <code>chrome://extensions/shortcuts</code>. The popup and options pages are fully keyboard navigable.</p>
              </section>

              <section className="card stack">
                <h2>Known Limitations</h2>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                  <li>Hover backgrounds are suppressed on recoloured elements (limitation documented)</li>
                  <li>Gradient and image backgrounds remain as authored</li>
                  <li>Dark transparent logos may need per-site exclusion</li>
                  <li>Closed shadow roots cannot be themed</li>
                  <li>Inline !important styles may override the theme</li>
                </ul>
                <p className="muted" style={{ fontSize: 11, margin: 0 }}>Full list in docs/LIMITATIONS.md · No live websites are claimed compatible beyond local fixtures.</p>
              </section>

              <section className="card stack">
                <h2>Future Roadmap</h2>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                  <li>Hover/active state preservation via pseudo-class remapping</li>
                  <li>Logo inversion heuristics for dark-on-transparent</li>
                  <li>Early-paint cache to eliminate flash</li>
                  <li>Firefox build with MV3 verification</li>
                  <li>Visual regression snapshots & axe-core audits</li>
                </ul>
              </section>
            </div>
          )}

          <StatusLine notice={notice} />
          <div className="divider" style={{ marginTop: 20 }} />
          <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-ghost)', padding: '12px 0' }}>
            NightLens · Privacy-first · No tracking · Local-only storage · Crafted with care
          </div>
        </main>
      </div>
    </div>
  );
}
