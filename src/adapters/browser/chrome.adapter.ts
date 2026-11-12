import { composeBrowserApi } from './compose';
import type { BrowserApi, BrowserInfo, CallMode } from './types';

/**
 * Chromium adapter (Chrome, Edge, Brave, Opera, Opera GX, Vivaldi, other Chromium forks).
 *
 * The `chrome.*` namespace historically delivers results through callbacks and, since Chrome 88,
 * also returns promises. `hybrid` mode accepts either, which is what lets one build run on an old
 * Opera GX build and a current Chrome without branching in application code.
 */
export function createChromeAdapter(
  root: unknown,
  info: BrowserInfo,
  callMode: CallMode = 'hybrid',
): BrowserApi {
  return composeBrowserApi({ root, callMode, info });
}
