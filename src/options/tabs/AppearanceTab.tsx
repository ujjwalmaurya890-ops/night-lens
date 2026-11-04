import { LIMITS } from '../../shared/defaults';
import type { Settings } from '../../shared/types';
import {
  AppearanceControls,
  CollapsiblePanel,
  HueSlider,
  SectionCard,
  SettingRow,
  Slider,
  Switch,
} from '../../ui/components';
import { IconBook, IconPalette, IconSliders } from '../../ui/icons';

interface AppearanceTabProps {
  settings: Settings;
  onChange: (updater: (s: Settings) => Settings, msg: string) => void;
}

export function AppearanceTab({ settings, onChange }: AppearanceTabProps) {
  return (
    <>
      <div className="page-header">
        <h1>Appearance</h1>
        <p className="page-lead">
          Fine-tune luminance, contrast, warmth, and reading comfort across every page.
          Adjustments take effect immediately.
        </p>
      </div>

      <SectionCard
        icon={<IconSliders size={15} />}
        title="Brightness & Contrast"
        spacing="stack-lg"
      >
        <AppearanceControls
          settings={settings}
          onChange={onChange}
          showSepia
        />
      </SectionCard>

      <SectionCard icon={<IconPalette size={15} />} title="Typography & Link Accent">
        <div className="stack">
          <div className="field">
            <label htmlFor="font-pref-select" className="field-label">
              Font preference
            </label>
            <select
              id="font-pref-select"
              value={settings.fontFamily}
              onChange={(e) =>
                onChange(
                  (s) => ({ ...s, fontFamily: e.target.value }),
                  `Font set to ${e.target.value}.`,
                )
              }
            >
              <option value="system">System default</option>
              <option value="inter">Inter (clean sans)</option>
              <option value="sf">SF Pro (Apple)</option>
              <option value="serif">Serif (editorial reading)</option>
            </select>
          </div>

          <HueSlider
            id="appearance-link-hue"
            label="Link color accent"
            value={settings.accentHue ?? 225}
            onCommit={(accentHue) =>
              onChange(
                (s) => ({ ...s, accentHue }),
                `Accent hue set to ${accentHue}°.`,
              )
            }
          />
        </div>
      </SectionCard>

      <SectionCard
        icon={<IconBook size={15} />}
        title="Reading Mode"
        description="Distraction-free reading layout with calibrated measure, line spacing, and optional serif or dyslexia-friendly typefaces."
      >
        <SettingRow
          title="Enable reading mode"
          description="Centers body copy and hides surrounding navigation clutter"
          control={
            <Switch
              label="Reading mode"
              checked={settings.readingMode.enabled}
              onChange={(enabled) =>
                onChange(
                  (s) => ({
                    ...s,
                    readingMode: { ...s.readingMode, enabled },
                  }),
                  enabled ? 'Reading mode on.' : 'Reading mode off.',
                )
              }
            />
          }
        />

        <CollapsiblePanel open={settings.readingMode.enabled}>
          <div className="stack" style={{ paddingTop: 10 }}>
            <hr className="divider" />
            <Slider
              id="reading-font-size"
              label="Font size"
              value={settings.readingMode.fontSize}
              limit={LIMITS.readingFontSize}
              unit="%"
              onCommit={(fontSize) =>
                onChange(
                  (s) => ({
                    ...s,
                    readingMode: { ...s.readingMode, fontSize },
                  }),
                  `Reading font size ${fontSize}%.`,
                )
              }
            />
            <Slider
              id="reading-line-height"
              label="Line height"
              value={settings.readingMode.lineHeight}
              limit={LIMITS.readingLineHeight}
              unit="%"
              onCommit={(lineHeight) =>
                onChange(
                  (s) => ({
                    ...s,
                    readingMode: { ...s.readingMode, lineHeight },
                  }),
                  `Line height ${lineHeight}%.`,
                )
              }
            />
            <Slider
              id="reading-max-width"
              label="Max width"
              value={settings.readingMode.maxWidth}
              limit={LIMITS.readingMaxWidth}
              unit="px"
              onCommit={(maxWidth) =>
                onChange(
                  (s) => ({
                    ...s,
                    readingMode: { ...s.readingMode, maxWidth },
                  }),
                  `Max width ${maxWidth}px.`,
                )
              }
            />
            <div className="field">
              <label htmlFor="reading-font-family" className="field-label">
                Font family
              </label>
              <select
                id="reading-font-family"
                value={settings.readingMode.fontFamily}
                onChange={(e) =>
                  onChange(
                    (s) => ({
                      ...s,
                      readingMode: {
                        ...s.readingMode,
                        fontFamily: e.target.value as typeof s.readingMode.fontFamily,
                      },
                    }),
                    `Reading font ${e.target.value}.`,
                  )
                }
              >
                <option value="system">System UI</option>
                <option value="serif">Serif (Georgia)</option>
                <option value="sans">Sans (Inter)</option>
                <option value="dyslexic">OpenDyslexic</option>
              </select>
            </div>
          </div>
        </CollapsiblePanel>
      </SectionCard>
    </>
  );
}
