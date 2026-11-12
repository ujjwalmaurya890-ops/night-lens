import { composeBrowserApi } from './compose';
import type { BrowserApi, BrowserInfo, CallMode } from './types';

/**
 * Safari adapter.
 *
 * Safari exposes both `browser` (promises) and `chrome` (callbacks + promises) once the extension
 * is running inside the Safari app extension. Which namespace we were bound to decides the call
 * style. Safari-specific gaps are handled by the shared fallbacks rather than by forking features:
 *  - no `runtime.onStartup` (the badge is repainted on install and on every settings change);
 *  - `commands` only from Safari 16.4 (the popup toggle remains the primary control);
 *  - no `permissions.request` (site access is managed in Safari settings).
 */
export function createSafariAdapter(
  root: unknown,
  info: BrowserInfo,
  callMode: CallMode,
): BrowserApi {
  return composeBrowserApi({ root, callMode, info });
}
