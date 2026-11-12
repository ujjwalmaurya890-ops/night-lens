import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Options } from '../../src/options/Options';
import { App } from '../../src/popup/App';
import { STORAGE_KEY } from '../../src/shared/defaults';
import { STATUS_CHANGED } from '../../src/shared/messages';
import type { Settings } from '../../src/shared/types';
import { installChromeMock, type ChromeMock } from './chromeMock';

let mock: ChromeMock;
const stored = () => mock.data[STORAGE_KEY] as Settings;
const ready = (over: Record<string, unknown> = {}) => mock.tabs.sendMessage.mockResolvedValue({ hostname: 'news.example.com', status: 'active', siteMode: null, ...over });

beforeEach(() => { mock = installChromeMock(); ready(); });

describe('popup', () => {
  it('shows branding, the current site and its status', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /NightLens/ })).toBeTruthy();
    expect(await screen.findByText('news.example.com')).toBeTruthy();
    expect(screen.getByText(/Dark mode is active on this site/)).toBeTruthy();
    // The adapter may append a trailing callback on the callback-style Chromium namespace, so the
    // assertion covers the meaningful arguments rather than the whole call.
    const call = mock.tabs.sendMessage.mock.calls[0]!;
    expect(call.slice(0, 2)).toEqual([5, { type: 'nightlens/get-status' }]);
    expect(call[2]).toEqual({ frameId: 0 });
  });

  it('global toggle persists and announces the result', async () => {
    render(<App />);
    const sw = await screen.findByRole('switch', { name: 'Dark mode (all sites)' });
    expect(sw.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(sw);
    await waitFor(() => expect(stored().enabled).toBe(false));
    expect(await screen.findByText(/turned off everywhere/)).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Dark mode (all sites)' }).getAttribute('aria-checked')).toBe('false');
  });

  it('site toggle excludes exactly this hostname, then restores automatic mode', async () => {
    render(<App />);
    const site = await screen.findByRole('switch', { name: 'Dark mode on news.example.com' });
    fireEvent.click(site);
    await waitFor(() => expect(stored().siteRules).toEqual({ 'news.example.com': 'off' }));
    // content script pushes the new status; the popup follows it
    act(() => mock.onMessage.emit({ type: STATUS_CHANGED, hostname: 'news.example.com', status: 'excluded', siteMode: 'off' }, { tab: { id: 5 }, frameId: 0 } as chrome.runtime.MessageSender, () => undefined));
    expect(await screen.findByText(/This site is excluded/)).toBeTruthy();
    fireEvent.click(screen.getByRole('switch', { name: 'Dark mode on news.example.com' }));
    await waitFor(() => expect(stored().siteRules).toEqual({}));
  });

  it('ignores status pushes from other tabs and from iframes', async () => {
    render(<App />);
    await screen.findByText('news.example.com');
    const send = (sender: unknown) => act(() => mock.onMessage.emit({ type: STATUS_CHANGED, hostname: 'evil.test', status: 'excluded', siteMode: 'off' }, sender as chrome.runtime.MessageSender, () => undefined));
    send({ tab: { id: 99 }, frameId: 0 });
    send({ tab: { id: 5 }, frameId: 3 });
    expect(screen.queryByText('evil.test')).toBeNull();
  });

  it('offers to force dark mode on sites that already look dark', async () => {
    ready({ status: 'native-dark' });
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Force dark mode on this site' }));
    await waitFor(() => expect(stored().siteRules).toEqual({ 'news.example.com': 'on' }));
  });

  it('theme selector and sliders write their settings', async () => {
    render(<App />);
    fireEvent.change(await screen.findByLabelText('Theme'), { target: { value: 'dim' } });
    await waitFor(() => expect(stored().theme).toBe('dim'));
    fireEvent.change(screen.getByLabelText('Brightness'), { target: { value: '80' } });
    await waitFor(() => expect(stored().brightness).toBe(80));
    fireEvent.change(screen.getByLabelText('Contrast strength'), { target: { value: '120' } });
    await waitFor(() => expect(stored().contrast).toBe(120));
    expect(screen.queryByLabelText(/sepia/i)).toBeNull(); // sepia lives on the settings page
  });

  it('shows a helpful empty state on pages without a content script', async () => {
    mock.tabs.sendMessage.mockRejectedValue(new Error('Could not establish connection. Receiving end does not exist.'));
    render(<App />);
    expect(await screen.findByText(/can’t run on this page/)).toBeTruthy();
    expect(screen.queryByRole('switch', { name: /Dark mode on/ })).toBeNull();
  });

  it('reset needs confirmation and then restores defaults', async () => {
    const { updateSettings } = await import('../../src/shared/storage');
    await updateSettings((s) => ({ ...s, theme: 'dim', enabled: false, siteRules: { 'a.com': 'off' } }));
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Reset…' }));
    expect(stored().theme).toBe('dim'); // nothing happens until confirmed
    fireEvent.click(within(screen.getByRole('group', { name: 'Confirm reset' })).getByRole('button', { name: 'Cancel' }));
    expect(stored().theme).toBe('dim');
    fireEvent.click(screen.getByRole('button', { name: 'Reset…' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Confirm reset' })).getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(stored()).toMatchObject({ theme: 'midnight', enabled: true, siteRules: {} }));
    expect(await screen.findByText(/reset to their defaults/)).toBeTruthy();
  });

  it('reports storage failures honestly', async () => {
    render(<App />);
    const sw = await screen.findByRole('switch', { name: 'Dark mode (all sites)' });
    mock.failStorage.set = true;
    fireEvent.click(sw);
    expect((await screen.findByRole('alert')).textContent).toMatch(/Could not save settings: quota exceeded/);
    expect(stored()?.enabled ?? true).toBe(true);
  });

  it('opens the settings page', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }));
    expect(mock.runtime.openOptionsPage).toHaveBeenCalled();
  });

  it('every interactive control has an accessible name and is keyboard focusable', async () => {
    render(<App />);
    await screen.findByText('news.example.com');
    const controls = [...document.querySelectorAll<HTMLElement>('button, select, input')];
    expect(controls.length).toBeGreaterThan(5);
    for (const c of controls) {
      expect(c.tabIndex).toBeGreaterThanOrEqual(0);
      const name = c.getAttribute('aria-label') || c.textContent?.trim() || (c.id && document.querySelector(`label[for="${c.id}"]`)?.textContent);
      expect(name, c.outerHTML).toBeTruthy();
    }
    expect(document.querySelector('[role="status"],[role="alert"]')).not.toBeNull(); // live region exists
  });

  it('disables the site switch while NightLens is off globally', async () => {
    const { updateSettings } = await import('../../src/shared/storage');
    await updateSettings((s) => ({ ...s, enabled: false }));
    ready({ status: 'globally-off' });
    render(<App />);
    const site = await screen.findByRole('switch', { name: 'Dark mode on news.example.com' });
    await waitFor(() => expect((site as HTMLButtonElement).disabled).toBe(true));
  });
});

describe('options page', () => {
  it('adds, normalizes, lists and removes excluded sites', async () => {
    render(<Options />);
    const input = await screen.findByLabelText('Exclude a website');
    fireEvent.change(input, { target: { value: 'https://Docs.Example.com:8443/path' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(stored().siteRules).toEqual({ 'docs.example.com': 'off' }));
    expect(await screen.findByRole('list', { name: 'Excluded sites' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove docs.example.com from excluded sites' }));
    await waitFor(() => expect(stored().siteRules).toEqual({}));
  });

  it('rejects invalid input with an error message and stores nothing', async () => {
    render(<Options />);
    fireEvent.change(await screen.findByLabelText('Exclude a website'), { target: { value: 'not a host!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect((await screen.findAllByRole('alert')).some((a) => /Enter a website address/.test(a.textContent ?? ''))).toBe(true);
    expect(stored()).toBeUndefined();
  });

  it('exposes the warmth slider and explains the data it stores', async () => {
    render(<Options />);
    fireEvent.change(await screen.findByLabelText('Warmth (sepia)'), { target: { value: '30' } });
    await waitFor(() => expect(stored().sepia).toBe(30));
    expect(screen.getByText(/does not read or record your browsing history/)).toBeTruthy();
  });

  it('documents nearest-host subdomain matching on the page', async () => {
    render(<Options />);
    expect((await screen.findAllByText(/subdomains/)).length).toBeGreaterThan(0);
  });

  it('websites tab: applies a force-on rule, assigns a per-site theme, saves a compatibility profile', async () => {
    render(<Options />);
    fireEvent.click(await screen.findByRole('button', { name: /Websites/ }));

    // force-on rule
    fireEvent.change(await screen.findByLabelText('Website'), { target: { value: 'dark.example.com' } });
    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'on' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply rule' }));
    await waitFor(() => expect(stored().siteRules).toEqual({ 'dark.example.com': 'on' }));

    // per-site theme
    fireEvent.change(screen.getByLabelText('Assign theme to website'), { target: { value: 'docs.example.com' } });
    fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'nord' } });
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));
    await waitFor(() => expect(stored().siteThemes).toEqual({ 'docs.example.com': 'nord' }));

    // compatibility profile
    fireEvent.change(screen.getByLabelText('Website for profile'), { target: { value: 'tricky.example.com' } });
    fireEvent.change(screen.getByLabelText('Profile'), { target: { value: 'gentle' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => expect(stored().compatibility).toEqual({ 'tricky.example.com': 'gentle' }));
  });

  it('resets all website preferences only after confirmation while keeping global appearance', async () => {
    const { updateSettings } = await import('../../src/shared/storage');
    await updateSettings((s) => ({
      ...s,
      theme: 'nord',
      siteRules: { 'example.com': 'off' },
      siteThemes: { 'example.com': 'nord' },
      siteOverrides: { 'example.com': { brightness: 80 } },
      compatibility: { 'example.com': 'gentle' },
      customCSS: { 'example.com': 'body{color:#fff}' },
    }));
    render(<Options />);
    fireEvent.click(await screen.findByRole('button', { name: /Websites/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset website preferences…' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Confirm website preference reset' })).getByRole('button', { name: 'Reset websites' }));
    await waitFor(() => expect(stored()).toMatchObject({ theme: 'nord', siteRules: {}, siteThemes: {}, siteOverrides: {}, compatibility: {}, customCSS: {} }));
  });

  it('websites tab: rejects an invalid hostname in the rule form and stores nothing', async () => {
    render(<Options />);
    fireEvent.click(await screen.findByRole('button', { name: /Websites/ }));
    const websiteInputs = await screen.findAllByLabelText('Website');
    fireEvent.change(websiteInputs[0]!, { target: { value: 'not a host!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply rule' }));
    expect((await screen.findAllByRole('alert')).some((a) => /Enter a website address/.test(a.textContent ?? ''))).toBe(true);
    expect(stored()?.siteRules ?? {}).toEqual({});
  });

  it('navigates across all settings tabs with accessible current state and live reduced-motion attribute', async () => {
    const { container } = render(<Options />);
    for (const label of ['Appearance', 'Themes', 'Websites', 'Accessibility', 'Automation', 'Performance', 'Privacy', 'About', 'Overview']) {
      const navBtn = await screen.findByRole('button', { name: label });
      fireEvent.click(navBtn);
      expect(navBtn.getAttribute('aria-current')).toBe('page');
    }

    fireEvent.click(screen.getByRole('button', { name: 'Accessibility' }));
    const reducedSwitch = await screen.findByRole('switch', { name: 'Reduced motion' });
    expect(container.querySelector('.dashboard')?.getAttribute('data-reduced-motion')).toBeNull();
    fireEvent.click(reducedSwitch);
    await waitFor(() => expect(stored().accessibility.reducedMotion).toBe(true));
    expect(container.querySelector('.dashboard')?.getAttribute('data-reduced-motion')).toBe('true');
  });
});

describe('popup expandable panels and micro-interactions', () => {
  it('expands theme browser and advanced warmth controls smoothly and highlights active presets', async () => {
    render(<App />);
    await screen.findByText('news.example.com');

    // Default preset chip reflects initial 100/100/0 calibration
    const defaultChip = screen.getByRole('button', { name: 'Default' });
    expect(defaultChip.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Warm Night' }));
    await waitFor(() => expect(stored().warmth).toBe(25));
    expect(screen.getByRole('button', { name: 'Warm Night' }).getAttribute('aria-pressed')).toBe('true');

    // Expand ThemeGrid drawer
    const browseBtn = screen.getByRole('button', { name: 'Browse' });
    expect(browseBtn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(browseBtn);
    expect(screen.getByRole('button', { name: 'Hide' }).getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(await screen.findByRole('button', { name: 'Select Nord theme' }));
    await waitFor(() => expect(stored().theme).toBe('nord'));

    // Expand More adjustments drawer
    const moreBtn = screen.getByRole('button', { name: 'More' });
    fireEvent.click(moreBtn);
    expect(screen.getByRole('button', { name: 'Less' }).getAttribute('aria-expanded')).toBe('true');
    const warmthSlider = await screen.findByLabelText('Warmth');
    expect(warmthSlider.getAttribute('style')).toContain('--slider-fill:');
    fireEvent.change(warmthSlider, { target: { value: '40' } });
    await waitFor(() => expect(stored().warmth).toBe(40));
  });
});

void vi;
