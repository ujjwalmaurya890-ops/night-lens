import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react';
import { LIMITS } from '../shared/defaults';
import { PREMIUM_THEME_META, PRESETS, themePreviewColors } from '../engine/palette';
import { PREMIUM_THEME_IDS, THEME_IDS, type Settings, type ThemeId } from '../shared/types';
import { IconAlertTriangle, IconCheck, IconCheckCircle, IconInfo, IconShield } from './icons';
import { useEnvironment, useHostAccess } from './hooks';

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

export function Logo({ size = 28 }: { size?: number }) {
  const iconSize = Math.round(size * 0.58);
  return (
    <div
      className="brand-mark"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.32) }}
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <circle
          cx="10"
          cy="10"
          r="8.25"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeOpacity="0.88"
        />
        <path
          d="M12.4 4.5a5.85 5.85 0 1 0 3.1 8.65A4.85 4.85 0 0 1 12.4 4.5Z"
          fill="currentColor"
        />
        <circle cx="13.9" cy="6.2" r="0.9" fill="#ffffff" fillOpacity="0.85" />
      </svg>
    </div>
  );
}

export function LogoFull() {
  return (
    <div className="options-brand-group">
      <Logo size={32} />
      <div>
        <div className="options-brand-title">NightLens</div>
        <div className="options-brand-sub">Intelligent Dark Mode</div>
      </div>
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      className="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  );
}

export function ThemeSelect({
  value,
  onChange,
  id,
}: {
  value: ThemeId;
  onChange: (v: ThemeId) => void;
  id: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id} className="field-label">
        Theme
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as ThemeId)}>
        {THEME_IDS.map((t) => (
          <option key={t} value={t}>
            {THEME_LABELS[t] ?? t}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Slider({
  id,
  label,
  value,
  limit,
  unit = '%',
  hint,
  onCommit,
}: {
  id: string;
  label: string;
  value: number;
  limit: { min: number; max: number; step: number };
  unit?: string;
  hint?: string;
  onCommit: (v: number) => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  useEffect(() => {
    if (local === value) return;
    const t = setTimeout(() => onCommit(local), 140);
    return () => clearTimeout(t);
  }, [local, value, onCommit]);

  const span = limit.max - limit.min;
  const fillPct = span > 0 ? Math.max(0, Math.min(100, ((local - limit.min) / span) * 100)) : 50;
  const ariaText =
    unit === '%'
      ? `${local} percent`
      : unit
        ? `${local} ${unit}`
        : String(local);

  return (
    <div className="field">
      <div className="slider-row">
        <label htmlFor={id} className="field-label">
          {label}
        </label>
        <span className="slider-value">
          {local}
          {unit}
        </span>
      </div>
      <div className="slider-track">
        <input
          id={id}
          type="range"
          min={limit.min}
          max={limit.max}
          step={limit.step}
          value={local}
          aria-valuetext={ariaText}
          style={{ '--slider-fill': `${fillPct}%` } as CSSProperties}
          onChange={(e) => setLocal(Number(e.target.value))}
        />
      </div>
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

export function HueSlider({
  id,
  label,
  value,
  onCommit,
}: {
  id: string;
  label: string;
  value: number;
  onCommit: (v: number) => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  useEffect(() => {
    if (local === value) return;
    const t = setTimeout(() => onCommit(local), 140);
    return () => clearTimeout(t);
  }, [local, value, onCommit]);

  return (
    <div className="field">
      <div className="slider-row">
        <label htmlFor={id} className="field-label">
          {label}
        </label>
        <span
          className="slider-value"
          style={{
            background: `hsl(${local} 72% 52% / 0.16)`,
            borderColor: `hsl(${local} 72% 58% / 0.35)`,
            color: `hsl(${local} 86% 74%)`,
          }}
        >
          {local}°
        </span>
      </div>
      <div className="slider-track">
        <input
          id={id}
          type="range"
          className="hue-range"
          min={0}
          max={360}
          step={5}
          value={local}
          aria-valuetext={`${local} degrees`}
          onChange={(e) => setLocal(Number(e.target.value))}
        />
      </div>
    </div>
  );
}

export function ThemeCard({
  themeId,
  active,
  onSelect,
}: {
  themeId: string;
  active: boolean;
  onSelect: () => void;
}) {
  const meta = PREMIUM_THEME_META[themeId];
  const preview = themePreviewColors(themeId);

  return (
    <button
      type="button"
      className={`theme-card ${active ? 'active' : ''}`}
      onClick={onSelect}
      aria-pressed={active}
      aria-label={`Select ${THEME_LABELS[themeId] ?? themeId} theme`}
    >
      <div
        className="theme-preview"
        style={{ background: preview.bg, color: preview.text }}
      >
        <div className="theme-preview-sample">
          <span className="theme-preview-aa">Aa</span>
          <span className="theme-preview-bar" />
        </div>
        <div className="theme-preview-tokens">
          <span
            className="theme-preview-dot"
            style={{ background: preview.accent }}
          />
          <span
            className="theme-preview-link"
            style={{
              color: preview.accent,
              borderBottom: `1.5px solid ${preview.accent}`,
            }}
          >
            Link
          </span>
        </div>
      </div>
      <div className="theme-name">{THEME_LABELS[themeId] ?? themeId}</div>
      <div className="theme-desc">
        {meta?.description ??
          (themeId === 'system'
            ? 'Syncs automatically with OS dark appearance'
            : themeId === 'custom'
              ? 'User-defined custom color palette'
              : PRESETS[themeId]?.bgL
                ? `Luminance ${PRESETS[themeId].bgL.toFixed(2)}`
                : 'Custom theme')}
      </div>
      {active && (
        <div className="theme-check badge-pop" aria-hidden="true">
          <IconCheck size={11} strokeWidth={2.5} />
        </div>
      )}
    </button>
  );
}

export function ThemeGrid({
  value,
  onChange,
}: {
  value: ThemeId;
  onChange: (v: ThemeId) => void;
}) {
  // Derived from the single source of truth so a new premium palette cannot be forgotten here.
  const premium: ThemeId[] = [...PREMIUM_THEME_IDS];
  const essentials: ThemeId[] = ['balanced', 'highContrast', 'dim', 'system', 'custom'];

  return (
    <div className="stack">
      <div className="eyebrow">Curated Palettes</div>
      <div className="theme-grid">
        {premium.map((t) => (
          <ThemeCard
            key={t}
            themeId={t}
            active={value === t}
            onSelect={() => onChange(t)}
          />
        ))}
      </div>
      <div className="eyebrow" style={{ marginTop: 6 }}>
        Essentials &amp; System
      </div>
      <div className="theme-grid">
        {essentials.map((t) => (
          <ThemeCard
            key={t}
            themeId={t}
            active={value === t}
            onSelect={() => onChange(t)}
          />
        ))}
      </div>
    </div>
  );
}

export function AppearanceControls({
  settings,
  onChange,
  showSepia,
  compactThemeOnly,
  slidersOnly,
}: {
  settings: Settings;
  onChange: (u: (s: Settings) => Settings, msg: string) => void;
  showSepia?: boolean;
  compactThemeOnly?: boolean;
  slidersOnly?: boolean;
}) {
  const warmth = settings.warmth ?? settings.sepia;
  const suffix = showSepia ? 'o' : 'p';

  if (slidersOnly) {
    return (
      <div className="stack">
        <Slider
          id={`brightness-${suffix}`}
          label="Brightness"
          value={settings.brightness}
          limit={LIMITS.brightness}
          onCommit={(brightness) =>
            onChange(
              (s) => ({ ...s, brightness, sepia: warmth, warmth }),
              `Brightness set to ${brightness}%.`,
            )
          }
        />
        <Slider
          id={`contrast-${suffix}`}
          label="Contrast strength"
          value={settings.contrast}
          limit={LIMITS.contrast}
          onCommit={(contrast) =>
            onChange((s) => ({ ...s, contrast }), `Contrast strength set to ${contrast}%.`)
          }
        />
      </div>
    );
  }

  if (compactThemeOnly) {
    return (
      <div className="stack">
        <ThemeSelect
          id={`theme-${suffix}`}
          value={settings.theme}
          onChange={(theme) =>
            onChange((s) => ({ ...s, theme }), `Theme set to ${THEME_LABELS[theme] ?? theme}.`)
          }
        />
        <Slider
          id={`brightness-${suffix}`}
          label="Brightness"
          value={settings.brightness}
          limit={LIMITS.brightness}
          onCommit={(brightness) =>
            onChange(
              (s) => ({ ...s, brightness, sepia: warmth, warmth }),
              `Brightness set to ${brightness}%.`,
            )
          }
        />
        <Slider
          id={`contrast-${suffix}`}
          label="Contrast strength"
          value={settings.contrast}
          limit={LIMITS.contrast}
          onCommit={(contrast) =>
            onChange((s) => ({ ...s, contrast }), `Contrast strength set to ${contrast}%.`)
          }
        />
      </div>
    );
  }

  return (
    <div className="stack">
      <ThemeSelect
        id={`theme-${suffix}`}
        value={settings.theme}
        onChange={(theme) =>
          onChange((s) => ({ ...s, theme }), `Theme set to ${THEME_LABELS[theme] ?? theme}.`)
        }
      />
      <Slider
        id={`brightness-${suffix}`}
        label="Brightness"
        value={settings.brightness}
        limit={LIMITS.brightness}
        onCommit={(brightness) =>
          onChange(
            (s) => ({ ...s, brightness, sepia: warmth, warmth }),
            `Brightness set to ${brightness}%.`,
          )
        }
      />
      <Slider
        id={`contrast-${suffix}`}
        label="Contrast strength"
        value={settings.contrast}
        limit={LIMITS.contrast}
        onCommit={(contrast) =>
          onChange((s) => ({ ...s, contrast }), `Contrast strength set to ${contrast}%.`)
        }
      />
      <Slider
        id={`warmth-${suffix}`}
        label={showSepia ? 'Warmth (sepia)' : 'Warmth'}
        value={warmth}
        limit={LIMITS.warmth}
        onCommit={(nextWarmth) =>
          onChange(
            (s) => ({ ...s, warmth: nextWarmth, sepia: nextWarmth }),
            `Warmth set to ${nextWarmth}%.`,
          )
        }
      />
      {showSepia && (
        <Slider
          id="saturation-o"
          label="Saturation"
          value={settings.saturation ?? 50}
          limit={LIMITS.saturation}
          onCommit={(saturation) =>
            onChange((s) => ({ ...s, saturation }), `Saturation set to ${saturation}%.`)
          }
        />
      )}
      {showSepia && (
        <Slider
          id="textSize-o"
          label="Text size"
          value={settings.textSize ?? 100}
          limit={LIMITS.textSize}
          onCommit={(textSize) =>
            onChange((s) => ({ ...s, textSize }), `Text size set to ${textSize}%.`)
          }
        />
      )}
      {showSepia && (
        <HueSlider
          id="accentHue-o"
          label="Accent hue"
          value={settings.accentHue ?? 225}
          onCommit={(accentHue) =>
            onChange((s) => ({ ...s, accentHue }), `Accent hue set to ${accentHue}°.`)
          }
        />
      )}
    </div>
  );
}

export function StatusLine({
  notice,
}: {
  notice: { kind: 'ok' | 'error'; text: string } | null;
}) {
  if (!notice) return <div className="status" role="status" aria-live="polite" />;
  return (
    <div
      className={`status ${notice.kind} status-enter`}
      role={notice.kind === 'error' ? 'alert' : 'status'}
      aria-live="polite"
    >
      {notice.kind === 'ok' ? (
        <IconCheckCircle size={15} />
      ) : (
        <IconAlertTriangle size={15} />
      )}
      <span>{notice.text}</span>
    </div>
  );
}

export const QUICK_PRESETS = [
  { label: 'Default', brightness: 100, contrast: 100, warmth: 0 },
  { label: 'Soft', brightness: 100, contrast: 90, warmth: 15 },
  { label: 'Vivid', brightness: 100, contrast: 115, warmth: 0 },
  { label: 'Warm Night', brightness: 95, contrast: 95, warmth: 25 },
  { label: 'Cool', brightness: 105, contrast: 100, warmth: 0 },
  { label: 'Dim', brightness: 80, contrast: 85, warmth: 10 },
] as const;

export function PresetChips({
  current,
  onSelect,
}: {
  current?: { brightness: number; contrast: number; warmth: number };
  onSelect: (preset: { brightness: number; contrast: number; warmth: number; label?: string }) => void;
}) {
  return (
    <div className="preset-row" role="group" aria-label="Quick calibration presets">
      {QUICK_PRESETS.map((p) => {
        const isActive =
          current !== undefined &&
          current.brightness === p.brightness &&
          current.contrast === p.contrast &&
          current.warmth === p.warmth;
        return (
          <button
            key={p.label}
            type="button"
            className={`preset-chip ${isActive ? 'active' : ''}`}
            aria-pressed={current !== undefined ? isActive : undefined}
            onClick={() => onSelect(p)}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Smooth CSS-Grid disclosure panel that starts unmounted when closed (keeping
 * hidden controls out of the DOM and keyboard tab order) and animates both
 * expansion and collapse cleanly.
 */
export function CollapsiblePanel({
  open,
  children,
  className = '',
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [mounted, setMounted] = useState(open);
  const [phase, setPhase] = useState<'entering' | 'open' | 'closing'>(open ? 'open' : 'closing');

  useEffect(() => {
    if (open) {
      setMounted(true);
      setPhase('entering');
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setPhase('open'));
      });
      return () => cancelAnimationFrame(raf);
    } else if (mounted) {
      setPhase('closing');
      const t = setTimeout(() => setMounted(false), 185);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open, mounted]);

  if (!mounted) return null;

  return (
    <div className={`disclosure ${className}`.trim()} data-state={phase}>
      <div className="disclosure-inner">{children}</div>
    </div>
  );
}

export function Tooltip({
  content,
  children,
}: {
  content: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <span className="tooltip-wrap" aria-describedby={id}>
      {children}
      <span id={id} role="tooltip" className="tooltip-bubble">
        {content}
      </span>
    </span>
  );
}

export function SectionCard({
  icon,
  title,
  headingId,
  headingLevel = 'h2',
  action,
  description,
  variant = 'default',
  compact = false,
  spacing = 'stack',
  className = '',
  ariaLabel,
  children,
}: {
  icon?: ReactNode;
  title: string;
  headingId?: string;
  headingLevel?: 'h2' | 'h3';
  action?: ReactNode;
  description?: ReactNode;
  variant?: 'default' | 'active' | 'positive' | 'subtle';
  compact?: boolean;
  spacing?: 'stack' | 'stack-lg';
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  const variantClass =
    variant === 'active'
      ? 'card-active'
      : variant === 'positive'
        ? 'card-positive'
        : variant === 'subtle'
          ? 'card-subtle'
          : '';
  const Heading = headingLevel;

  return (
    <section
      className={`card ${compact ? 'card-compact' : ''} ${spacing} ${variantClass} ${className}`.replace(
        /\s+/g,
        ' ',
      ).trim()}
      aria-label={ariaLabel}
      aria-labelledby={!ariaLabel && headingId ? headingId : undefined}
    >
      <div className="card-header">
        <div className="card-title-group">
          {icon && <span className="card-icon">{icon}</span>}
          <Heading id={headingId}>{title}</Heading>
        </div>
        {action}
      </div>
      {description && <p className="card-description">{description}</p>}
      {children}
    </section>
  );
}

export function SettingRow({
  title,
  description,
  control,
}: {
  title: ReactNode;
  description?: ReactNode;
  control: ReactNode;
}) {
  return (
    <div className="setting-row">
      <div className="setting-row-info">
        <span className="setting-row-title">{title}</span>
        {description && <span className="setting-row-desc">{description}</span>}
      </div>
      {control}
    </div>
  );
}

export function IconWrapper({
  children,
  label,
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      style={{ display: 'inline-flex', alignItems: 'center' }}
    >
      {children}
    </span>
  );
}

/**
 * Shared empty state for lists that can legitimately have no rows. Keeps the visual language
 * consistent across the Websites, Themes and Overview tabs and always renders real text for
 * screen readers instead of an icon-only box.
 */
export function EmptyState({ icon, title, description }: { icon?: ReactNode; title: string; description?: ReactNode }) {
  return (
    <div className="empty-state" role="status">
      {icon}
      <span className="empty-state-title">{title}</span>
      {description && <span className="field-hint">{description}</span>}
    </div>
  );
}

/**
 * Shown when the page is not running with a usable extension API (opened as a plain file, or the
 * extension was disabled mid-session). Silence here used to look like "settings are ignored".
 */
export function EnvironmentNotice() {
  const environment = useEnvironment();
  if (environment.available) return null;
  return (
    <div className="notice-banner notice-banner-warn" role="alert">
      <IconAlertTriangle size={15} style={{ marginTop: 1, flexShrink: 0 }} />
      <span>{environment.problem}</span>
    </div>
  );
}

/**
 * Firefox MV3 keeps host access as a revocable grant. Without it the content script never runs,
 * so the popup would otherwise only say "this page is unsupported". This notice states the real
 * cause and offers the only fix the platform allows: an explicit request from a click.
 */
export function HostAccessNotice() {
  const hostAccess = useHostAccess();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!hostAccess.required) return null;

  if (hostAccess.granted) {
    return feedback ? (
      <div className="notice-banner notice-banner-info" role="status" aria-live="polite">
        <IconInfo size={15} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>{feedback}</span>
      </div>
    ) : null;
  }

  return (
    <div className="notice-banner notice-banner-warn" role="status" aria-live="polite">
      <IconShield size={15} style={{ marginTop: 1, flexShrink: 0 }} />
      <div className="stack-xs" style={{ flex: 1 }}>
        <span>
          {hostAccess.browserLabel} has not granted NightLens access to websites, so pages are not
          being darkened. Grant access, then reload this tab.
        </span>
        {feedback && <span className="field-hint">{feedback}</span>}
      </div>
      <button
        type="button"
        className="btn btn-sm"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          // The request must run inside the click handler itself (user-gesture requirement).
          void hostAccess
            .request()
            .then((granted) => {
              setFeedback(
                granted
                  ? 'Access granted. Reload the page to apply NightLens.'
                  : 'Access was not granted. You can allow it later in the extension’s Permissions settings.',
              );
            })
            .finally(() => setBusy(false));
        }}
      >
        {busy ? 'Requesting…' : 'Grant access'}
      </button>
    </div>
  );
}
