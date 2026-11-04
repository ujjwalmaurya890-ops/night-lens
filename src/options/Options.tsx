import { useRef, useState, type ComponentType, type FormEvent } from 'react';
import type { LucideProps } from 'lucide-react';
import { MAX_SITE_RULES } from '../shared/defaults';
import { hostnameFromUserInput } from '../shared/hostname';
import { exportSettings, validateImport } from '../shared/storage';
import { Logo, StatusLine, Switch } from '../ui/components';
import { useSettings } from '../ui/hooks';
import {
  IconClock,
  IconDashboard,
  IconDownload,
  IconEye,
  IconGlobe,
  IconInfo,
  IconPalette,
  IconShieldCheck,
  IconSliders,
  IconUpload,
  IconZap,
} from '../ui/icons';
import { AppearanceTab } from './tabs/AppearanceTab';
import { OverviewTab } from './tabs/OverviewTab';
import {
  AboutTab,
  AccessibilityTab,
  AutomationTab,
  PerformanceTab,
  PrivacyTab,
} from './tabs/SystemTabs';
import { ThemesTab } from './tabs/ThemesTab';
import { WebsitesTab } from './tabs/WebsitesTab';

type Tab =
  | 'overview'
  | 'appearance'
  | 'themes'
  | 'sites'
  | 'accessibility'
  | 'automation'
  | 'performance'
  | 'privacy'
  | 'about';

const TABS: { id: Tab; label: string; Icon: ComponentType<LucideProps> }[] = [
  { id: 'overview', label: 'Overview', Icon: IconDashboard },
  { id: 'appearance', label: 'Appearance', Icon: IconSliders },
  { id: 'themes', label: 'Themes', Icon: IconPalette },
  { id: 'sites', label: 'Websites', Icon: IconGlobe },
  { id: 'accessibility', label: 'Accessibility', Icon: IconEye },
  { id: 'automation', label: 'Automation', Icon: IconClock },
  { id: 'performance', label: 'Performance', Icon: IconZap },
  { id: 'privacy', label: 'Privacy', Icon: IconShieldCheck },
  { id: 'about', label: 'About', Icon: IconInfo },
];

export function Options() {
  const { settings, notice, change, reset, setNotice } = useSettings();
  const [tab, setTab] = useState<Tab>('overview');
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState('');
  const sidebarImportRef = useRef<HTMLInputElement>(null);

  const excluded = Object.entries(settings.siteRules)
    .filter(([, m]) => m === 'off')
    .map(([h]) => h)
    .sort();
  const forced = Object.entries(settings.siteRules)
    .filter(([, m]) => m === 'on')
    .map(([h]) => h)
    .sort();
  const siteThemes = Object.entries(settings.siteThemes).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  const version = chrome.runtime.getManifest?.()?.version ?? '1.0.0';

  const addExcluded = (e: FormEvent) => {
    e.preventDefault();
    const host = hostnameFromUserInput(input);
    if (!host) {
      setInputError('Enter a website address such as example.com.');
      return;
    }
    if (
      Object.keys(settings.siteRules).length >= MAX_SITE_RULES &&
      !(host in settings.siteRules)
    ) {
      setInputError('Too many site rules.');
      return;
    }
    setInputError('');
    setInput('');
    void change(
      (s) => ({ ...s, siteRules: { ...s.siteRules, [host]: 'off' } }),
      `${host} is now excluded.`,
    );
  };

  const removeRule = (host: string) =>
    void change(
      (s) => {
        const r = { ...s.siteRules };
        delete r[host];
        return { ...s, siteRules: r };
      },
      `${host} removed.`,
    );

  const handleExport = () => {
    const json = exportSettings(settings);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nightlens-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice({ kind: 'ok', text: 'Settings exported.' });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = validateImport(reader.result as string);
      if (!result.ok) {
        setNotice({ kind: 'error', text: `Import failed: ${result.error}` });
        return;
      }
      void change(() => result.settings, 'Settings imported.');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div
      className="dashboard shell-enter"
      data-reduced-motion={settings.accessibility.reducedMotion ? 'true' : undefined}
    >
      <header className="options-header">
        <div className="options-header-inner">
          <div className="options-brand-group">
            <Logo size={34} />
            <div>
              <div className="options-brand-title">NightLens</div>
              <div className="options-brand-sub">
                Intelligent Dark Mode · v{version}
              </div>
            </div>
          </div>

          <div className="options-status-controls">
            <span
              className={`badge ${settings.enabled ? 'badge-active' : 'badge-off'}`}
            >
              <span className="badge-dot" aria-hidden="true" />
              {settings.enabled ? 'Enabled' : 'Disabled'}
            </span>
            <Switch
              label="Dark mode (all sites)"
              checked={settings.enabled}
              onChange={(enabled) =>
                void change(
                  (s) => ({ ...s, enabled }),
                  enabled ? 'Dark mode on.' : 'Dark mode off.',
                )
              }
            />
          </div>
        </div>
      </header>

      <div className="options-workspace">
        <nav className="sidebar" aria-label="Settings sections">
          <div className="sidebar-section">Preferences</div>
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className={`sidebar-item ${tab === id ? 'active' : ''}`}
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => setTab(id)}
            >
              <span className="sidebar-item-icon">
                <Icon size={16} />
              </span>
              <span>{label}</span>
            </button>
          ))}

          <hr className="divider" />
          <div className="sidebar-section">Backup</div>

          <button type="button" className="sidebar-item" onClick={handleExport}>
            <span className="sidebar-item-icon">
              <IconDownload size={16} />
            </span>
            <span>Export settings</span>
          </button>

          <button
            type="button"
            className="sidebar-item"
            onClick={() => sidebarImportRef.current?.click()}
          >
            <span className="sidebar-item-icon">
              <IconUpload size={16} />
            </span>
            <span>Import settings</span>
          </button>
          <input
            ref={sidebarImportRef}
            type="file"
            accept=".json"
            className="sr-only"
            tabIndex={-1}
            aria-label="Import settings JSON file"
            onChange={handleImport}
          />
        </nav>

        <main className="options-main">
          <div key={tab} className="stack-xl panel-enter">
            {tab === 'overview' && (
              <OverviewTab
                settings={settings}
                excluded={excluded}
                forced={forced}
                input={input}
                inputError={inputError}
                onInputChange={setInput}
                onAddExcluded={addExcluded}
                onRemoveRule={removeRule}
                onChange={(u, m) => void change(u, m)}
                onNavigateTab={setTab}
              />
            )}
            {tab === 'appearance' && (
              <AppearanceTab
                settings={settings}
                onChange={(u, m) => void change(u, m)}
              />
            )}
            {tab === 'themes' && (
              <ThemesTab
                settings={settings}
                siteThemes={siteThemes}
                onChange={(u, m) => void change(u, m)}
                onSetNotice={setNotice}
                onNavigateSites={() => setTab('sites')}
              />
            )}
            {tab === 'sites' && (
              <WebsitesTab
                settings={settings}
                excluded={excluded}
                forced={forced}
                siteThemes={siteThemes}
                input={input}
                inputError={inputError}
                onInputChange={setInput}
                onAddExcluded={addExcluded}
                onRemoveRule={removeRule}
                onChange={(u, m) => void change(u, m)}
                onSetNotice={setNotice}
              />
            )}
            {tab === 'accessibility' && (
              <AccessibilityTab
                settings={settings}
                onChange={(u, m) => void change(u, m)}
              />
            )}
            {tab === 'automation' && (
              <AutomationTab
                settings={settings}
                onChange={(u, m) => void change(u, m)}
              />
            )}
            {tab === 'performance' && (
              <PerformanceTab
                settings={settings}
                onChange={(u, m) => void change(u, m)}
              />
            )}
            {tab === 'privacy' && (
              <PrivacyTab
                settings={settings}
                onExport={handleExport}
                onImport={handleImport}
                onReset={() => void reset()}
              />
            )}
            {tab === 'about' && <AboutTab version={version} />}
          </div>

          <div style={{ marginTop: 20 }}>
            <StatusLine notice={notice} />
          </div>

          <hr className="divider" style={{ marginTop: 24 }} />
          <div className="options-footer">
            NightLens v{version} · Local-only storage · Zero telemetry · WCAG 2.2 AA
          </div>
        </main>
      </div>
    </div>
  );
}
