/**
 * Errors raised by the browser adapter layer.
 *
 * They exist so the UI can show a message that tells the user what to do, rather than the raw
 * "Error: undefined" that some engines produce for the same failure.
 */

export type BrowserApiErrorKind =
  | 'unsupported'
  | 'storage'
  | 'messaging'
  | 'permission'
  | 'context-invalidated'
  | 'unknown';

export class BrowserApiError extends Error {
  readonly kind: BrowserApiErrorKind;
  readonly api: string;

  constructor(kind: BrowserApiErrorKind, api: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'BrowserApiError';
    this.kind = kind;
    this.api = api;
  }
}

/** True when the failure is an orphaned script whose extension was reloaded/updated/removed. */
export function isContextInvalidated(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /extension context invalidated|message port closed|Receiving end does not exist|Could not establish connection/i.test(
    message,
  );
}

export function kindForApi(api: string): BrowserApiErrorKind {
  if (api.startsWith('storage')) return 'storage';
  if (api.startsWith('runtime.sendMessage') || api.startsWith('tabs.sendMessage')) return 'messaging';
  if (api.startsWith('permissions')) return 'permission';
  return 'unknown';
}

/** Normalises anything an engine throws (DOMException, Error, string) into one typed error. */
export function toBrowserApiError(error: unknown, api: string): BrowserApiError {
  if (error instanceof BrowserApiError) return error;
  const raw = error instanceof Error ? error.message : String(error);
  if (isContextInvalidated(error)) {
    return new BrowserApiError(
      'context-invalidated',
      api,
      'NightLens was reloaded, updated or removed. Reload this page to reconnect.',
      { cause: error },
    );
  }
  const message = raw.trim() || 'The browser did not provide a reason.';
  return new BrowserApiError(kindForApi(api), api, message, { cause: error });
}

/** A short, user-facing description; the API name is included so support reports are actionable. */
export function describeBrowserApiError(error: unknown): string {
  const normalised = error instanceof BrowserApiError ? error : toBrowserApiError(error, 'unknown');
  return normalised.message;
}
