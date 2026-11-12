import { composeBrowserApi } from './compose';
import type { BrowserApi, BrowserInfo, CallMode } from './types';

/**
 * Firefox adapter.
 *
 * `browser.*` on Gecko is promise-only and validates its arguments strictly, so no trailing
 * callback is ever appended (that is why this adapter does not share the Chromium call style).
 * Two Firefox MV3 differences matter to NightLens and are handled here or in the manifest:
 *  - the background context is a non-persistent event page driven by `background.scripts`;
 *  - host access is a revocable grant (`capabilities.hostAccessIsUserControlled`).
 */
export function createFirefoxAdapter(
  root: unknown,
  info: BrowserInfo,
  callMode: CallMode = 'promise',
): BrowserApi {
  return composeBrowserApi({ root, callMode, info });
}
