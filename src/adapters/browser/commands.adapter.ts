import { addListener, callApi, readPath } from './call';
import type { AdapterEnvironment, CommandsApi } from './types';

/**
 * Keyboard shortcuts. Chromium browsers and Firefox expose `commands`; Safari only ships it from
 * Safari 16.4, so an absent API must be a no-op rather than a startup failure. The popup always
 * offers the same toggle, so no capability is lost - only the shortcut.
 */
export function createCommandsApi(env: AdapterEnvironment): CommandsApi {
  return {
    onCommand(listener) {
      // `commands.onCommand` is an event object, not a function: test for existence.
      if (readPath(env.root, 'commands.onCommand') === undefined) return () => undefined;
      return addListener(env.root, 'commands.onCommand', (...args: unknown[]) => {
        const [command] = args as [unknown];
        if (typeof command === 'string') listener(command);
      });
    },

    async getAll() {
      const result = await callApi<unknown>(env, 'commands.getAll', [], []);
      if (!Array.isArray(result)) return [];
      return result
        .map((entry) => (entry && typeof entry === 'object' ? (entry as { name?: unknown }).name : undefined))
        .filter((name): name is string => typeof name === 'string');
    },
  };
}
