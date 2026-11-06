import { afterEach, describe, expect, it, vi } from 'vitest';
import { startContentScript } from '../../src/content/content';
import { installChromeMock } from './chromeMock';

const media = () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList;
let dispose: (() => void) | undefined;
afterEach(() => { dispose?.(); dispose = undefined; vi.unstubAllGlobals(); });

describe('content-script lifecycle', () => {
  it('starts once and releases runtime listeners on final pagehide', async () => {
    const mock = installChromeMock();
    vi.stubGlobal('matchMedia', vi.fn(media));
    window.matchMedia = globalThis.matchMedia;
    dispose = startContentScript();
    startContentScript(); // duplicate injection is a no-op
    await vi.waitFor(() => expect(mock.onMessage.count()).toBe(1));
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
    expect(mock.onMessage.count()).toBe(0);
    expect(document.querySelector('style[data-nl-owned]')).toBeNull();
    dispose = undefined;
  });
});
