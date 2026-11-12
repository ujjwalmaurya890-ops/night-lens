import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/popup/App';
import { installChromeMock, installFirefoxMock } from './chromeMock';

/**
 * Firefox MV3 withholds host access until the user allows it. Without the content script running,
 * the popup cannot tell "unsupported page" from "no permission", so these tests pin the wording and
 * the gesture-bound request that fixes it.
 */
describe('host access notice', () => {
  it('explains a missing Firefox grant and requests it on click', async () => {
    const mock = installFirefoxMock();
    mock.tabs.sendMessage.mockRejectedValue(new Error('Could not establish connection. Receiving end does not exist.'));

    render(<App />);

    const grant = await screen.findByRole('button', { name: 'Grant access' });
    expect(document.body.textContent).toMatch(/has not granted NightLens access to websites/);

    fireEvent.click(grant);

    await waitFor(() => expect(mock.permissions.request).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Access granted/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Grant access' })).toBeNull();
  });

  it('shows nothing about permissions where host access is granted at install (Chromium)', async () => {
    const mock = installChromeMock();
    mock.tabs.sendMessage.mockResolvedValue({ hostname: 'news.example.com', status: 'active', siteMode: null });
    render(<App />);
    await screen.findByText('news.example.com');
    expect(screen.queryByRole('button', { name: 'Grant access' })).toBeNull();
    expect(screen.queryByText(/has not granted NightLens access/)).toBeNull();
  });

  it('reports a denied request without pretending it worked', async () => {
    const mock = installFirefoxMock();
    mock.permissions.request.mockResolvedValue(false);
    mock.tabs.sendMessage.mockRejectedValue(new Error('Could not establish connection.'));
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Grant access' }));
    await waitFor(() => expect(document.body.textContent).toMatch(/Access was not granted/));
  });
});
