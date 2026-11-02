import { describe, expect, it } from 'vitest';
import { handleCommand, handleInstalled, handleStartup, updateBadge } from '../../src/background/handlers';
import { STORAGE_KEY, cloneDefaults } from '../../src/shared/defaults';
import { loadSettings, updateSettings } from '../../src/shared/storage';
import { installChromeMock } from './chromeMock';

describe('background service worker handlers', () => {
  it('keyboard command toggles the global switch and updates the badge', async () => {
    const mock = installChromeMock();
    await handleCommand('toggle-nightlens');
    expect((await loadSettings()).enabled).toBe(false);
    expect(mock.action.setBadgeText).toHaveBeenLastCalledWith({ text: 'OFF' });
    await handleCommand('toggle-nightlens');
    expect((await loadSettings()).enabled).toBe(true);
    expect(mock.action.setBadgeText).toHaveBeenLastCalledWith({ text: '' });
  });
  it('ignores unknown commands', async () => {
    const mock = installChromeMock();
    await handleCommand('something-else');
    expect(mock.data[STORAGE_KEY]).toBeUndefined();
  });
  it('writes defaults on first install but never overwrites existing settings', async () => {
    const mock = installChromeMock();
    await handleInstalled();
    expect(mock.data[STORAGE_KEY]).toEqual(cloneDefaults());
    await updateSettings((s) => ({ ...s, theme: 'dim' }));
    await handleInstalled();
    expect((await loadSettings()).theme).toBe('dim');
  });
  it('restores the badge on browser startup', async () => {
    const mock = installChromeMock();
    await updateSettings((s) => ({ ...s, enabled: false }));
    await handleStartup();
    expect(mock.action.setBadgeText).toHaveBeenLastCalledWith({ text: 'OFF' });
    await updateBadge({ ...cloneDefaults(), enabled: true });
    expect(mock.action.setBadgeText).toHaveBeenLastCalledWith({ text: '' });
  });
});
