import { useEffect, useState } from 'react';
import { LIMITS } from '../shared/defaults';
import { PREMIUM_THEME_META, PRESETS, buildTokens } from '../engine/palette';
import { THEME_IDS, type Settings, type ThemeId } from '../shared/types';

export const THEME_LABELS: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const id of THEME_IDS) {
    if (PREMIUM_THEME_META[id]) map[id] = PREMIUM_THEME_META[id]!.label;
  }
  map['balanced'] = 'Balanced';
  map['highContrast'] = 'High Contrast';
  map['dim'] = 'Dim';
  map['system'] = 'Follow System';
  map['custom'] = 'Custom';
  return map;
})();

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <div className="brand-mark" style={{ width: size, height: size, borderRadius: size * 0.36 }}>
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <circle cx="8" cy="8" r="7" fill="none" stroke="white" strokeWidth="1.3" opacity="0.9" />
        <path d="M10.2 3.5a5 5 0 1 0 2.8 7.2A4.2 4.2 0 0 1 10.2 3.5z" fill="white" />
      </svg>
    </div>
  );
}

export function LogoFull() {
  return (
    <div className="row-start">
      <Logo size={30} />
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 }}>NightLens</div>
        <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 1 }}>Intelligent Dark Mode</div>
      </div>
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" className="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} />
  );
}

export function ThemeSelect({ value, onChange, id }: { value: ThemeId; onChange: (v: ThemeId) => void; id: string }) {
  return (
    <div className="field">
      <label htmlFor={id} className="field-label">Theme</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as ThemeId)}>
        {THEME_IDS.map((t) => <option key={t} value={t}>{THEME_LABELS[t] ?? t}</option>)}
      </select>
    </div>
  );
}

export function Slider({ id, label, value, limit, onCommit }: { id: string; label: string; value: number; limit: { min: number; max: number; step: number }; onCommit: (v: number) => void }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  useEffect(() => {
    if (local === value) return;
    const t = setTimeout(() => onCommit(local), 150);
    return () => clearTimeout(t);
  }, [local, value, onCommit]);
  return (
    <div className="field">
      <div className="slider-row"><label htmlFor={id} className="field-label">{label}</label><span className="slider-value">{local}%</span></div>
      <div className="slider-track">
        <input id={id} type="range" min={limit.min} max={limit.max} step={limit.step} value={local} aria-valuetext={`${local} percent`} onChange={(e) => setLocal(Number(e.target.value))} />
      </div>
    </div>
  );
}

export function HueSlider({ id, label, value, onCommit }: { id: string; label: string; value: number; onCommit: (v: number) => void }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  useEffect(() => {
    if (local === value) return;
    const t = setTimeout(() => onCommit(local), 150);
    return () => clearTimeout(t);
  }, [local, value, onCommit]);
  return (
    <div className="field">
      <div className="slider-row"><label htmlFor={id} className="field-label">{label}</label><span className="slider-value" style={{ background: `hsl(${local} 70% 50% / 0.15)`, color: `hsl(${local} 80% 65%)` }}>{local}°</span></div>
      <div className="slider-track">
        <input id={id} type="range" min={0} max={360} step={5} value={local} style={{ background: `linear-gradient(90deg, hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%), hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(360 100% 50%))`, height: 6, borderRadius: 999 }} onChange={(e) => setLocal(Number(e.target.value))} />
      </div>
    </div>
  );
}

export function ThemeCard({ themeId, active, onSelect }: { themeId: string; active: boolean; onSelect: () => void }) {
  const meta = PREMIUM_THEME_META[themeId];
  const tokens = (() => {
    try {
      return buildTokens({ theme: themeId as any, brightness: 100, contrast: 100, sepia: 0, warmth: 0, saturation: 50, accentHue: 225 });
    } catch { return null; }
  })();
  const preview = meta?.preview ?? (tokens ? { bg: `#${tokens.colors.bg.r.toString(16).padStart(2,'0')}${tokens.colors.bg.g.toString(16).padStart(2,'0')}${tokens.colors.bg.b.toString(16).padStart(2,'0')}`, text: `#${tokens.colors.text.r.toString(16).padStart(2,'0')}`, accent: `#${tokens.colors.link.r.toString(16).padStart(2,'0')}` } : { bg: '#17181b', text: '#ececee', accent: '#7ab7ff' });

  return (
    <button type="button" className={`theme-card ${active ? 'active' : ''}`} onClick={onSelect} aria-pressed={active} aria-label={`Select ${THEME_LABELS[themeId] ?? themeId} theme`}>
      <div className="theme-preview" style={{ background: preview.bg, color: preview.text }}>
        <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.9 }}>Aa</span>
        <span style={{ width: 14, height: 14, borderRadius: 6, background: preview.accent, border: '1px solid rgba(255,255,255,0.2)' }} />
        <span style={{ fontSize: 8, borderBottom: `1.5px solid ${preview.accent}`, paddingBottom: 1 }}>Link</span>
      </div>
      <div className="theme-name">{THEME_LABELS[themeId] ?? themeId}</div>
      <div className="theme-desc">{meta?.description ?? `${PRESETS[themeId]?.bgL ? `Luminance ${PRESETS[themeId].bgL.toFixed(2)}` : 'Custom theme'}`}</div>
      {active && <div style={{ position: 'absolute', top: 8, right: 8, width: 16, height: 16, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff' }}>✓</div>}
    </button>
  );
}

export function ThemeGrid({ value, onChange }: { value: ThemeId; onChange: (v: ThemeId) => void }) {
  const premium = THEME_IDS.filter((t) => PREMIUM_THEME_META[t as string] || ['midnight', 'deepSpace', 'amoled', 'softDark', 'charcoal', 'graphite', 'solarized', 'nord', 'dracula', 'oledNight'].includes(t));
  const legacy = ['balanced', 'highContrast', 'dim'] as ThemeId[];
  const systemAndCustom = ['system', 'custom'] as ThemeId[];

  return (
    <div className="stack">
      <div className="field-label" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Premium Themes</div>
      <div className="theme-grid">
        {premium.map((t) => <ThemeCard key={t} themeId={t} active={value === t} onSelect={() => onChange(t)} />)}
      </div>
      <div className="field-label" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginTop: 8 }}>Essentials</div>
      <div className="theme-grid">
        {[...legacy, ...systemAndCustom].map((t) => <ThemeCard key={t} themeId={t} active={value === t} onSelect={() => onChange(t)} />)}
      </div>
    </div>
  );
}

export function AppearanceControls({ settings, onChange, showSepia, compact: _compact, compactThemeOnly }: { settings: Settings; onChange: (u: (s: Settings) => Settings, msg: string) => void; showSepia?: boolean; compact?: boolean; compactThemeOnly?: boolean }) {
  const warmth = (settings as any).warmth ?? settings.sepia;
  // For legacy test compat, popup shows Theme + Brightness + Contrast strength without extra sliders when compact
  if (compactThemeOnly) {
    return (
      <div className="stack">
        <ThemeSelect id={`theme-${showSepia ? 'o' : 'p'}`} value={settings.theme} onChange={(theme) => onChange((s) => ({ ...s, theme }), `Theme set to ${THEME_LABELS[theme] ?? theme}.`)} />
        <Slider id={`brightness-${showSepia ? 'o' : 'p'}`} label="Brightness" value={settings.brightness} limit={LIMITS.brightness} onCommit={(brightness) => onChange((s) => ({ ...s, brightness, sepia: warmth, warmth }), `Brightness set to ${brightness}%.`)} />
        <Slider id={`contrast-${showSepia ? 'o' : 'p'}`} label="Contrast strength" value={settings.contrast} limit={LIMITS.contrast} onCommit={(contrast) => onChange((s) => ({ ...s, contrast }), `Contrast strength set to ${contrast}%.`)} />
      </div>
    );
  }
  return (
    <div className="stack">
      <ThemeSelect id={`theme-${showSepia ? 'o' : 'p'}`} value={settings.theme} onChange={(theme) => onChange((s) => ({ ...s, theme }), `Theme set to ${THEME_LABELS[theme] ?? theme}.`)} />
      <Slider id={`brightness-${showSepia ? 'o' : 'p'}`} label="Brightness" value={settings.brightness} limit={LIMITS.brightness} onCommit={(brightness) => onChange((s) => ({ ...s, brightness, sepia: warmth, warmth }), `Brightness set to ${brightness}%.`)} />
      <Slider id={`contrast-${showSepia ? 'o' : 'p'}`} label={showSepia ? 'Contrast strength' : 'Contrast strength'} value={settings.contrast} limit={LIMITS.contrast} onCommit={(contrast) => onChange((s) => ({ ...s, contrast }), `Contrast strength set to ${contrast}%.`)} />
      <Slider id={`warmth-${showSepia ? 'o' : 'p'}`} label={showSepia ? 'Warmth (sepia)' : 'Warmth'} value={warmth} limit={LIMITS.warmth} onCommit={(warmth) => onChange((s) => ({ ...s, warmth, sepia: warmth }), `Warmth set to ${warmth}%.`)} />
      {showSepia && <Slider id={`saturation-o`} label="Saturation" value={(settings as any).saturation ?? 50} limit={LIMITS.saturation} onCommit={(saturation) => onChange((s) => ({ ...s, saturation } as any), `Saturation set to ${saturation}%.`)} />}
      {showSepia && <Slider id={`textSize-o`} label="Text size" value={(settings as any).textSize ?? 100} limit={LIMITS.textSize} onCommit={(textSize) => onChange((s) => ({ ...s, textSize } as any), `Text size set to ${textSize}%.`)} />}
      {showSepia && <HueSlider id="accentHue-o" label="Accent hue" value={(settings as any).accentHue ?? 225} onCommit={(accentHue) => onChange((s) => ({ ...s, accentHue } as any), `Accent hue set to ${accentHue}°.`)} />}
    </div>
  );
}

export function StatusLine({ notice }: { notice: { kind: 'ok' | 'error'; text: string } | null }) {
  if (!notice) return <div className="status" role="status" aria-live="polite" />;
  return (
    <div className={`status ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'} aria-live="polite">
      {notice.kind === 'ok' ? '✓ ' : '⚠ '}{notice.text}
    </div>
  );
}

export function PresetChips({ onSelect }: { onSelect: (preset: { brightness: number; contrast: number; warmth: number }) => void }) {
  const presets = [
    { label: 'Default', brightness: 100, contrast: 100, warmth: 0 },
    { label: 'Soft', brightness: 100, contrast: 90, warmth: 15 },
    { label: 'Vivid', brightness: 100, contrast: 115, warmth: 0 },
    { label: 'Warm Night', brightness: 95, contrast: 95, warmth: 25 },
    { label: 'Cool', brightness: 105, contrast: 100, warmth: 0 },
    { label: 'Dim', brightness: 80, contrast: 85, warmth: 10 },
  ];
  return (
    <div className="preset-row">
      {presets.map((p) => (
        <button key={p.label} type="button" className="preset-chip" onClick={() => onSelect(p)}>{p.label}</button>
      ))}
    </div>
  );
}

export function IconWrapper({ children, label }: { children: React.ReactNode; label?: string }) {
  return <span aria-hidden={label ? undefined : true} aria-label={label} style={{ display: 'inline-flex', alignItems: 'center' }}>{children}</span>;
}
