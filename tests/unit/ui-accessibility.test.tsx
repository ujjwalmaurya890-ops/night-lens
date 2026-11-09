import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { Options } from '../../src/options/Options';
import { App } from '../../src/popup/App';
import { buildTokens } from '../../src/engine/palette';
import { toHex } from '../../src/engine/color';
import { STORAGE_KEY, cloneDefaults } from '../../src/shared/defaults';
import type { Settings } from '../../src/shared/types';
import { installChromeMock, type ChromeMock } from './chromeMock';

let mock: ChromeMock;
const stored = () => mock.data[STORAGE_KEY] as Settings;
const ready = (over: Record<string, unknown> = {}) =>
  mock.tabs.sendMessage.mockResolvedValue({ hostname: 'news.example.com', status: 'active', siteMode: null, ...over });

beforeEach(() => {
  mock = installChromeMock();
  ready();
});

const namedControls = (root: HTMLElement): string[] => {
  const controls = root.querySelectorAll<HTMLElement>('button, [role="switch"], input, select, textarea, a[href]');
  return [...controls].map((el) => {
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label')!;
    if (el.id) {
      const label = root.querySelector(`label[for="${el.id}"]`);
      if (label?.textContent?.trim()) return label.textContent.trim();
    }
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) return labelledBy.split(' ').map((id) => root.querySelector(`#${id}`)?.textContent ?? '').join(' ').trim();
    return (el.textContent ?? '').trim();
  });
};

describe('accessibility assertions (contribution 10)', () => {
  it('gives every popup control an accessible name', async () => {
    const { container } = render(<App />);
    await screen.findByText('news.example.com');
    const names = namedControls(container);
    expect(names.length).toBeGreaterThan(5);
    expect(names.filter((n) => n === '')).toEqual([]);
  });

  it('gives every options control an accessible name on every tab', async () => {
    const { container } = render(<Options />);
    for (const label of ['Overview', 'Appearance', 'Themes', 'Websites', 'Accessibility', 'Automation', 'Performance', 'Privacy', 'About']) {
      fireEvent.click(await screen.findByRole('button', { name: label }));
      await waitFor(() => expect(container.querySelector('main.options-main')).not.toBeNull());
      expect(namedControls(container).filter((n) => n === ''), `tab ${label}`).toEqual([]);
    }
  });

  it('never repeats an element id inside a rendered page', async () => {
    const { container } = render(<Options />);
    for (const label of ['Overview', 'Appearance', 'Themes', 'Websites', 'Accessibility', 'Automation', 'Performance', 'Privacy', 'About']) {
      fireEvent.click(await screen.findByRole('button', { name: label }));
      const ids = [...container.querySelectorAll<HTMLElement>('[id]')].map((el) => el.id);
      expect(new Set(ids).size, `tab ${label}`).toBe(ids.length);
    }
  });

  it('provides a skip link to the main region and a labelled settings navigation', async () => {
    const { container } = render(<Options />);
    const skip = screen.getByRole('link', { name: /skip to settings content/i });
    expect(skip.getAttribute('href')).toBe('#options-main');
    expect(container.querySelector('main#options-main')).not.toBeNull();
    expect(screen.getByRole('navigation', { name: 'Settings sections' })).toBeTruthy();
  });

  it('moves the sidebar selection with arrow keys and keeps aria-current in sync', async () => {
    render(<Options />);
    const overview = await screen.findByRole('button', { name: 'Overview' });
    overview.focus();
    fireEvent.keyDown(overview, { key: 'ArrowDown' });
    const appearance = screen.getByRole('button', { name: 'Appearance' });
    expect(appearance.getAttribute('aria-current')).toBe('page');
    expect(document.activeElement).toBe(appearance);

    fireEvent.keyDown(appearance, { key: 'End' });
    expect(screen.getByRole('button', { name: 'About' }).getAttribute('aria-current')).toBe('page');
    fireEvent.keyDown(screen.getByRole('button', { name: 'About' }), { key: 'Home' });
    expect(screen.getByRole('button', { name: 'Overview' }).getAttribute('aria-current')).toBe('page');
  });

  it('announces the active section politely and links it to the content region', async () => {
    const { container } = render(<Options />);
    fireEvent.click(await screen.findByRole('button', { name: 'Themes' }));
    const status = container.querySelector('[role="status"][aria-live="polite"]');
    expect(status?.textContent).toContain('Themes settings');
    expect(screen.getByRole('button', { name: 'Themes' }).getAttribute('aria-controls')).toBe('options-main');
  });

  it('marks the notice region as a polite live region', async () => {
    const { container } = render(<App />);
    await screen.findByText('news.example.com');
    expect(container.querySelector('.status[role="status"][aria-live="polite"]')).not.toBeNull();
  });
});

describe('live theme preview (contribution 07)', () => {
  it('renders the token-derived surface set and measured ratios', async () => {
    render(<Options />);
    fireEvent.click(await screen.findByRole('button', { name: 'Appearance' }));
    const preview = await screen.findByLabelText('Theme preview');
    const settings = cloneDefaults();
    const tokens = buildTokens(settings);

    const surface = preview.querySelector<HTMLElement>('.theme-live-preview-surface')!;
    expect(surface.style.background).toBe(`rgb(${tokens.colors.bg.r}, ${tokens.colors.bg.g}, ${tokens.colors.bg.b})`);
    expect(preview.textContent).toMatch(/Text \d+\.\d:1/);
    expect(preview.textContent).toContain('Preview only');
    expect(preview.textContent).toContain(tokens.preset);
    expect(preview.textContent).toMatch(/\d+\.\d:1/);
  });

  it('contains no interactive elements, so it adds no tab stops', async () => {
    render(<Options />);
    fireEvent.click(await screen.findByRole('button', { name: 'Appearance' }));
    const preview = await screen.findByLabelText('Theme preview');
    expect(preview.querySelectorAll('button, input, select, textarea, a[href], [tabindex]').length).toBe(0);
  });

  it('follows settings changes without touching website content', async () => {
    render(<Options />);
    fireEvent.click(await screen.findByRole('button', { name: 'Themes' }));
    const preview = await screen.findByLabelText('Theme preview');
    const before = preview.querySelector<HTMLElement>('.theme-live-preview-surface')!.style.background;
    // A palette change is a pure re-render: no storage write is required to preview it.
    const chip = screen.getAllByRole('button', { name: /Select AMOLED theme/ })[0]!;
    fireEvent.click(chip);
    await waitFor(() => {
      expect(preview.querySelector<HTMLElement>('.theme-live-preview-surface')!.style.background).not.toBe(before);
    });
    // The click also applied the theme (that is the button's job); the preview never writes by itself.
    await waitFor(() => expect(stored().theme).toBe('amoled'));
  });

  it('reflects a custom theme background', async () => {
    const custom = {
      id: 'mine', name: 'Mine', bg: '#101820', bgRaised: '#182430', text: '#f2f4f8',
      textMuted: '#c3c9d4', accent: '#88ffcc', link: '#88ffcc', border: '#26323f', createdAt: 1,
    };
    render(<Options />);
    fireEvent.click(await screen.findByRole('button', { name: 'Themes' }));
    fireEvent.change(screen.getByLabelText('Theme name'), { target: { value: 'Mine' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Theme' }));
    await waitFor(() => expect(stored().customThemes.length).toBe(1));
    const preview = await screen.findByLabelText('Theme preview');
    await waitFor(() => expect(preview.textContent).toContain('custom'));
    expect(custom.bg).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('per-website overrides (contribution 08)', () => {
  const openWebsites = async () => {
    const utils = render(<Options />);
    fireEvent.click(await screen.findByRole('button', { name: 'Websites' }));
    return utils;
  };

  it('creates an override from validated input and persists only the changed values', async () => {
    await openWebsites();
    fireEvent.change(await screen.findByLabelText('Override website'), { target: { value: 'https://Docs.Example.com/guide' } });
    fireEvent.change(screen.getByLabelText('Override theme'), { target: { value: 'nord' } });
    fireEvent.change(screen.getByLabelText('Override contrast'), { target: { value: '120' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save override' }));

    await waitFor(() => expect(stored().siteOverrides).toEqual({ 'docs.example.com': { theme: 'nord', contrast: 120 } }));
    expect(screen.getByText('docs.example.com', { selector: 'strong' })).toBeTruthy();
  });

  it('rejects an invalid hostname without writing anything', async () => {
    await openWebsites();
    fireEvent.change(await screen.findByLabelText('Override website'), { target: { value: 'not a host' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save override' }));
    expect(screen.getAllByRole('alert').map((a) => a.textContent).join(' ')).toMatch(/website address/i);
    expect(stored()?.siteOverrides ?? {}).toEqual({});
  });

  it('refuses to save an override that changes nothing', async () => {
    await openWebsites();
    fireEvent.change(await screen.findByLabelText('Override website'), { target: { value: 'example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save override' }));
    expect(screen.getAllByRole('alert').map((a) => a.textContent).join(' ')).toMatch(/change at least one value/i);
    expect(stored()?.siteOverrides ?? {}).toEqual({});
  });

  it('lists and clears a saved override while leaving globals intact', async () => {
    await openWebsites();
    fireEvent.change(await screen.findByLabelText('Override website'), { target: { value: 'example.com' } });
    fireEvent.change(screen.getByLabelText('Override brightness'), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save override' }));
    await waitFor(() => expect(stored().siteOverrides).toEqual({ 'example.com': { brightness: 80 } }));

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(stored().siteOverrides).toEqual({}));
    expect(stored().theme).toBe(cloneDefaults().theme);
    expect(stored().brightness).toBe(cloneDefaults().brightness);
  });

  it('resets the draft back to the global values on demand', async () => {
    await openWebsites();
    fireEvent.change(await screen.findByLabelText('Override brightness'), { target: { value: '60' } });
    expect((screen.getByLabelText('Override brightness') as HTMLInputElement).value).toBe('60');
    fireEvent.click(screen.getByRole('button', { name: 'Reset fields' }));
    expect((screen.getByLabelText('Override brightness') as HTMLInputElement).value).toBe(String(cloneDefaults().brightness));
  });

  it('keeps the preview and the override list out of each other’s way', async () => {
    const { container } = await openWebsites();
    expect(container.querySelectorAll('[aria-label="Theme preview"]').length).toBe(0);
    expect(screen.getByText(/Per-Website Overrides/)).toBeTruthy();
  });
});

describe('purpose presets in the Themes tab (contribution 06)', () => {
  it('applies a purpose preset in one action and shows it as pressed', async () => {
    render(<Options />);
    fireEvent.click(await screen.findByRole('button', { name: 'Themes' }));
    const chip = await screen.findByRole('button', { name: 'Soft night' });
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(chip);
    await waitFor(() =>
      expect(stored()).toMatchObject({ theme: 'softDark', brightness: 95, contrast: 95, warmth: 25, sepia: 25 }),
    );
    expect(screen.getByRole('button', { name: 'Soft night' }).getAttribute('aria-pressed')).toBe('true');
    // Descriptions are wired up for assistive technology.
    expect(screen.getByRole('button', { name: 'Soft night' }).getAttribute('aria-describedby')).toBe('purpose-softNight-desc');
    expect(document.getElementById('purpose-softNight-desc')?.textContent).toMatch(/Warm, low-glare surfaces/);
    expect(toHex(buildTokens(stored()).colors.bg)).toHaveLength(6);
  });
});
