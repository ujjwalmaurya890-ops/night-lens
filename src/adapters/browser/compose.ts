import { createActionApi, createOptionsPageApi } from './action.adapter';
import { buildCapabilities } from './capabilities';
import { createCommandsApi } from './commands.adapter';
import { createPermissionsApi } from './permissions.adapter';
import { createRuntimeApi } from './runtime.adapter';
import { createStorageApi } from './storage.adapter';
import { createTabsApi } from './tabs.adapter';
import type { AdapterEnvironment, BrowserApi } from './types';

/**
 * Single place where the per-API adapters are assembled into the facade the application uses.
 * Every engine adapter goes through here, so all targets get identical error handling and
 * identical fallbacks; the only difference between them is the environment (namespace + call
 * style + family).
 */
export function composeBrowserApi(env: AdapterEnvironment): BrowserApi {
  return {
    info: env.info,
    capabilities: buildCapabilities(env),
    runtime: createRuntimeApi(env),
    storage: createStorageApi(env),
    tabs: createTabsApi(env),
    commands: createCommandsApi(env),
    action: createActionApi(env),
    permissions: createPermissionsApi(env),
    options: createOptionsPageApi(env),
  };
}
