import { callApi, hasApiPath } from './call';
import { BrowserApiError } from './errors';
import type { AdapterEnvironment, TabInfo, TabsApi } from './types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Tab access is deliberately narrow: the active tab of the current window, and a message to a
 * single known tab/frame. NightLens never enumerates or reads tab URLs, so it needs neither the
 * `tabs` permission nor browsing-history access on any browser.
 */
export function createTabsApi(env: AdapterEnvironment): TabsApi {
  return {
    async queryActiveTab(): Promise<TabInfo> {
      if (!hasApiPath(env.root, 'tabs.query')) return { id: null };
      const result = await callApi<unknown>(env, 'tabs.query', [
        { active: true, currentWindow: true },
      ]);
      const first = Array.isArray(result) ? result[0] : undefined;
      const id = isRecord(first) ? first.id : undefined;
      return { id: typeof id === 'number' ? id : null };
    },

    async sendMessageToTab(tabId, message, options) {
      if (!hasApiPath(env.root, 'tabs.sendMessage')) {
        throw new BrowserApiError(
          'unsupported',
          'tabs.sendMessage',
          'This browser cannot deliver messages to page content.',
        );
      }
      const args: unknown[] = [tabId, message];
      if (options) args.push(options);
      return callApi<unknown>(env, 'tabs.sendMessage', args);
    },
  };
}
