import { useMemo } from 'react';
import { contrastRatio, toHex } from '../engine/color';
import { buildTokens, type ThemeTokens } from '../engine/palette';
import type { Settings } from '../shared/types';

const hex = (c: { r: number; g: number; b: number }): string => `#${toHex(c)}`;

const ratio = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): string =>
  `${(Math.round(contrastRatio(a, b) * 10) / 10).toFixed(1)}:1`;

/**
 * Renders the surface set a real page gets from the current settings: page background, raised
 * card, body and muted text, a link, a button, an input, and a border. It is rendered from the
 * same `buildTokens()` output the content script uses, so what is previewed is what is applied.
 *
 * Nothing here is interactive: the fake controls are plain elements, so the preview adds no extra
 * tab stops to the settings page.
 */
export function ThemePreview({ settings }: { settings: Settings }) {
  const tokens: ThemeTokens = useMemo(() => buildTokens(settings), [settings]);
  const c = tokens.colors;
  const textOnCard = c.text;
  const mutedOnCard = c.textMuted;

  return (
    <figure className="theme-live-preview" aria-label="Theme preview">
      <div
        className="theme-live-preview-surface"
        style={{ background: hex(c.bg), color: hex(textOnCard), borderColor: hex(c.border) }}
      >
        <div className="theme-live-preview-top">
          <span className="theme-live-preview-eyebrow" style={{ color: hex(mutedOnCard) }}>
            Preview
          </span>
          <span
            className="theme-live-preview-chip"
            style={{ background: hex(c.bgRaised), color: hex(mutedOnCard), border: `1px solid ${hex(c.border)}` }}
          >
            {tokens.preset}
          </span>
        </div>

        <div
          className="theme-live-preview-card"
          style={{ background: hex(c.bgRaised), border: `1px solid ${hex(c.border)}` }}
        >
          <span className="theme-live-preview-heading" style={{ color: hex(textOnCard) }}>
            Readable headings
          </span>
          <span className="theme-live-preview-body" style={{ color: hex(mutedOnCard) }}>
            Body copy keeps its hierarchy while staying legible on the mapped surface.
          </span>
          <span className="theme-live-preview-row">
            <span className="theme-live-preview-link" style={{ color: hex(c.link) }}>
              A link
            </span>
            <span
              className="theme-live-preview-button"
              style={{ background: hex(c.selectionBg), color: hex(c.selectionText) }}
            >
              Button
            </span>
            <span
              className="theme-live-preview-input"
              style={{ background: hex(c.bg), border: `1px solid ${hex(c.border)}`, color: hex(mutedOnCard) }}
            >
              Input
            </span>
          </span>
        </div>

        <div className="theme-live-preview-ratios">
          <span style={{ color: hex(mutedOnCard) }}>Text {ratio(textOnCard, c.bgRaised)}</span>
          <span style={{ color: hex(mutedOnCard) }}>Muted {ratio(mutedOnCard, c.bgRaised)}</span>
          <span style={{ color: hex(mutedOnCard) }}>Link {ratio(c.link, c.bgRaised)}</span>
          <span style={{ color: hex(mutedOnCard) }}>Border {ratio(c.border, c.bgRaised)}</span>
        </div>
      </div>
      <figcaption className="field-hint">
        Preview only. Websites use these colours only after you change a setting above.
      </figcaption>
    </figure>
  );
}
